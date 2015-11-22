exports.Server = function () {
  var http = require('http');
  var _body = 'OK';

  var server = http.createServer(function (req, res) {
    'use strict';
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(_body);
  }).listen(8888);

  return {
    setBody: function (body) {
      _body = body;
    },
    stop: function (callback) {
      server.close(callback);
    }
  }
};
