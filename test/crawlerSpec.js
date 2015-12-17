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
      crawler.get('urlsQueued').should.eql([]);
      crawler.queue('http://www.domain.com');
      crawler.get('urlsQueued').should.eql(['http://www.domain.com/']);
    });

    it('strips a hash from the URL stored in queue', function () {
      crawler.queue('http://www.domain.com/#myhash');
      crawler.get('urlsQueued').should.eql(['http://www.domain.com/']);
    });

    it('does not queue URLs that are external when crawler is set not to crawl externals', function () {
      crawler.set('crawlExternal', false);
      crawler.queue('http://www.domain.com'); // first URL given is assumed to be the main site
      crawler.queue('http://www.external.com');
      crawler.get('urlsQueued').should.eql(['http://www.domain.com/']);
    });

    it('does not queue URLs that are already in the queue', function () {
      crawler.queue('http://www.domain.com');
      crawler.queue('http://www.domain.com/page-1');
      crawler.queue('http://www.domain.com/page-1');
      crawler.get('urlsQueued').should.eql(['http://www.domain.com/', 'http://www.domain.com/page-1']);
    });

    it('does not queue URLs that have already been crawled', function () {
      crawler.queue('http://www.domain.com');
      crawler.markCrawled('http://www.domain.com/page-1');
      crawler.queue('http://www.domain.com/page-1');
      crawler.queue('http://www.domain.com/page-2');
      crawler.get('urlsQueued').should.eql(['http://www.domain.com/', 'http://www.domain.com/page-2']);
    });

    it('does not queue URLs that match the exclude pattern', function () {
      crawler.set('excludes', [/.*cgi$/]);
      crawler.queue('http://www.domain.com/processing.cgi');
      crawler.get('urlsQueued').should.eql([]);
    });

    it('does not queue URLs with unsupported protocols', function (done) {
      crawler.start('http://localhost:8888');
      crawler.queue('mailto:email@gmail.com');
      crawler.queue('javascript:alert("hi")');
      crawler.queue('tel:1234567890');
      crawler.queue('file:////some-server/path');
      crawler.queue('ftp://domain.com/file');
      crawler.on('finish', function () {
        crawler.get('urlsCrawled').should.eql(['http://localhost:8888/']);
        done();
      });
    });

    it('does not queue URLs that do not have a host', function (done) {
      crawler.start('http://localhost:8888');
      crawler.queue('http://');
      crawler.on('finish', function () {
        crawler.get('urlsCrawled').should.eql(['http://localhost:8888/']);
        done();
      });
    });

  });

  describe('markCrawled method', function () {

    it('adds a page to the list of pages crawled', function () {
      crawler.markCrawled('http://www.domain.com/page-1');
      crawler.get('urlsCrawled').should.eql(['http://www.domain.com/page-1']);
    });

    it('does not add duplicate URLs', function () {
      crawler.markCrawled('http://www.domain.com/page-1');
      crawler.markCrawled('http://www.domain.com/page-1');
      crawler.get('urlsCrawled').should.eql(['http://www.domain.com/page-1']);
    });

  });

  describe('start', function () {

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

  describe('pageCrawled event', function () {

    it('is called whenever a page is processed', function (done) {
      var pagesProcessed = [];
      crawler.start('http://localhost:8888');
      crawler.queue('http://localhost:8888/page-1');
      crawler.queue('http://localhost:8888/page-2');
      crawler.on('pageCrawled', function (response) {
        pagesProcessed.push(response.url);
      });
      crawler.on('finish', function () {
        pagesProcessed.should.eql([
          'http://localhost:8888/',
          'http://localhost:8888/page-1',
          'http://localhost:8888/page-2'
        ]);
        done();
      });
    });

    it('includes the referrer in the response (if provided)', function (done) {
      crawler.start('http://localhost:8888');
      crawler.queue('http://localhost:8888/page-1', 'http://localhost:8888/');
      crawler.on('pageCrawled', function (response) {
        if (response.url === 'http://localhost:8888/page-1') {
          response.referrer.should.equal('http://localhost:8888/');
          done();
        }
      });
    });

    it('includes whether or not the URL is external', function (done) {
      var checksPassed = 0;
      var extServer = mockServer(8889);

      crawler.start('http://localhost:8888');
      crawler.queue('http://localhost:8888/page-1');
      crawler.queue('http://localhost:8889');
      crawler.on('pageCrawled', function (response) {
        if (response.url === 'http://localhost:8888/page-1') {
          response.isExternal.should.be.false;
          checksPassed++;
        }
        if (response.url === 'http://localhost:8889/') {
          response.isExternal.should.be.true;
          checksPassed++;
        }
      });
      crawler.on('finish', function () {
        extServer.stop();
        checksPassed.should.equal(2); // this tells us that the expectations were executed
        done();
      });
    });

    it('does not include the body of external links', function (done) {
      var checksPassed = 0;
      var extServer = mockServer(8889);
      extServer.setBody('I shouldn\'t be here.');

      crawler.start('http://localhost:8888');
      crawler.queue('http://localhost:8889');
      crawler.on('pageCrawled', function (response, body) {
        if (response.url === 'http://localhost:8889/') {
          body.should.equal('');
          checksPassed++;
        }
      });
      crawler.on('finish', function () {
        extServer.stop();
        checksPassed.should.equal(1); // this tells us that the expectations were executed
        done();
      });
    });

    it('does not include pages that return non-200 statuses', function (done) {
      server.onUrl('/page-1', function (req, res) {
        res.writeHead(404); // bad status
      });
      crawler.start('http://localhost:8888');
      crawler.queue('http://localhost:8888/page-1');
      crawler.on('pageCrawled', function (response) {
        response.statusCode.should.equal(200);
        response.url.should.equal('http://localhost:8888/');
      });
      crawler.on('finish', function () {
        done();
      });
    });

    it('does not include pages that throw errors', function (done) {
      server.stop();
      crawler.start('http://localhost:8888');
      crawler.queue('http://localhost:8888/page-1');
      crawler.on('pageCrawled', function (response) {
        response.statusCode.should.equal(200);
        response.url.should.equal(null);
      });
      crawler.on('finish', function () {
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
        crawler.get('urlsCrawled').should.eql([
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
        crawler.get('urlsCrawled').should.eql([
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

    it('does not call the pageCrawled event for redirected pages (if they\'ve already been processed)', function (done) {
      var pageCrawledHandler = sinon.spy();
      crawler.on('pageCrawled', pageCrawledHandler);
      crawler.start('http://localhost:8888');
      crawler.queue('http://localhost:8888/page-2');
      crawler.queue('http://localhost:8888/page-1');
      crawler.on('finish', function () {
        pageCrawledHandler.callCount.should.equal(2);
        done();
      });
    });

    it('calls the pageCrawled event for redirected pages if they have not been processed yet', function (done) {
      var pageCrawledHandler = sinon.spy();
      crawler.on('pageCrawled', pageCrawledHandler);
      crawler.start('http://localhost:8888');
      crawler.queue('http://localhost:8888/page-1');
      crawler.on('finish', function () {
        pageCrawledHandler.callCount.should.equal(2);
        done();
      });
    });

  });

  describe('error handling', function () {

    beforeEach(function () {
      // set retries to 0 so we fail immediately
      crawler.set('retries', 0);
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

  describe('link parsing', function () {

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

  describe('killing', function () {

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

});
