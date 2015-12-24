/**
 * Module dependencies.
 */
var jsonApi = require("jsonapi-server");
var RedisStore = require("./lib/redisHandler");

var secrets = require('./config/secrets');
var passportConf = require('./config/passport');

// /**
//  * Create JSONAPI server.
//  */


jsonApi.setConfig({
  protocol: "http",
  hostname: "localhost",
  base: "api",
  port: 16006,
});

jsonApi.define({
  resource: "gps",
  handlers: new RedisStore({}),
  attributes: {
    time: jsonApi.Joi.date().default(Date.now, 'time of creation').required(),
    lng: jsonApi.Joi.number().min(-180).max(180).precision(5).required(),
    lat: jsonApi.Joi.number().min(-180).max(180).precision(5).required(),
    alt: jsonApi.Joi.number().min(-500).max(100000).precision(2),
    speed: jsonApi.Joi.number().min(0).max(1000).precision(2),
    heading: jsonApi.Joi.number().min(0).max(360).precision(2),
    lng_err: jsonApi.Joi.number().min(0).max(100000).precision(0),
    lat_err: jsonApi.Joi.number().min(0).max(100000).precision(0),
    alt_err: jsonApi.Joi.number().min(0).max(100000).precision(0),
    speed_err: jsonApi.Joi.number().min(0).max(500).precision(0),
  }
});

jsonApi.onUncaughtException(function(request, error) {
  console.log(error);
});

jsonApi.start();
console.log("server running");
