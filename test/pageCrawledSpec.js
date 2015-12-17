var pathlib = require('path');
var Crawler = require(pathlib.join(__dirname, '..', 'crawler')).Crawler;
var mockServer = require(pathlib.join(__dirname, 'mocks', 'server')).Server;

describe('pageCrawled event', function () {

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
