var http = require('http');
var winston = require('winston');
var Crawler = require('../../crawler.js').Crawler;

describe('Crawler redirects', function () {
  'use strict';

  var server;

  beforeEach(function (done) {
    server = http.createServer(function (req, res) {
      var status = 200;
      var responseBody = '';
      res.setHeader('Content-Type', 'text/html');

      if (req.url.indexOf('/redirect') > -1) {
        status = 301;
        responseBody = http.STATUS_CODES[status] + '. Redirecting to /final';
        res.setHeader('Content-Type', 'text/plain');

        // Respond
        res.statusCode = status;
        res.setHeader('Location', '/final');
      }

      if (req.url.indexOf('/redirect-timeout') > -1) {
        setTimeout(function () {
          res.setHeader('Location', '/final-timeout');
          res.end(responseBody);
        }, 250);
        return;
      }

      if (req.url.indexOf('/final-timeout') > -1) {
        setTimeout(function () {
          res.end(responseBody);
        }, 250);
        return;
      }

      if (req.url.indexOf('/redirect-infinite') > -1) {
        res.setHeader('Location', '/redirect-infinite');
      }

      res.end(responseBody);
    }).listen(6767, done);
  });

  afterEach(function () {
    server.close();
  });

  it('follows redirects', function (done) {
    var crawler = new Crawler({
      onPageCrawl: function (page) {
        expect(page.url).toBe('http://localhost:6767/final');
      },
      onDrain: function () {
        done();
      }
    });
    crawler.queue('http://localhost:6767/redirect');
  });

  it('resets crawler timeout', function (done) {
    var crawler = new Crawler({
      onPageCrawl: function (page) {
        expect(page.url).toBe('http://localhost:6767/final-timeout');
      },
      onDrain: function () {
        done();
      },
      timeout: 450
    });
    crawler.queue('http://localhost:6767/redirect-timeout');
  });

  it('throws error if crawler is redirected > 9 times', function (done) {
    spyOn(winston, 'error'); // silence winston
    var crawler = new Crawler({
      onPageCrawl: function (page) {
        expect(page.url).not.toBe('http://localhost:6767/redirect-infinite');
      },
      onError: function (page, error) {
        expect(page.url).toBe('http://localhost:6767/redirect-infinite');
        expect(error.code).toBe('MAX_REDIRECTS_REACHED');
      },
      onDrain: function () {
        done();
      },
      timeout: 450
    });
    crawler.queue('http://localhost:6767/redirect-infinite');
  });

});
