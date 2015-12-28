"use strict";
var redis = require("redis");
var _ = require('lodash');

var expiration = 3600; //seconds for data to expire

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
  var startTime = new Date().getTime();
  var self = this;
  self._scanAll(0, request, new Array(), function(err, results){

  	var keys = results;
  	var objects = Array();

  	var finished = _.after(keys.length, submitResults);
	  for (var index in keys) {
  		resources[request.params.type].get(keys[index], function(err, results){
  			try{
  				results = JSON.parse(results)
  				objects.push(results);
  				finished();
  			}
  			catch (exception){
  				console.log("non-JSON entry; skipping.");
  		    // callback({
  		    //   status: "500",
  		    //   code: "EINTSERVERR",
  		    //   title: "Bad Data",
  		    //   detail: "redis db has bad data in it. JSON could not parse."
  		    // });
  			}
    	});
  	}
  	function submitResults() {
    	self._sortList(request, objects);
  	  var resultCount = objects.length;
  		if (request.params.page) {
  		  objects = objects.slice(request.params.page.offset, request.params.page.offset + request.params.page.limit);
  		}
  		console.log("Search took:"+ (new Date().getTime() -startTime) + " milliseconds" );
    		return callback(null, objects, keys.length);
  	}
  });
};

RedisStore.prototype._scanAll = function(cursor, request, allKeys, callback) {
  	resources[request.params.type].scan(cursor, "match", request.params.type+"*", "count", "10000", function(err, results){
  		if(err) return callback(err, null);
	  	cursor = results[0];
	  	var keys = results[1];
	  	allKeys = allKeys.concat(keys);
	  	// console.dir(keys);
	  	// console.log("cursor: "+ allKeys);
	  	if(cursor == "0") return callback(null, allKeys);
	  	RedisStore.prototype._scanAll(cursor, request, allKeys, callback);
  	});
}

/**
  Find a specific resource, given a resource type and and id.
 */
RedisStore.prototype.find = function(request, callback) {
  var self = this;
  resources[request.params.type].get(request.params.type+":"+request.params.id, function(err, results){
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

  resources[request.params.type].set(newResource.type+":"+newResource.id, JSON.stringify(newResource));
  if(expiration > 0) resources[request.params.type].expire(newResource.type+":"+newResource.id, expiration);
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
    resources[request.params.type].del(theResource.type+":"+theResource.id, function(err, results){
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
  	resources[request.params.type].set(theResource.type+":"+theResource.id, JSON.stringify(theResource));

    // Return the newly updated resource
    return callback(null, theResource);
  });
};



/**
  Internal helper function to sort data
 */
RedisStore.prototype._sortList = function(request, list) {
  var attribute = request.params.sort;
  if (!attribute) return;

  var ascending = 1;
  attribute = ("" + attribute);
  if (attribute[0] === "-") {
    ascending = -1;
    attribute = attribute.substring(1, attribute.length);
  }

  list.sort(function(a, b) {
    if (typeof a[attribute] === "string") {
      return a[attribute].localeCompare(b[attribute]) * ascending;
    } else if (typeof a[attribute] === "number") {
      return (a[attribute] - b[attribute]) * ascending;
    } else {
      return 0;
    }
  });
};

