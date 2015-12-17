var pathlib = require('path');
var Crawler = require(pathlib.join(__dirname, '..', 'crawler')).Crawler;
var mockServer = require(pathlib.join(__dirname, 'mocks', 'server')).Server;

describe('crawl killing', function () {

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

  it('clears the URL queue', function (done) {
    crawler.start('http://localhost:8888');
    crawler.queue('http://localhost:8888/page-1');
    crawler.queue('http://localhost:8888/page-2');

    crawler.on('pageCrawled', function () {
      crawler.kill(); // kill after first page crawled
    });

    crawler.on('finish', function () {
      crawler.get('urlsCrawled').should.eql(['http://localhost:8888/']);
      done();
    });
  });

});
