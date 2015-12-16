var pathlib = require('path');
var urllib = require('url');
var sinon = require('sinon');
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
    if (server.isClosed() === true) {
      return done();
    }
    server.stop(done);
  });

  describe('queueing', function () {

    beforeEach(function () {
      crawler.set('mainUrl', 'http://www.domain.com');
    });

    it('queues the URL to the list of URLs to crawl and normalizes the URL', function () {
      crawler._get('urlsQueued').should.eql([]);
      crawler.queue('http://www.domain.com');
      crawler._get('urlsQueued').should.eql(['http://www.domain.com/']);
    });

    it('strips a hash from the URL stored in queue', function () {
      crawler.queue('http://www.domain.com/#myhash');
      crawler._get('urlsQueued').should.eql(['http://www.domain.com/']);
    });

    it('does not queue URLs that are external when crawler is set not to crawl externals', function () {
      crawler.set('crawlExternal', false);
      crawler.queue('http://www.domain.com'); // first URL given is assumed to be the main site
      crawler.queue('http://www.external.com');
      crawler._get('urlsQueued').should.eql(['http://www.domain.com/']);
    });

    it('does not queue URLs that are already in the queue', function () {
      crawler.queue('http://www.domain.com');
      crawler.queue('http://www.domain.com/page-1');
      crawler.queue('http://www.domain.com/page-1');
      crawler._get('urlsQueued').should.eql(['http://www.domain.com/', 'http://www.domain.com/page-1']);
    });

    it('does not queue URLs that have already been crawled', function () {
      crawler.queue('http://www.domain.com');
      crawler.markCrawled('http://www.domain.com/page-1');
      crawler.queue('http://www.domain.com/page-1');
      crawler.queue('http://www.domain.com/page-2');
      crawler._get('urlsQueued').should.eql(['http://www.domain.com/', 'http://www.domain.com/page-2']);
    });

    it('does not queue URLs that match the exclude pattern', function () {
      crawler.set('excludes', [/.*cgi$/]);
      crawler.queue('http://www.domain.com/processing.cgi');
      crawler._get('urlsQueued').should.eql([]);
    });

  });

  describe('markCrawled method', function () {

    it('adds a page to the list of pages crawled', function () {
      crawler.markCrawled('http://www.domain.com/page-1');
      crawler._get('urlsCrawled').should.eql(['http://www.domain.com/page-1']);
    });

    it('does not add duplicate URLs', function () {
      crawler.markCrawled('http://www.domain.com/page-1');
      crawler.markCrawled('http://www.domain.com/page-1');
      crawler._get('urlsCrawled').should.eql(['http://www.domain.com/page-1']);
    });

  });

  describe('start', function () {

    it('crawls the first URL in the queue', function (done) {
      server.setBody('success!');
      crawler.start('http://localhost:8888');
      crawler.on('pageCrawled', function (error, response, body) {
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
      crawler.on('pageCrawled', function (error, response) {
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
        crawler._get('urlsCrawled').should.eql([
          'http://localhost:8888/', // starting URL
          'http://localhost:8888/page-1'
        ]);
        done();
      });
    });

  });

  describe('redirects', function () {

    beforeEach(function () {
      server.redirect('/page-1', '/page-2');
    });

    it('handles errors that do not return responses', function (done) {
      server.stop(); // this will throw an exception if unhandled for sure
      crawler.start('http://localhost:8888');
      crawler.on('finish', function () {
        done();
      });
    });

    it('adds the URL the page was redirected to to the list of URLs crawled', function (done) {
      crawler.start('http://localhost:8888');
      crawler.queue('http://localhost:8888/page-1');
      crawler.on('finish', function () {
        crawler._get('urlsCrawled').should.eql([
          'http://localhost:8888/', // starting URL
          'http://localhost:8888/page-1',
          'http://localhost:8888/page-2' // URL page-1 redirects to
        ]);
        done();
      });
    });

    it('does not add a URL that has already been crawled', function (done) {
      crawler.start('http://localhost:8888');
      crawler.queue('http://localhost:8888/page-1');
      crawler.queue('http://localhost:8888/page-2');
      crawler.on('finish', function () {
        crawler._get('urlsCrawled').should.eql([
          'http://localhost:8888/', // starting URL
          'http://localhost:8888/page-1',
          'http://localhost:8888/page-2' // URL page-1 redirects to
        ]);
        done();
      });
    });

    it('calls all "redirect" event handlers when a redirect occurs', function (done) {
      crawler.on('redirect', function (redirecteUrl, response) {
        redirecteUrl.should.equal('http://localhost:8888/page-1');
        response.url.should.equal('http://localhost:8888/page-2');
        done();
      });
      crawler.start('http://localhost:8888');
      crawler.queue('http://localhost:8888/page-1');
    });

    it('does not call "redirect" event handlers not called for non-redirects', function (done) {
      var redirectHandler = sinon.spy();
      crawler.on('redirect', redirectHandler);
      crawler.start('http://localhost:8888');
      crawler.queue('http://localhost:8888/page-1');
      crawler.on('finish', function () {
        redirectHandler.called.should.not.be.true;
        done();
      });
    });

  });

});
