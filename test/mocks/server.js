'use strict';

const http = require('http');

exports.Server = function (port) {
  const DEFAULT_PORT = 8888;
  const _delays = {};
  const _headers = {
    'Content-Type': 'text/plain'
  };
  const _redirects = [];
  const _requestHandlers = {
    all: []
  };
  let _body = 'OK';
  let _isClosed = false;
  let _statusCode = 200;

  const server = http.createServer((req, res) => {

    // Request handlers override all other features
    if (_requestHandlers.hasOwnProperty(req.url) === true) {
      _body = _requestHandlers[req.url].reduce((body, callback) => callback(req, res, body), _body);
    } else if (_requestHandlers.all.length > 0) {
      _body = _requestHandlers.all.reduce((body, callback) => callback(req, res, body), _body);
    } else {
      /*eslint no-lonely-if:0 */
      if (_redirects[req.url] !== undefined) {
        res.writeHead(_redirects[req.url].statusCode, {
          'Location': _redirects[req.url].toUrl
        });
      } else {
        res.writeHead(_statusCode, _headers);
      }
    }

    setTimeout(() => {
      if (_body !== false) {
        res.end(_body);
      }
    }, _delays[req.url] || 0);
  }).listen(port || DEFAULT_PORT);

  return {
    isClosed: () => {
      return _isClosed;
    },
    delay: (url, delay) => {
      _delays[url] = delay;
    },
    onUrl: (url, callback) => {
      if (_requestHandlers.hasOwnProperty(url) !== true) {
        _requestHandlers[url] = [];
      }
      _requestHandlers[url].push(callback);
    },
    onRequest: (callback) => {
      _requestHandlers.all.push(callback);
    },
    redirect: (fromUrl, toUrl, statusCode) => {
      if (statusCode === undefined) {
        statusCode = 301;
      }
      _redirects[fromUrl] = {
        toUrl,
        statusCode
      };
    },
    setBody: (body) => {
      _body = body;
    },
    setHeader: (name, value) => {
      _headers[name] = value;
    },
    setStatusCode: (statusCode) => {
      _statusCode = statusCode;
    },
    stop: (callback) => {
      server.close(callback);
      _isClosed = true;
    }
  };
};
