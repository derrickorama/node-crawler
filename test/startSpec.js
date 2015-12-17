var pathlib = require('path');
var urllib = require('url');
var Crawler = require(pathlib.join(__dirname, '..', 'crawler')).Crawler;
var mockServer = require(pathlib.join(__dirname, 'mocks', 'server')).Server;

describe('starting', function () {

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

  it('crawls the first URL in the queue', function (done) {
    server.setBody('success!');
    crawler.start('http://localhost:8888');
    crawler.on('pageCrawled', function (response, body) {
      response.url.should.eql('http://localhost:8888/');
      body.should.eql('success!');
      done();
    });
  });

  it('crawls all URLs in the queue', function (done) {
    var pagesCrawled = [];

    crawler.start('http://localhost:8888');
    crawler.queue('http://localhost:8888/page-1');
    crawler.queue('http://localhost:8888/page-2');
    crawler.on('pageCrawled', function (response) {
      pagesCrawled.push(response.url);
    });
    crawler.on('finish', function () {
      pagesCrawled.should.eql([
        'http://localhost:8888/',
        'http://localhost:8888/page-1',
        'http://localhost:8888/page-2'
      ]);
      done();
    });
  });

  it('sets the "_mainUrl"', function (done) {
    crawler.start('http://localhost:8888');
    crawler.on('finish', function () {
      crawler._get('mainUrl').should.eql(urllib.parse('http://localhost:8888'));
      done();
    });
  });

  it('adds the URL to the list of URls crawled', function (done) {
    crawler.start('http://localhost:8888');
    crawler.queue('http://localhost:8888/page-1');
    crawler.on('finish', function () {
      crawler.get('urlsCrawled').should.eql([
        'http://localhost:8888/', // starting URL
        'http://localhost:8888/page-1'
      ]);
      done();
    });
  });

});
