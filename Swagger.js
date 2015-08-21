var _ = require('lodash');
var mongoose = require('mongoose');
module.exports = function(resource, bodyDefinition) {

  /**
   * Converts a Mongoose property to a Swagger property.
   *
   * @param options
   * @returns {*}
   */
  var getProperty = function(options) {

    // Convert to the proper format if needed.
    if (!options.hasOwnProperty('type')) options = {type: options};

    // If no type, then return null.
    if (!options.type) return null;

    // If this is an array, then return the array with items.
    if (Array.isArray(options.type)) {
      if (options.type[0].hasOwnProperty('paths')) {
        return {
          type: 'array',
          items: getModel(options.type[0])
        };
      }
      return {
        type: 'array',
        items: {
          type: 'string',
        }
      };
    }

    switch(options.type) {
      case String:
        return {
          type: 'string'
        };
      case Number:
        return {
          type: 'integer',
          format: 'int64'
        };
      case Date: 
        return {
          type: 'string',
          format: 'date'
        };
      case Boolean: 
        return {
          type: 'boolean'
        };
      case Function: 
        var functionName = options.type.toString();
        functionName = functionName.substr('function '.length);
        functionName = functionName.substr(0, functionName.indexOf('('));

        switch (functionName) {
          case 'ObjectId':
            return {
              '$ref': '#/definitions/' + options.ref
            };
          case 'Oid':
            return {
              '$ref': '#/definitions/' + options.ref
            };
          case 'Array':
            return {
              type: 'array',
              items: {
                type: 'string'
              }
            };
          case 'Mixed':
            return {
              type: 'string'
            };
          case 'Buffer': 
            return {
              type: 'string'
            };
        }
        break;
      case Object:
        return null;
    }

    if (options.type instanceof Object) return null;
    throw new Error('Unrecognized type: ' + options.type);
  };

  var getModel = function(schema) {
    // Define the definition structure.
    var definition = {
//      required: [],
      properties: {}
    };

    // Iterate through each model schema path.
    _.each(schema.paths, function(path, name) {

      // Set the property for the swagger model.
      var property = getProperty(path.options);
      if (name.substr(0, 2) !== '__' && property) {

        // Add the description if they provided it.
        if (path.options.description) {
          property.description = path.options.description;
        }

        // Add the example if they provided it.
        if (path.options.example) {
          property.example = path.options.example;
        }

        // Add the required params if needed.
        if (path.options.required) {
//          definition.required.push(name);
        }

        // Set enum values if applicable
        if (path.enumValues && path.enumValues.length > 0) {
          property.allowableValues = { valueType: 'LIST', values: path.enumValues };
        }

        // Set allowable values range if min or max is present
        if (!isNaN(path.options.min) || !isNaN(path.options.max)) {
          property.allowableValues = { valueType: 'RANGE' };
        }

        if (!isNaN(path.options.min)) {
          property.allowableValues.min = path.options.min;
        }

        if (!isNaN(path.options.max)) {
          property.allowableValues.max = path.options.max;
        }

        if (!property.type) {
          console.log('Warning: That field type is not yet supported in Swagger definitions, using "string"');
          console.log('Path name: %s.%s', definition.id, name);
          console.log('Mongoose type: %s', path.options.type);
          property.type = 'string';
        }

        // Add this property to the definition.
        definition.properties[name] = property;
      }
    });

    return definition;
  };

  /**
   * Get the properties for an API.
   * @param model
   */
  var getUpdateProperties = function(model) {
    var properties = [];
    _.each(model.properties, function(property, name) {
      if (
        !resource.model.schema.paths[name].hasOwnProperty('__readonly') ||
        !resource.model.schema.paths[name].__readonly
      ) {
        properties.push(property);
      }
    });
    return properties;
  };

  var swagger = {
    definitions: {},
    paths: {}
  };

  // Get the swagger model.
  var swaggerModel = bodyDefinition || getModel(resource.model.schema);

  // Add the model to the definitions.
  swagger.definitions[resource.modelName] = swaggerModel;
  swagger.definitions[resource.modelName+'List'] = { 
    type: 'array',
      items: {
        $ref: '#/definitions/' + resource.modelName,
      }
  };

  // See if all the methods are defined.
  var hasIndex = (resource.methods.indexOf('index') !== -1);
  var hasPost = (resource.methods.indexOf('post') !== -1);
  var hasGet = (resource.methods.indexOf('get') !== -1);
  var hasPut = (resource.methods.indexOf('put') !== -1);
  var hasDelete = (resource.methods.indexOf('delete') !== -1);

  // Establish the paths.
  if (hasIndex || hasPost) {
    swagger.paths[resource.route] = {};
  }

  // The resource path for this resource.
  var resourcePath = '';
  if (hasGet || hasPut || hasDelete) {
    resourcePath = resource.route + '/{' + resource.name + 'Id}';
    swagger.paths[resourcePath] = {};
  }

  // INDEX of resources.
  if (hasIndex) {
    swagger.paths[resource.route].get = {
      tags: [resource.name],
      summary: 'List multiple ' + resource.modelName + ' resources.',
      description: 'This operation allows you to list and search for ' + resource.modelName + ' resources provided query arguments.',
      operationId: 'get' + resource.modelName + 's',
      produces: ['application/json'],
      responses: {
        401: {
          description: 'Unauthorized.'
        },
        200: {
          description: 'Resource(s) found.  Returned as array.',
          schema: {
            $ref: "#/definitions/" + resource.modelName + "List"
          }
        }
      },
      parameters: [
        {
          name: 'skip',
          in: 'query',
          description: 'How many records to skip when listing. Used for pagination.',
          required: false,
          type: 'integer',
          default: 0
        },
        {
          name: 'limit',
          in: 'query',
          description: 'How many records to limit the output.',
          required: false,
          type: 'integer',
          default: 10
        },
        {
          name: 'count',
          in: 'query',
          description: 'Set to true to return the number of records instead of the documents.',
          type: 'boolean',
          required: false,
          default: false
        },
        {
          name: 'sort',
          in: 'query',
          description: 'Which fields to sort the records on.',
          type: 'string',
          required: false,
          default: ''
        },
        {
          name: 'select',
          in: 'query',
          description: 'Select which fields will be returned by the query.',
          type: 'string',
          required: false,
          default: ''
        },
        {
          name: 'populate',
          in: 'query',
          description: 'Select which fields will be fully populated with the reference.',
          type: 'string',
          required: false,
          default: ''
        }
      ]
    };
  }

  // POST resource.
  if (hasPost) {
    swagger.paths[resource.route].post = {
      tags: [resource.name],
      summary: 'Create a new ' + resource.modelName,
      description: 'Create a new ' + resource.modelName,
      operationId: 'create' + resource.modelName,
      consumes: ['application/json'],
      produces: ['application/json'],
      security: [],
      responses: {
        401: {
          description: 'Unauthorized.  Note that anonymous submissions are *enabled* by default.'
        },
        400: {
          description: 'An error has occured trying to create the resource.'
        },
        201: {
          description: 'The resource has been created.'
        }
      },
      parameters: [
        {
          in: 'body',
          name: 'body',
          description: 'Data used to create a new ' + resource.modelName,
          required: true,
          schema: {
            $ref: "#/definitions/" + resource.modelName
          }
        }
      ]
    };
  }

  // GET method.
  if (hasGet) {
    swagger.paths[resourcePath].get = {
      tags: [resource.name],
      summary: 'Return a specific ' + resource.name + ' instance.',
      description: 'Return a specific ' + resource.name + ' instance.',
      operationId: 'get' + resource.modelName,
      produces: ['application/json'],
      responses: {
        500: {
          description: 'An error has occurred.'
        },
        404: {
          description: 'Resource not found'
        },
        401: {
          description: 'Unauthorized.'
        },
        200: {
          description: 'Resource found',
          schema: {
            $ref: "#/definitions/" + resource.modelName
          }
        }
      },
      parameters: [
        {
          name: resource.name + 'Id',
          in: 'path',
          description: 'The ID of the ' + resource.name + ' that will be retrieved.',
          required: true,
          type: 'string'
        }
      ]
    };
  }

  // PUT method
  if (hasPut) {
    swagger.paths[resourcePath].put = {
      tags: [resource.name],
      summary: 'Update a specific ' + resource.name + ' instance.',
      description: 'Update a specific ' + resource.name + ' instance.',
      operationId: 'update' + resource.modelName,
      consumes: ['application/json'],
      produces: ['application/json'],
      responses: {
        500: {
          description: 'An error has occurred.'
        },
        404: {
          description: 'Resource not found'
        },
        401: {
          description: 'Unauthorized.'
        },
        400: {
          description: 'Resource could not be updated.'
        },
        200: {
          description: 'Resource updated',
          schema: {
            $ref: "#/definitions/" + resource.modelName
          }
        }
      },
      parameters: [
        {
          name: resource.name + 'Id',
          in: 'path',
          description: 'The ID of the ' + resource.name + ' that will be updated.',
          required: true,
          type: 'string'
        },
        {
          in: 'body',
          name: 'body',
          description: 'Data used to update ' + resource.modelName,
          required: true,
          schema: {
            $ref: "#/definitions/" + resource.modelName
          }
        }
      ]
    };
  }

  // DELETE method
  if (hasDelete) {
    swagger.paths[resourcePath].delete = {
      tags: [resource.name],
      summary: 'Delete a specific ' + resource.name,
      description: 'Delete a specific ' + resource.name,
      operationId: 'delete' + resource.modelName,
      consumes: ['application/json'],
      produces: ['application/json'],
      responses: {
        500: {
          description: 'An error has occurred.'
        },
        404: {
          description: 'Resource not found'
        },
        401: {
          description: 'Unauthorized.'
        },
        400: {
          description: 'Resource could not be deleted.'
        },
        204: {
          description: 'Resource was deleted'
        }
      },
      parameters: [
        {
          name: resource.name + 'Id',
          in: 'path',
          description: 'The ID of the ' + resource.name + ' that will be deleted.',
          required: true,
          type: 'string'
        }
      ]
    };
  }

  // Return the swagger definition for this resource.
  return swagger;
};