'use strict';

const pathlib = require('path');
const urllib = require('url');
const request = require('request');
const sinon = require('sinon');
const Crawler = require(pathlib.join(__dirname, '..', 'crawler')).Crawler;
const mockServer = require(pathlib.join(__dirname, 'mocks', 'server')).Server;

const HTTP_STATUS_OK = 200;

describe('cache busting', () => {

  let server;

  beforeEach(() => {
    server = mockServer();
  });

  afterEach((done) => {
    if (server.isClosed() === true) {
      return done();
    }
    server.stop(done);
  });

  it('requests a URL with an appended query string', (done) => {
    const crawler = new Crawler({
      cacheBust: true
    });
    server.onRequest((req, res) => {
      req.url.should.match(new RegExp(`\\?${crawler.get('CACHE_BUST_PREFIX')}\\d+`));
      res.writeHead(HTTP_STATUS_OK);
      done();
      return 'ok';
    });
    crawler.start('http://localhost:8888');
  });

  it('strips the cache busting query string from response URL', (done) => {
    server.onUrl('/', (req, res) => {
      res.writeHead(HTTP_STATUS_OK);
      return 'ok';
    });
    const crawler = new Crawler({
      cacheBust: true
    });
    crawler.on('pageCrawled', (response) => {
      response.url.should.equal('http://localhost:8888/');
      done();
    });
    crawler.start('http://localhost:8888');
  });

  it('handles URLs that already have a query string', (done) => {
    const crawler = new Crawler({
      cacheBust: true
    });
    server.onRequest((req, res) => {
      req.url.should.match(new RegExp(`\\?myparam=1&${crawler.get('CACHE_BUST_PREFIX')}\\d+`));
      res.writeHead(HTTP_STATUS_OK);
      done();
      return 'ok';
    });
    crawler.start('http://localhost:8888/?myparam=1');
  });

  it('does not use cache busting against external URLs', (done) => {
    const crawler = new Crawler({
      cacheBust: true
    });
    server.onRequest((req, res) => {
      res.writeHead(HTTP_STATUS_OK);
      return '<a href="http://localhost:9999">link</a>';
    });

    const requestGet = request.get;
    sinon.stub(request, 'get', requestGet);
    crawler.on('finish', () => {
      request.get.args.forEach((params) => {
        const urlData = urllib.parse(params[0].url);
        if (urlData.port === '9999') {
          (urlData.query === null).should.equal(true);
        }
      });
      request.get.restore();
      done();
    });
    crawler.start('http://localhost:8888/?myparam=1');
  });

});
