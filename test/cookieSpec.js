var pathlib = require('path');
var http = require('http');
var tough = require('tough-cookie');
var Crawler = require(pathlib.join(__dirname, '..', 'crawler')).Crawler;
var mockServer = require(pathlib.join(__dirname, 'mocks', 'server')).Server;

describe('cookie support', function () {

  var cookie;
  var server;

  beforeEach(function () {
    cookie = 'cookie=test';
    server = mockServer();

    server.onUrl('/make-cookie', function (req, res) {
      res.writeHead(301, {
        'Set-Cookie': cookie,
        'Content-Type': 'text/plain',
        'Location': '/show-cookie'
      });
      return http.STATUS_CODES[301] + '. Redirecting to show cookie';
    });

    server.onUrl('/show-cookie', function (req, res) {
      res.writeHead(200, {
        'Content-Type': 'text/plain'
      });
      return req.headers.cookie;
    });

  });

  afterEach(function (done) {
    if (server.isClosed() === true) {
      return done();
    }
    server.stop(done);
  });

  it('supports cookies by default', function (done) {
    var crawler = new Crawler();
    (crawler._get('cookie') instanceof tough.CookieJar).should.equal(true); // should.be.true doesn't work here
    crawler.start('http://localhost:8888');
    crawler.queue('http://localhost:8888/make-cookie');
    crawler.on('pageCrawled', function (response, body) {
      if (response.url === 'http://localhost:8888/show-cookie') {
        body.should.equal('cookie=test; Path=/');
        done();
      }
    });
  });

  it('allows you to turn off support for cookies', function (done) {
    var crawler = new Crawler({
      cookie: false
    });
    (crawler._get('cookie') instanceof tough.CookieJar).should.equal(false); // should.be.true doesn't work here
    crawler.start('http://localhost:8888');
    crawler.queue('http://localhost:8888/make-cookie');
    crawler.on('pageCrawled', function (response, body) {
      if (response.url === 'http://localhost:8888/show-cookie') {
        body.should.equal('');
        done();
      }
    });
  });


  it('ignores cookie parsing errors', function () {
    // This will throw an exception and kill the process if it's not handled
    var crawler = new Crawler();
    crawler.start('http://localhost:8888');
    cookie = 'AMA Publishing GroupMachineID=635368805209600916';
    crawler.queue('http://localhost:8888/make-cookie');
  });


  it('allows you to provide an existing cookie jar', function (done) {
    var cookieJar = new tough.CookieJar();

    cookieJar.setCookieSync('blah=yes', 'http://localhost:8888', {
      ignoreError: true
    });

    var crawler = new Crawler({
      cookie: cookieJar
    });

    crawler.start('http://localhost:8888');
    crawler.queue('http://localhost:8888/show-cookie');
    crawler.on('pageCrawled', function (response, body) {
      if (response.url === 'http://localhost:8888/show-cookie') {
        body.should.equal('blah=yes; Path=/');
        done();
      }
    });
  });

});
