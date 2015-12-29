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

  it('uses no headers by default', function (done) {
    var requestGet = request.get;
    sinon.stub(request, 'get', requestGet);
    var crawler = new Crawler();
    crawler.on('finish', function () {
      (request.get.args[0][0].headers === undefined).should.equal(true);
      request.get.restore();
      done();
    });
    crawler.start('http://localhost:8888');
  });

  it('allows you to set request headers', function (done) {
    var requestGet = request.get;
    sinon.stub(request, 'get', requestGet);
    var crawler = new Crawler({
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Encoding': 'gzip, sdch',
        'Accept-Language': 'en-US,en;q=0.8',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2272.76 Safari/537.36',
        'PageSpeed': 'off'
      }
    });
    crawler.on('finish', function () {
      request.get.args[0][0].headers.should.eql({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Encoding': 'gzip, sdch',
        'Accept-Language': 'en-US,en;q=0.8',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2272.76 Safari/537.36',
        'PageSpeed': 'off'
      });
      request.get.restore();
      done();
    });
    crawler.start('http://localhost:8888');
  });

});
