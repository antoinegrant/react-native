/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 */
'use strict';

var ReactPackager = require('./react-packager');
var blacklist = require('./blacklist.js');
var connect = require('connect');
var http = require('http');
var launchEditor = require('./launchEditor.js');
var parseCommandLine = require('./parseCommandLine.js');
var path = require('path');

var options = parseCommandLine([{
  command: 'port',
  default: 8081,
}]);

if (!options.projectRoot) {
  options.projectRoot = path.resolve(__dirname, '..');
}

console.log('\n' +
' ===============================================================\n' +
' |  Running packager on port ' + options.port +          '.       \n' +
' |  Keep this packager running while developing on any JS         \n' +
' |  projects. Feel free to close this tab and run your own      \n' +
' |  packager instance if you prefer.                              \n' +
' |                                                              \n' +
' |     https://github.com/facebook/react-native                 \n' +
' |                                                              \n' +
' ===============================================================\n'
);

process.on('uncaughtException', function(e) {
  console.error(e);
  console.error(e.stack);
  console.error('\n  >>> ERROR: could not create packager - please shut down ' +
                'any existing instances that are already running.\n\n');
});

runServer(options, function() {
  console.log('\nReact packager ready.\n');
});

function loadRawBody(req, res, next) {
  req.rawBody = '';
  req.setEncoding('utf8');

  req.on('data', function(chunk) {
    req.rawBody += chunk;
  });

  req.on('end', function() {
    next();
  });
}

function openStackFrameInEditor(req, res, next) {
  if (req.url === '/open-stack-frame') {
    var frame = JSON.parse(req.rawBody);
    launchEditor(frame.file, frame.lineNumber);
    res.end('OK');
  } else {
    next();
  }
}

function getAppMiddleware(options) {
  return ReactPackager.catalystMiddleware({
    dev: true,
    projectRoot: options.projectRoot,
    blacklistRE: blacklist(false),
    cacheVersion: '2',
    polyfillModuleNames: [
      path.resolve(__dirname, 'polyfill/console.js'),
      path.resolve(__dirname, 'polyfill/error-guard.js'),
    ]
  });
}

function runServer(
  options, /* {string projectRoot, bool web, bool dev} */
  readyCallback
) {
  var app = connect()
    .use(loadRawBody)
    .use(openStackFrameInEditor)
    .use(getAppMiddleware(options))
    .use(connect.static(options.projectRoot))
    .use(connect.logger())
    .use(connect.compress())
    .use(connect.errorHandler());

  return http.createServer(app).listen(options.port, readyCallback);
}
