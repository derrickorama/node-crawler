var pathlib = require('path');
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
    server.onUrl('/file.jpg', requestHandler);
    server.onUrl('/file.gif', requestHandler);
    server.onUrl('/file.png', requestHandler);
    function requestHandler(req, res) {
      res.writeHead(200, {
        'Content-Type': 'text/plain'
      });
      return 'better not download me!';
    }

    var crawler = new Crawler({
      doNotDownload: [/\.(?:jpg|gif|png)$/]
    });
    crawler.on('pageCrawled', function (response, body) {
      body.should.equal('');
      done();
    });
    crawler.start('http://localhost:8888/file.jpg');
    crawler.queue('http://localhost:8888/file.gif');
    crawler.queue('http://localhost:8888/file.png');
  });

});
