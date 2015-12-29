exports.Server = function (port) {
  var http = require('http');
  var _body = 'OK';
  var _delays = {};
  var _headers = {
    'Content-Type': 'text/plain'
  };
  var _isClosed = false;
  var _redirects = [];
  var _requestHandlers = {};
  var _statusCode = 200;

  var server = http.createServer(function (req, res) {
    'use strict';

    // Request handlers override all other features
    if (_requestHandlers.hasOwnProperty(req.url) === true) {
      _body = _requestHandlers[req.url].reduce((body, callback) => (callback(req, res, body)), _body);
    } else {
      if (_redirects[req.url] !== undefined) {
        res.writeHead(_redirects[req.url].statusCode, {
          'Location': _redirects[req.url].toUrl
        });
      } else {
        res.writeHead(_statusCode, _headers);
      }
    }

    setTimeout(function () {
      if (_body !== false) {
        res.end(_body);
      }
    }, _delays[req.url] || 0);
  }).listen(port || 8888);

  return {
    isClosed: function () {
      return _isClosed;
    },
    delay: function (url, delay) {
      _delays[url] = delay;
    },
    onUrl: function (url, callback) {
      if (_requestHandlers.hasOwnProperty(url) !== true) {
        _requestHandlers[url] = [];
      }
      _requestHandlers[url].push(callback);
    },
    redirect: function (fromUrl, toUrl, statusCode) {
      if (statusCode === undefined) {
        statusCode = 301;
      }
      _redirects[fromUrl] = {
        toUrl: toUrl,
        statusCode: statusCode
      };
    },
    setBody: function (body) {
      _body = body;
    },
    setHeader: function (name, value) {
      _headers[name] = value;
    },
    setStatusCode: function (statusCode) {
      _statusCode = statusCode;
    },
    stop: function (callback) {
      server.close(callback);
      _isClosed = true;
    }
  }
};
