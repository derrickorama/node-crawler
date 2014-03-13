var urllib = require('url');
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

	it('should use the dummy user agent string by default for any request', function (done) {
		var crawler = new Crawler({
			crawlExternal: true,
			onPageCrawl: function (page, response) {
				expect(response.request.headers['User-Agent']).toBe('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/33.0.1750.149 Safari/537.36');
				done();
			}
		});

		crawler.queue('https://dropbox.com', true);
	});

	/*
	| Settings
	*/

	it('should change the timeout of a request based on the timeout specified', function (done) {
		var crawler = new Crawler({
			timeout: 1,
			crawlExternal: true,
			onDrain: function () {
				var timeEnd = new Date();
				// Make sure the timing falls within .1 seconds of the timeout
				expect((timeEnd - timeStart)/1000).toBeCloseTo(0, 1);
				done();
			}
		});
		
		expect(crawler.timeout).toBe(1);

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

});