var pathlib = require('path');
var Crawler = require(pathlib.join(__dirname, '..', 'crawler')).Crawler;
var mockServer = require(pathlib.join(__dirname, 'mocks', 'server')).Server;

describe('queueing', function () {

  var crawler;
  var server;

  beforeEach(function () {
    crawler = new Crawler();
    server = mockServer();
    crawler.set('mainUrl', 'http://www.domain.com');
  });

  afterEach(function (done) {
    if (server.isClosed() === true) {
      return done();
    }
    server.stop(done);
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
    crawler._get('urlsCrawled').push('http://www.domain.com/page-1');
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
