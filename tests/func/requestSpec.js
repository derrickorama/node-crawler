var fs = require('fs');
var http = require('http');
var https = require('https');
var pathlib = require('path');
var zlib = require('zlib');
var Crawler = require('../../crawler.js').Crawler;

describe('Crawler requests feature', function () {
  'use strict';

  var BASIC_LINK_PAGE = 'https://dl.dropboxusercontent.com/u/3531436/node-crawler-tests/basic-link-crawl.html';

  /*
  | Defaults
  */

  it('should have a default timeout of 60000', function () {
    var crawler = new Crawler();
    expect(crawler.timeout).toBe(60000);
  });

  it('should not use strict ssl by default', function () {
    var crawler = new Crawler();
    expect(crawler.strictSSL).toBe(false);
  });

  it('should have a default retries property of 0', function () {
    var crawler = new Crawler();
    expect(crawler.retries).toBe(0);
  });

  /*
  | Settings
  */

  it('should change the timeout of a request based on the timeout specified', function (done) {
    var crawler = new Crawler({
      timeout: 250,
      crawlExternal: true,
      onDrain: function () {
        var timeEnd = new Date();
        // Make sure the timing falls within .1 seconds of the timeout
        expect((timeEnd - timeStart) / 250).toBeLessThan(5);
        done();
      }
    });

    expect(crawler.timeout).toBe(250);

    var timeStart = new Date();
    crawler.queue('http://dropbox.com', true);
  });

  it('should allow you to turn on strict ssl', function (done) {
    var crawler = new Crawler({
      crawlExternal: true,
      onPageCrawl: function () {
        done();
      },
      strictSSL: true
    });
    expect(crawler.strictSSL).toBe(true);
    crawler.queue(BASIC_LINK_PAGE, true);
  });

  it('should change number of retries if specified', function () {
    var crawler = new Crawler({ retries: 1 });
    expect(crawler.retries).toBe(1);
  });

  /*
  | Actual request
  */

  it('does not download contents of non-text content-types', function (done) {
    var server = http.createServer(function(req, res) {
      var raw = fs.createReadStream(pathlib.join(__dirname, 'assets', 'pdf-sample.pdf'));
      res.writeHead(200, { 'content-type': 'application/pdf' });
      raw.pipe(res);
    }).listen(6767);
    var crawler = new Crawler({
      onPageCrawl: function (page) {
        expect(page.html).toBe('');
        server.close();
        done();
      }
    });
    crawler.queue('http://localhost:6767');
  });

  it('supports HTTPS urls', function (done) {
    var crawler = new Crawler({
      crawlExternal: true,
      onPageCrawl: function (page) {
        expect(page.url).toBe('https://www.google.com/');
        crawler.kill();
        done();
      }
    });

    crawler.queue('https://www.google.com');
  });

  it('supports gzip/deflating', function (done) {
    var server = http.createServer(function(req, res) {
      var raw = fs.createReadStream(pathlib.join(__dirname, 'assets', 'some.txt'));
      res.writeHead(200, { 'content-encoding': 'gzip', 'content-type': 'text/html' });
      raw.pipe(zlib.createGzip()).pipe(res);
    }).listen(6767);
    var crawler = new Crawler({
      onPageCrawl: function (page) {
        expect(page.html).toBe('some text');
        server.close();
        done();
      }
    });
    crawler.queue('http://localhost:6767');
  });

  it('tries different secure protocols when one fails', function (done) {
    var iteration = 0;

    var server = https.createServer({
      key: fs.readFileSync(pathlib.join(__dirname, '..', 'assets', 'server.key')),
      cert: fs.readFileSync(pathlib.join(__dirname, '..', 'assets', 'server.crt'))
    }, function(req, res) {
      if (iteration < 2) {
        res.writeHead(404);
        iteration++;
      } else {
        res.writeHead(200);
      }
      res.end('');
    }).listen(6767);

    spyOn(https, 'request').andCallThrough();

    var crawler = new Crawler({
      onError: function () {
        // This ends on an error
        expect(https.request.calls[0].args[0].secureProtocol).toEqual(undefined);
        expect(https.request.calls[1].args[0].secureProtocol).toEqual('TLSv1_client_method');
        expect(https.request.calls[2].args[0].secureProtocol).toEqual('SSLv3_client_method');
        server.close();
        done();
      }
    });
    crawler.queue('https://localhost:6767');
  });

  it('tries different secure protocols when timeout failures are encountered', function (done) {
    var server = https.createServer({
      key: fs.readFileSync(pathlib.join(__dirname, '..', 'assets', 'server.key')),
      cert: fs.readFileSync(pathlib.join(__dirname, '..', 'assets', 'server.crt'))
    }, function (req, res) {
      setTimeout(function () {
        res.end('');
      }, 150);
    }).listen(6767);

    spyOn(https, 'request').andCallThrough();

    var crawler = new Crawler({
      timeout: 100,
      onError: function () {
        // This ends on an error
        expect(https.request.calls[0].args[0].secureProtocol).toEqual(undefined);
        expect(https.request.calls[1].args[0].secureProtocol).toEqual('TLSv1_client_method');
        expect(https.request.calls[2].args[0].secureProtocol).toEqual('SSLv3_client_method');
        server.close();
        done();
      }
    });
    crawler.queue('https://localhost:6767');
  });

});
