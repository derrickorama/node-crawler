var pathlib = require('path');
var Crawler = require(pathlib.join(__dirname, '..', 'crawler')).Crawler;
var mockServer = require(pathlib.join(__dirname, 'mocks', 'server')).Server;

describe('link parsing', function () {

  var crawler;
  var server;

  beforeEach(function () {
    crawler = new Crawler();
    server = mockServer();
  });

  afterEach(function (done) {
    if (server.isClosed() === true) {
      return done();
    }
    server.stop(done);
  });

  it('queues relative links found on the page', function (done) {
    server.setBody('<a href="/page-1">some link</a>');
    crawler.start('http://localhost:8888');
    crawler.on('finish', function () {
      crawler.get('urlsCrawled').should.eql([
        'http://localhost:8888/',
        'http://localhost:8888/page-1'
      ]);
      done();
    });
  });

  it('queues the referrer', function (done) {
    server.setBody('<a href="/page-1">some link</a>');
    crawler.start('http://localhost:8888');
    crawler.on('pageCrawled', function (response) {
      if (response.url === 'http://localhost:8888/page-1') {
        response.referrer.should.equal('http://localhost:8888/');
        done();
      }
    });
  });

});
