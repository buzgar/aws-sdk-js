/**
 * Copyright 2012-2013 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"). You
 * may not use this file except in compliance with the License. A copy of
 * the License is located at
 *
 *     http://aws.amazon.com/apache2.0/
 *
 * or in the "license" file accompanying this file. This file is
 * distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF
 * ANY KIND, either express or implied. See the License for the specific
 * language governing permissions and limitations under the License.
 */

var fs = require('fs');
var util = require('util');
var path = require('path');
var through = require('through');
var _ = require('underscore');
var bundleHelpers = require('./bundle-helpers');

var sanitizeRegex = /[^a-zA-Z0-9,-]/g;

function mapFromNames(names) {
  var map = {};
  _.each(names, function (name) {
    var match = name.match(/^(.+?)(?:-(.+?)(?:\.js)?)?$/);
    var service = match[1], version = match[2];
    if (!map[service]) map[service] = [];
    if (version) map[service].push(version);
  });
  return map;
}

function parseServiceMap(services, callback) {
  if (!services) services = bundleHelpers.defaultServices;
  if (services.match(sanitizeRegex)) {
    return callback(new Error('Incorrectly formatted service names'));
  }
  services = services.split(',');

  var dir = path.join(bundleHelpers.root, 'services', 'api');
  fs.readdir(dir, function (err, files) {
    var diskMap = mapFromNames(files);
    if (services.length === 1 && services[0] === 'all') {
      return callback(null, diskMap); // all services
    }

    var givenMap = mapFromNames(services);
    var invalidModules = [];

    _.each(givenMap, function (versions, service) {
      if (!diskMap[service]) { // no such service
        invalidModules.push(service);
      } else if (versions.length === 0) { // take latest
        givenMap[service] = [diskMap[service][diskMap[service].length - 1]];
      } else { // validate all versions
        _.each(versions, function (version) {
          if (diskMap[service].indexOf(version) < 0) {
            invalidModules.push(service + '-' + version);
          }
        });
      }
    });

    if (invalidModules.length > 0) {
      callback(new Error('Missing modules: ' + invalidModules.join(', ')));
    } else {
      callback(null, givenMap);
    }
  });
}

function generateBundleFile(services, callback) {
  parseServiceMap(services, function (err, serviceMap) {
    if (err) return callback(err);

    var contents = ['var AWS = require("./core"); module.exports = AWS;'];

    _.each(serviceMap, function (versions, service) {
      _.each(versions, function (version) {
        var line = util.format(
          '%s(require("./services/%s"), "%s", require("./services/api/%s-%s"));',
          'AWS.Service.defineServiceApi', service, version, service, version);
        contents.push(line);
      });
    });

    callback(null, contents.join('\n'));
  });
}

module.exports = function(file, servicesPassed, callback) {
  var bundleData = null;
  var services = servicesPassed ? file :
    ('SERVICES' in process.env ? process.env.SERVICES : null);

  function makeBundle(callback) {
    if (bundleData) return callback();
    generateBundleFile(services, function (err, bundle) {
      if (err) {
        if (callback) callback(err);
        else throw err;
      }
      else {
        bundleData = bundle;
        if (callback) callback();
      }
    });
  }

  function transform(file) {
    if (file === bundleHelpers.mainFile) {
      var data = fs.readFileSync(bundleHelpers.browserFile);
      return through(function() {}, function() {
        this.queue(data); this.queue(null);
      });
    }

    if (file !== bundleHelpers.servicesFile) return through();

    function write() { }
    function end() {
      var self = this;
      makeBundle(function (err) {
        if (err) self.emit('error', err);
        else {
          self.queue(bundleData);
          self.queue(null);
        }
      });
    }

    return through(write, end);
  }

  if (!servicesPassed) {
    return transform(file);
  } else if (callback) {
    makeBundle(function (err) { callback(err, transform); });
  } else {
    return transform;
  }
};
