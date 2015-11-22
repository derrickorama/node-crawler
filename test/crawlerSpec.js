var pathlib = require('path');
var Crawler = require(pathlib.join(__dirname, '..', 'crawler')).Crawler;
var mockServer = require(pathlib.join(__dirname, 'mocks', 'server')).Server;

describe('Crawler class', function () {

  var crawler;
  var server;

  beforeEach(function () {
    crawler = new Crawler();
    server = mockServer();
  });

  afterEach(function (done) {
    server.stop(done);
  });

  describe('queueing', function () {

    it('queues the URL to the list of URLs to crawl and normalizes the URL', function () {
      crawler.queued().should.eql([]);
      crawler.queue('http://www.domain.com');
      crawler.queued().should.eql(['http://www.domain.com/']);
    });

    it('strips a hash from the URL stored in queue', function () {
      crawler.queue('http://www.domain.com/#myhash');
      crawler.queued().should.eql(['http://www.domain.com/']);
    });

    it('does not queue URLs that are external when crawler is set not to crawl externals', function () {
      crawler.crawlExternal(false);
      crawler.queue('http://www.domain.com'); // first URL given is assumed to be the main site
      crawler.queue('http://www.external.com');
      crawler.queued().should.eql(['http://www.domain.com/']);
    });

    it('does not queue URLs that are already in the queue', function () {
      crawler.queue('http://www.domain.com');
      crawler.queue('http://www.domain.com/page-1');
      crawler.queue('http://www.domain.com/page-1');
      crawler.queued().should.eql(['http://www.domain.com/', 'http://www.domain.com/page-1']);
    });

    it('does not queue URLs that have already been crawled', function () {
      crawler.queue('http://www.domain.com');
      crawler.markCrawled('http://www.domain.com/page-1');
      crawler.queue('http://www.domain.com/page-1');
      crawler.queue('http://www.domain.com/page-2');
      crawler.queued().should.eql(['http://www.domain.com/', 'http://www.domain.com/page-2']);
    });

    it('does not queue URLs that match the exclude pattern', function () {
      crawler.excludes([/.*cgi$/]);
      crawler.queue('http://www.domain.com/processing.cgi');
      crawler.queued().should.eql([]);
    });

  });

  describe('markCrawled method', function () {

    it('adds a page to the list of pages crawled', function () {
      crawler.markCrawled('http://www.domain.com/page-1');
      crawler.getCrawled().should.eql(['http://www.domain.com/page-1']);
    });

    it('does not add duplicate URLs', function () {
      crawler.markCrawled('http://www.domain.com/page-1');
      crawler.markCrawled('http://www.domain.com/page-1');
      crawler.getCrawled().should.eql(['http://www.domain.com/page-1']);
    });

  });

  describe('start', function () {

    it('crawls the first URL in the queue', function (done) {
      server.setBody('success!');
      crawler.queue('http://localhost:8888');
      crawler.start();
      crawler.on('pageCrawled', function (error, response, body) {
        response.url.should.eql('http://localhost:8888/');
        body.should.eql('success!');
        done();
      });
    });

    it('crawls all URLs in the queue', function (done) {
      var pagesCrawled = [];

      crawler.queue('http://localhost:8888');
      crawler.queue('http://localhost:8888/page-1');
      crawler.queue('http://localhost:8888/page-2');
      crawler.start();
      crawler.on('pageCrawled', function (error, response, body) {
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

  });

});
