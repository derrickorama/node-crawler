var http = require('http');
var winston = require('winston');
var Crawler = require('../../crawler.js').Crawler;

describe('Crawler callbacks feature', function () {

	var NON_200_PAGE = 'https://dl.dropboxusercontent.com/u/3531436/node-crawler-tests/page-with-404s.html';

	var mockResponse = function (params, callback) {
		callback(null, { statusCode: 200, req: { method: 'GET' } }, '');
	};

	var mockFailResponse = function (params, callback) {
		callback(null, { statusCode: 400, req: { method: 'GET' } }, '');
	};

	beforeEach(function () {
		spyOn(winston, 'error'); // silence winston
	});

	/*
	| Defaults
	*/

	it('should have an empty onPageCrawl function by default', function () {
		var crawler = new Crawler();
		expect(crawler.onPageCrawl.toString()).toBe('function () {}');
	});

	it('should have an empty onDrain function by default', function () {
		var crawler = new Crawler();
		expect(crawler.onDrain.toString()).toBe('function () {}');
	});

	it('should have an empty onError function by default', function () {
		var crawler = new Crawler();
		expect(crawler.onError.toString()).toBe('function () {}');
	});

	it('should have an empty onRedirect function by default', function () {
		var crawler = new Crawler();
		expect(crawler.onRedirect.toString()).toBe('function () {}');
	});

	/*
	| Settings
	*/

	it('should accept an onPageCrawl callback', function () {
		var crawler = new Crawler({
			onPageCrawl: function () {
				return true;
			}
		});

		expect(crawler.onPageCrawl()).toBe(true);
	});

	it('should accept an onDrain callback', function () {
		var crawler = new Crawler({
			onDrain: function () {
				return true;
			}
		});

		expect(crawler.onDrain()).toBe(true);
	});

	it('should accept an onError callback', function () {
		var crawler = new Crawler({
			onError: function () {
				return true;
			}
		});

		expect(crawler.onError()).toBe(true);
	});

	it('should accept an onRedirect callback', function () {
		var crawler = new Crawler({
			onRedirect: function () {
				return true;
			}
		});

		expect(crawler.onRedirect()).toBe(true);
	});

	/*
	| Callback execution
	*/

	it('should execute onPageCrawl when a page is crawled', function (done) {
		var crawler = new Crawler({
			onPageCrawl: function () {
				done();
			}
		});
		spyOn(crawler, '_request').andCallFake(mockResponse);
		crawler.queue('http://google.com', false);
	});

	it('should execute onDrain when the crawler is finished', function (done) {
		var pagesCrawled = 0;

		var crawler = new Crawler({
			crawlExternal: true,
			onPageCrawl: function () {
				pagesCrawled++;
			},
			onDrain: function () {
				expect(pagesCrawled).toBeGreaterThan(0);
				done();
			}
		});

		spyOn(crawler, '_request').andCallFake(mockResponse);
		crawler.queue('http://www.google.com', true);
	});

	it('should not send non 200 status code pages to onPageCrawl method', function (done) {
		var pagesCrawled = 0;

		var crawler = new Crawler({
			onPageCrawl: function () {
				pagesCrawled++;
			},
			onDrain: function () {
				expect(pagesCrawled).toBe(0);
				done();
			},
			crawlExternal: true
		});

		spyOn(crawler, '_request').andCallFake(mockFailResponse);
		crawler.queue('http://badpage.com/');
	});

	it('should send non 200 status code pages to onError method', function (done) {
		var pagesCrawled = 0;

		var crawler = new Crawler({
			onError: function () {
				pagesCrawled++;
			},
			onDrain: function () {
				expect(pagesCrawled).toBe(1);
				done();
			},
			crawlExternal: true
		});

		crawler.queue(NON_200_PAGE);
	});

	it('should send any crawler errors to onError method', function (done) {
		var pagesCrawled = 0;

		var crawler = new Crawler({
			onError: function () {
				pagesCrawled++;
			},
			onDrain: function () {
				expect(pagesCrawled).toBe(1);
				done();
			},
			crawlExternal: true
		});

		spyOn(crawler, '_request').andCallFake(function (params, callback) {
			callback('error!', undefined, undefined);
		});

		crawler.queue('http://domain.com/whatev');
	});

	it('does not consider parse errors on external URLs as errors if there\'s a content-length header and the status code is 200', function (done) {
		var pagesCrawled = 0;
		var server;

		var crawler = new Crawler({
			onPageCrawl: function (page) {
				pagesCrawled++;
			},
			onError: function (page, error) {
				console.log(error);
				console.log('Parse error not caught!');
			},
			onDrain: function () {
				expect(pagesCrawled).toBe(2);
				server.close();
				done();
			},
			crawlExternal: true
		});

		// Mock request
		var realRequest = crawler._request;
		var mockRequest = function (params, callback) {
			if (params.url === 'http://domain.com/') {
				callback(null, { statusCode: 200, headers: { 'content-type': 'text/html' } }, '<a href="http://localhost:6767/">external link</a>');
			} else {
				realRequest(params, callback);
			}
		};
		crawler._request = mockRequest;

		server = http.createServer(function (req, res) {
			res.writeHead(200, { 'Content-Length': '4', 'Content-Type': 'text/html' });
			res.end('<a href="/bad-link">link</a>');
		}).listen(6767);

		crawler.queue('http://domain.com/');

	});

	/*
	| Callback parameters
	*/

	it('should include the Page object and the response in the onPageCrawl callback', function (done) {
		var crawler = new Crawler({
			onPageCrawl: function (page, response) {
				expect(page.url).toBe('http://www.yahoo.com/');
				expect(response.req.method).toBe('GET');
				done();
			}
		});

		// Fake response
		spyOn(crawler, '_request').andCallFake(mockResponse);
		crawler.queue('http://www.yahoo.com', false);
	});

	it('should pass response data to onError method when non 200 status message errors occur', function (done) {
		var crawler = new Crawler({
			onError: function (page, error, response) {
				expect(error).toBe(null);
				expect(response.req.method).toBe('GET');
			},
			onDrain: function () {
				done();
			},
			crawlExternal: true
		});

		crawler.queue(NON_200_PAGE);
	});

	it('passes the page, error, and response to onError method when an error occurs', function (done) {
		var crawler = new Crawler({
			onError: function (page, error, response) {
				expect(page.url).toBe('avascript:/');
				expect(error.message).toBe('Protocol:avascript: not supported.');
				expect(response).toEqual({ req: {} });
			},
			onDrain: function () {
				done();
			},
			crawlExternal: true
		});

		crawler.queue('avascript:/');
	});

});