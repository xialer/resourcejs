Resource.js - A simple Express library to reflect Mongoose models to a REST interface with a splash of Swagger.io love.
==============================================================

Resource.js is designed to be a minimalistic Express library that reflects a Mongoose
model to a RESTful interface. It does this through a very simple and extensible interface.

Provided the following code

```
var express = require('express');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var Resource = require('../Resource');

// Create the app.
var app = express();

// Use the body parser.
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

// Create the schema.
var ResourceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  }
});

// Create the model.
var ResourceModel = mongoose.model('Resource', ResourceSchema);

// Create the REST resource.
Resource(app, '', 'resource', ResourceModel).rest();
```

The following rest interface would then be exposed.

 * ***/resource*** - (GET) - List all resources.
 * ***/resource*** - (POST) - Create a new resource.
 * ***/resource/:id*** - (GET) - Get a specific resource.
 * ***/resource/:id*** - (PUT) - Updates an existing resource.
 * ***/resource/:id*** - (DELETE) - Deletes an existing resource.

Parameters
----------------
The ```Resource``` object takes 4 arguments.

```Resource(app, route, name, model)```

 - ***app*** - This is the Express application.
 - ***route*** - This is the route to "mount" this resource onto. For example, if you were doing nested resources, this could be '/parent/:parentId'
 - ***name*** - The name of the resource, which will then be used for the URL path of that resource.
 - ***model*** - The Mongoose Model for this interface.

Only exposing certain methods
-------------------
You can also expose only a certain amount of methods, by instead of using
the ***rest*** method, you can use the specific methods and then chain them
together like so.

```
// Do not expose DELETE.
Resource(app, '', 'resource', ResourceModel).get().put().post().index();
```

Adding Before and After handlers
-------------------
This library allows you to handle middleware either before or after the
request is made to the Mongoose query mechanism.  This allows you to
either alter the query being made or, provide authentication.

For example, if you wish to provide basic authentication to every endpoint,
you can use the ***before*** callback attached to the ***rest*** method like so.

```
npm install basic-auth-connect
```

```
var basicAuth = require('basic-auth-connect');

...
...

Resource(app, '', 'resource', ResourceModel).rest({
  before: basicAuth('username', 'password')
});
```

You can also target individual methods so if you wanted to protect POST, PUT, and DELETE
but not GET and INDEX you would do the following.

```
Resource(app, '', 'resource', ResourceModel).rest({
  beforePut: basicAuth('username', 'password'),
  beforePost: basicAuth('username', 'password'),
  beforeDelete: basicAuth('username', 'password')
});
```

You can also do this by specifying the handlers within the specific method calls like so.

```
Resource(app, '', 'resource', ResourceModel)
  .get()
  .put({
    before: basicAuth('username', 'password'),
    after: function(req, res, next) {
      console.log("PUT was just called!");
    }
  })
  .post({
  	before: basicAuth('username', 'password')
  });
```

Adding custom queries
---------------------------------
Using the method above, it is possible to provide some custom queries in your ***before*** middleware.
We can do this by adding a ***methodQuery*** to the ***req*** object during the middleware. This query
uses the Mongoose query mechanism that you can see here http://mongoosejs.com/docs/api.html#query_Query-where.

For example, if we wish to show an index that filters ages greater than 18, we would do the following.

```
Resource(app, '', 'user', UserModel).rest({
  before: function(req, res, next) {
    req.modelQuery = this.model.where('age').gt(18);
  }
});
```

Nested Resources
-----------------
With this library, it is also pretty easy to nest resources. Here is an example of how to do it.

```
var express = require('express');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var Resource = require('../Resource');

// Create the app.
var app = express();

// Use the body parser.
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

// Parent model
var Parent = mongoose.model('Parent', new mongoose.Schema({
  name: {
    type: String,
    required: true
  }
}));

// Child model.
var Child = mongoose.model('Child', new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Parent',
    index: true,
    required: true
  }
}));

// The parent REST interface.
Resource(app, '', 'parent', Parent).rest();

// The child REST interface.
Resource(app, '/parent/:parentId', 'child', Child).rest({

  // Add a before handler to include filter and parent information.
  before: function(req, res, next) {
    req.body.parent = req.params.parentId;
    req.modelQuery = this.model.where('parent', req.params.parentId);
    next();
  }
});
```

This would now expose the following...

 * ***/parent*** - (GET) - List all parents.
 * ***/parent*** - (POST) - Create a new parent.
 * ***/parent/:parentId*** - (GET) - Get a specific parent.
 * ***/parent/:parentId*** - (PUT) - Updates an existing parent.
 * ***/parent/:parentId*** - (DELETE) - Deletes an existing parent.
 * ***/parent/:parentId/child*** - (GET) - List all children of a parent.
 * ***/parent/:parentId/child*** - (POST) - Create a new child.
 * ***/parent/:parentId/child/:childId*** - (GET) - Get a specific child per parent.
 * ***/parent/:parentId/child/:childId*** - (PUT) - Update a child for a parent.
 * ***/parent/:parentId/child/:childId*** - (DELETE) - Delete a child for a parent.

Adding Swagger.io v2 documentation
--------------------------------
Along with auto-generating API's for your application, this library also is able to
auto generate Swagger.io documentation so that your API's are well documented and can
be easily used and understood by everyone.

Each Resource object has the ability to generate the Swagger docs for that resource,
and this can then be combined to create the Swagger docs necessary to feed into the
Swagger UI tools.

***Getting the swagger documentation for a resource***
```
var resource = Resource(app, '', 'resource', ResourceModel).rest();

// Print out the Swagger docs for this resource.
console.log(resource.swagger());
```

You can then use this to create a full specification for you API with all your resources
by doing the following.

```
var _ = require('lodash');

// Define all our resources.
var resources = {
	user: Resource(app, '', 'user', UserModel).rest(),
	group: Resource(app, '', 'group', GroupModel).rest(),
	role: Resource(app, '', 'role', RoleModel).rest()
};

// Get the Swagger paths and definitions for each resource.
var paths = {};
var definitions = {};
_.each(resources, function(resource) {
  var swagger = resource.swagger();
  paths = _.assign(paths, swagger.paths);
  definitions = _.assign(definitions, swagger.definitions);
});

// Define the specification.
var specification = {
  swagger: '2.0',
  info: {
    description: '',
    version: '0.0.1',
    title: '',
    contact: {
      name: 'test@example.com'
    },
    license: {
      name: 'MIT',
      url: 'http://opensource.org/licenses/MIT'
    }
  },
  host: 'localhost:3000',
  basePath: '',
  schemes: ['http'],
  definitions: definitions,
  paths: paths
};

// Show the specification at the URL.
app.get('/spec', function(req, res, next) {
	res.json(specification);
});
```
