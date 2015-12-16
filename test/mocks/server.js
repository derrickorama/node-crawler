exports.Server = function () {
  var http = require('http');
  var _body = 'OK';
  var _headers = {
    'Content-Type': 'text/plain'
  };
  var _isClosed = false;
  var _redirects = [];
  var _statusCode = 200;

  var server = http.createServer(function (req, res) {
    'use strict';

    if (_redirects[req.url] !== undefined) {
      res.writeHead(_redirects[req.url].statusCode, {
        'Location': _redirects[req.url].toUrl
      });
    } else {
      res.writeHead(_statusCode, _headers);
    }

    res.end(_body);
  }).listen(8888);

  return {
    isClosed: function () {
      return _isClosed;
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
