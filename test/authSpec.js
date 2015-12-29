var http = require('http');
var pathlib = require('path');
var sinon = require('sinon');
var Crawler = require(pathlib.join(__dirname, '..', 'crawler')).Crawler;
var mockServer = require(pathlib.join(__dirname, 'mocks', 'server')).Server;

describe('authentication support', function () {

  var server;

  beforeEach(function () {
    server = mockServer();
  });

  afterEach(function (done) {
    if (server.isClosed() === true) {
      return done();
    }
    server.stop(done);
  });

  it('uses basic authentication if crawler\'s "auth" property contains credentials', function (done) {
    var crawler = new Crawler({
      auth: {
        username: 'user',
        password: 'pass'
      }
    });
    crawler.start('http://localhost:8888/');
    server.onUrl('/', function (req, res) {
      if (!req.headers.authorization) {
        res.writeHead(401, {
          'WWW-Authenticate': 'Basic Auth' // this is required for the authentication to work
        });
        return 'Nope.';
      }
    });
    crawler.on('pageCrawled', function () {
      done(); // this indicates that the request was successful and the authentication worked
    });
    crawler.on('error', function (error, response) {
      response.statusCode.should.equal(200);
    });
  });

  it('uses only uses basic authentication if first request failed', function (done) {
    var crawler = new Crawler({
      auth: {
        username: 'user',
        password: 'pass'
      }
    });

    var httpRequest = http.request;
    sinon.stub(http, 'request', httpRequest);

    crawler.start('http://localhost:8888/');
    server.onUrl('/', function (req, res) {
      if (!req.headers.authorization) {
        res.writeHead(401, {
          'WWW-Authenticate': 'Basic Auth' // this is required for the authentication to work
        });
        return 'Nope.';
      }
    });
    crawler.on('finish', function () {
      http.request.callCount.should.equal(2);
      http.request.restore();
      done();
    });
  });

  it('does not use authentication on external links', function (done) {
    var extServer = mockServer(8889);
    var crawler = new Crawler({
      auth: {
        username: 'user',
        password: 'pass'
      }
    });
    crawler.start('http://localhost:8888/');
    crawler.queue('http://localhost:8889/');
    extServer.onUrl('/', function (req, res) {
      if (!req.headers.authorization) {
        res.writeHead(401, {
          'WWW-Authenticate': 'Basic Auth' // this is required for the authentication to work
        });
        return 'Nope.';
      }
    });
    crawler.on('pageCrawled', function (response) {
      if (response.url === 'http://localhost:8889/') {
        response.statusCode.should.equal(401); // authentication should not be used
      }
    });
    crawler.on('error', function (error, response) {
      response.statusCode.should.equal(401); // error should be encountered since we're not using authentication
      extServer.stop();
      done();
    });
  });

  it('does not try to re-authenticate after a failure', function (done) {
    var crawler = new Crawler({
      auth: {
        username: 'user',
        password: 'pass'
      }
    });
    crawler.start('http://localhost:8888/');
    server.onUrl('/', function (req, res) {
      // Request will always fail
      res.writeHead(401, {
        'WWW-Authenticate': 'Basic Auth' // this is required for the authentication to work
      });
      return 'Nope.';
    });
    crawler.on('error', function (error, response) {
      response.statusCode.should.equal(401);
      done();
    });
  });

});