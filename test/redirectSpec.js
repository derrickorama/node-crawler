var pathlib = require('path');
var sinon = require('sinon');
var Crawler = require(pathlib.join(__dirname, '..', 'crawler')).Crawler;
var mockServer = require(pathlib.join(__dirname, 'mocks', 'server')).Server;

describe('redirect event', function () {

  var crawler;
  var server;

  beforeEach(function () {
    crawler = new Crawler();
    server = mockServer();
    server.redirect('/page-1', '/page-2');
  });

  afterEach(function (done) {
    if (server.isClosed() === true) {
      return done();
    }
    server.stop(done);
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

  it('includes the redirect in the response', function (done) {
    crawler.on('pageCrawled', function (response) {
      if (response.url === 'http://localhost:8888/page-2') {
        response.redirect.should.equal('http://localhost:8888/page-1');
        done();
      }
    });
    crawler.start('http://localhost:8888');
    crawler.queue('http://localhost:8888/page-1');
  });

});
