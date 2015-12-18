var pathlib = require('path');
var sinon = require('sinon');
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

  it('stops crawler from adding any URLs to the Queue when kill is issue before a response is received', function (done) {
    server.onUrl('/', function (req, res) {
      res.writeHead(200, {
        'Content-Type': 'text/html'
      });
      return '<a href="/page-1">Page 1</a><a href="/page-2">Page 2</a><a href="/page-3">Page 3</a>';
    });

    // Watch response
    var onResponse = crawler._onResponse;
    sinon.stub(crawler, '_onResponse', function () {
      crawler.kill(); // kill after first page response is received

      // Run onResponse like usual
      onResponse.apply(this, [].slice.call(arguments, 0));

      // Wait a moment to make sure nothing else gets through
      setTimeout(function () {
        crawler.get('urlsCrawled').should.eql(['http://localhost:8888/']);
        done();
      }, 50);
    });

    crawler.start('http://localhost:8888');
  });

});
