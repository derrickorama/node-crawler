var http = require('http');
var Crawler = require('../../crawler.js').Crawler;

describe('Crawler requests feature', function () {
  'use strict';

  var crawler;
  var mockRequest;
  var mockResponse;

  beforeEach(function () {
    crawler = new Crawler();
    mockRequest = {
        abort: jasmine.createSpy('request.abort'),
        end: jasmine.createSpy('request.end'),
        on: jasmine.createSpy('request.on')
    };
    mockResponse = {
        headers: {},
        statusCode: 200,
        on: jasmine.createSpy('response.on')
    };

    spyOn(http, 'request');

  });

  it('uses basic authentication if crawler.auth contains credentials (only on re-request)', function (done) {
    mockResponse = {
        headers: {},
        statusCode: 401,
        on: jasmine.createSpy('response.on')
    };

    http.request.andCallFake(function (params, callback) {
      setTimeout(function () {
        // Only accept request when auth is present
        if (params.headers.Authorization !== '') {
          mockResponse.statusCode = 200;
          callback(mockResponse);
          return false;
        }

        callback(mockResponse);
      }, 10);
      return mockRequest;
    });

    crawler = new Crawler({
      auth: {
        username: 'user',
        password: 'pass'
      },
      onPageCrawl: function () {
        expect(http.request.calls[0].args[0].headers.Authorization).toBe('');
        expect(http.request.calls[1].args[0].headers.Authorization).toBe('Basic ' + new Buffer('user:pass').toString('base64'));
        done();
      }
    });
    crawler.queue('http://www.google.com/', false);
  });

  it('does not use authentication on external links', function (done) {
    var mainResponse = {
        headers: {
          'content-type': 'text/html'
        },
        statusCode: 200,
        on: function (event, callback) {
          setTimeout(function () {
            if (event === 'data') {
              callback(new Buffer('<a href="http://domain.com"></a>'));
              return false;
            }
            callback('');
          });
        }
    };

    mockResponse = {
        headers: {},
        statusCode: 401,
        on: jasmine.createSpy('response.on')
    };

    http.request.andCallFake(function (params, callback) {
      setTimeout(function () {
        // Handle internal page
        if (params.host === 'www.google.com') {
          callback(mainResponse);
          return false;
        }

        // Handle external page
        console.log(params.headers.Authorization);
        expect(params.headers.Authorization).toBe('');
        callback(mockResponse);
      }, 10);
      return mockRequest;
    });

    crawler = new Crawler({
      crawlExternal: true,
      auth: {
        username: 'user',
        password: 'pass'
      },
      onPageCrawl: function () {},
      onError: function () {
        expect(http.request.calls[1].args[0].headers.Authorization).toBe('');
        done();
      }
    });
    crawler.queue('http://www.google.com/', true);
  });

});
