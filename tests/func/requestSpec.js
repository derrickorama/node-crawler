var http = require('http');
var Crawler = require('../../crawler.js').Crawler;

describe('Crawler requests feature', function () {

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
			timeout: 1000,
			crawlExternal: true,
			onDrain: function () {
				var timeEnd = new Date();
				// Make sure the timing falls within .1 seconds of the timeout
				expect((timeEnd - timeStart)/1000).toBeLessThan(5);
				done();
			}
		});
		
		expect(crawler.timeout).toBe(1000);

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

		var crawler = new Crawler({
			onPageCrawl: function (page) {
				expect(page.html).toBe('');
			},
			onDrain: function () {
				done();
			}
		});

		spyOn(crawler, '_request').andCallFake(function (params, callback) {
			callback(null, {
				type: 'application/pdf'
			}, 'some body');
		});

		crawler.queue('http://domain.com');
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

	it('follows redirects', function (done) {
		
		var crawler = new Crawler({
			onPageCrawl: function (page) {
				expect(page.url).toBe('http://localhost:6767/final');
			},
			onDrain: function () {
				server.close();
				done();
			}
		});

		var server = http.createServer(function (req, res) {
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
            res.end(responseBody);
        }).listen(6767);

		crawler.queue('http://localhost:6767/redirect');

	});

});