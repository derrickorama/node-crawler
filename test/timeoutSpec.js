var pathlib = require('path');
var Crawler = require(pathlib.join(__dirname, '..', 'crawler')).Crawler;
var mockServer = require(pathlib.join(__dirname, 'mocks', 'server')).Server;

describe('timeout handling', function () {

  var crawler;
  var server;

  beforeEach(function () {
    crawler = new Crawler({
      timeout: 10
    });
    server = mockServer();
    server.delay('/', 5000);
  });

  afterEach(function (done) {
    if (server.isClosed() === true) {
      return done();
    }
    server.stop(done);
  });

  it('allows you to set a timeout', function (done) {
    crawler.start('http://localhost:8888');
    crawler.on('finish', function () {
      // crawler will not finish before this test fails
      done();
    });
  });

  it('throws an ESOCKETTIMEDOUT error', function (done) {
    crawler.start('http://localhost:8888');
    crawler.on('error', function (error) {
      error.code.should.equal('ESOCKETTIMEDOUT');
      error.message.should.equal('Request timed out.');
      done();
    });
  });

});
