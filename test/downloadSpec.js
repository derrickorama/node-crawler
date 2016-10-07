var fs = require('fs');
var pathlib = require('path');
var zlib = require('zlib');
var request = require('request');
var sinon = require('sinon');
var Crawler = require(pathlib.join(__dirname, '..', 'crawler')).Crawler;
var mockServer = require(pathlib.join(__dirname, 'mocks', 'server')).Server;

describe('request headers', function () {

  var server;

  beforeEach(function () {
    server = mockServer();
  });

  afterEach(function (done) {
    if (server.isClosed() === true) {
      return done();
    }
    server.stop(done);
  });

  it('does not download non-text documents', function (done) {
    server.onUrl('/', function (req, res) {
      res.writeHead(200, {
        'Content-Type': 'image/jpeg'
      });
      return 'better not download me!';
    });
    var crawler = new Crawler();
    crawler.on('pageCrawled', function (response, body) {
      body.should.equal('');
      done();
    });
    crawler.start('http://localhost:8888');
  });

  it('does not download based on provided paths (ignoring content type)', function (done) {
    server.onUrl('/', requestHandler);
    server.onUrl('/file.jpg', requestHandler);
    server.onUrl('/file.gif', requestHandler);
    server.onUrl('/file.png', requestHandler);
    function requestHandler(req, res) {
      res.writeHead(200, {
        'Content-Type': 'text/plain'
      });
      return 'I have content!';
    }

    var crawler = new Crawler({
      doNotDownload: [/\.(?:jpg|gif|png)$/]
    });
    crawler.on('pageCrawled', function (response, body) {
      if (response.url.indexOf('file') > -1) {
        body.should.equal('');
      } else {
        body.should.equal('I have content!');
      }
    });
    crawler.on('finish', function () {
      done();
    });
    crawler.start('http://localhost:8888');
    crawler.queue('http://localhost:8888/file.jpg');
    crawler.queue('http://localhost:8888/file.gif');
    crawler.queue('http://localhost:8888/file.png');
  });

  it('does not download based on provided paths when cache busting is enabled', (done) => {
    const NOT_AN_INDEX = -1;

    const crawler = new Crawler({
      cacheBust: true,
      doNotDownload: [/\.jpg$/]
    });
    crawler.on('pageCrawled', (response, body) => {
      if (response.url.indexOf('file') === NOT_AN_INDEX) {
        body.should.equal('OK');
      } else {
        body.should.equal('');
      }
    });
    crawler.on('finish', () => {
      done();
    });
    crawler.start('http://localhost:8888');
    crawler.queue('http://localhost:8888/file.jpg');
  });

  it('can decode gzipped data', (done) => {
    server.onUrl('/', (req, res) => {
      var raw = fs.createReadStream(pathlib.join(__dirname, 'mocks', 'some-text.txt'));
      res.writeHead(200, { 'content-encoding': 'gzip', 'content-type': 'text/html' });
      raw.pipe(zlib.createGzip()).pipe(res);
      return false;
    });

    var crawler = new Crawler();
    crawler.on('pageCrawled', function (response, body) {
      body.should.equal('some text');
      done();
    });
    crawler.start('http://localhost:8888');
  });

});
