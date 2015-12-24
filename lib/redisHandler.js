"use strict";
var redis = require("redis");

var RedisStore = module.exports = function RedisStore(config) {
  this._config = config;
};

// resources represents our resouce specific redis client
var resources = { };

RedisStore.prototype.ready = false;

RedisStore.prototype.initialise = function(resourceConfig) {
  resources[resourceConfig.resource] = redis.createClient();
  console.log("Redis Client created for " + resourceConfig.resource);
  // resources[resourceConfig.resource].flushall();
  this.ready = true;
};


/**
  Search for a list of resources, given a resource type.
 */
RedisStore.prototype.search = function(request, callback) {
  var self = this;
  resources[request.params.type].hgetall(request.params.type, function(err, results){
  	var objects = Array();
	for (var entry in results) {
		objects.push(JSON.parse(results[entry]));
	}
  	var resultCount = objects.length;
	if (request.params.page) {
	  objects = objects.slice(request.params.page.offset, request.params.page.offset + request.params.page.limit);
	}
  	return callback(null, objects, resultCount);
  } )
};

/**
  Find a specific resource, given a resource type and and id.
 */
RedisStore.prototype.find = function(request, callback) {
  var self = this;
  resources[request.params.type].hget(request.params.type, request.params.id, function(err, results){
	  // If the resource doesn't exist, error
	  if (err || results == null) {
	    return callback({
	      status: "404",
	      code: "ENOTFOUND",
	      title: "Requested resource does not exist",
	      detail: "There is no " + request.params.type + " with id " + request.params.id
	    });
	  }
	  // Return the requested resource
	  return callback(null, JSON.parse(results));
  });
};



RedisStore.prototype.create = function(request, newResource, callback) {
  var self = this;

  resources[request.params.type].hset(newResource.type, newResource.id, JSON.stringify(newResource));
  // Return the newly created resource
  return callback(null, newResource);
};


/**
  Delete a resource, given a resource type and and id.
 */
RedisStore.prototype.delete = function(request, callback) {
  // Find the requested resource
  this.find(request, function(err, theResource) {
    if (err) return callback(err);

    // Remove the resource
    resources[request.params.type].hdel(request.params.type, request.params.id, function(err, results){
    	if(err) return callback(err);
    	return callback(results);
    })
  });
};


/**
  Update a resource, given a resource type and id, along with a partialResource.
  partialResource contains a subset of changes that need to be merged over the original.
 */
RedisStore.prototype.update = function(request, partialResource, callback) {
  // Find the requested resource
  this.find(request, function(err, theResource) {
    if (err) return callback(err);

    // Merge the partialResource over the original
	for(var key in partialResource) theResource[key]=partialResource[key];

    // Push the newly updated resource back into the store
  	resources[request.params.type].hset(theResource.type, theResource.id, JSON.stringify(theResource));

    // Return the newly updated resource
    return callback(null, theResource);
  });
};
