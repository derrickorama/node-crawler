var pathlib = require('path');
var sinon = require('sinon');
var Crawler = require(pathlib.join(__dirname, '..', 'crawler')).Crawler;
var mockServer = require(pathlib.join(__dirname, 'mocks', 'server')).Server;

describe('error handling', function () {

  var crawler;
  var server;

  beforeEach(function () {
    crawler = new Crawler();
    server = mockServer();

    // set retries to 0 so we fail immediately
    crawler.set('retries', 0);
  });

  afterEach(function (done) {
    if (server.isClosed() === true) {
      return done();
    }
    server.stop(done);
  });

  it('calls the error event handlers when errors occur', function (done) {
    server.stop();
    crawler.start('http://localhost:8888');
    crawler.on('error', function (err) {
      err.code.should.equal('ECONNREFUSED');
      done();
    });
  });

  it('calls the error event handlers when a non-200 status code is encountered', function (done) {
    server.setStatusCode(400);
    server.setBody('blah');
    crawler.start('http://localhost:8888');
    crawler.on('error', function (err, response, body) {
      (err === null).should.be.true;
      response.statusCode.should.equal(400);
      body.should.equal('blah');
      done();
    });
  });

  it('does not call the error event handlers when a 200 status code is encountered', function (done) {
    var errorHandler = sinon.spy();
    server.setStatusCode(400);
    crawler.start('http://localhost:8888');
    crawler.on('error', errorHandler);
    crawler.on('finish', function () {
      errorHandler.called.should.be.false;
      done();
    });
  });

  it('adds the URL to the pages processed', function (done) {
    server.setStatusCode(400);
    crawler.start('http://localhost:8888');
    crawler.on('finish', function () {
      crawler.get('urlsCrawled').should.eql(['http://localhost:8888/']);
      done();
    });
  });

  it('retries a URL based on crawler\'s "retries" property', function (done) {
    var attempts = 0;

    server.onUrl('/', function (req, res) {
      res.writeHead(400);
      attempts++;
    });

    server.setStatusCode(400);
    crawler.set('retries', 2);
    crawler.start('http://localhost:8888');
    crawler.on('finish', function () {
      attempts.should.equal(3);
      done();
    });
  });

  it('includes the requested URL in the response', function (done) {
    server.setStatusCode(400);
    crawler.start('http://localhost:8888');
    crawler.on('error', function (err, response) {
      response.url.should.equal('http://localhost:8888/');
      done();
    });
  });

  it('includes the referrer in the response (if provided)', function (done) {
    server.setStatusCode(400);
    crawler.start('http://localhost:8888');
    crawler.queue('http://localhost:8888/page-1', 'http://localhost:8888/');
    crawler.on('error', function (err, response) {
      if (response.url === 'http://localhost:8888/page-1') {
        response.referrer.should.equal('http://localhost:8888/');
        done();
      }
    });
  });

});
