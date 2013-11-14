var _ = require('underscore');
var Crawler = require('../crawler.js').Crawler;

describe('Crawler', function () {

	var NON_200_PAGE = 'https://dl.dropboxusercontent.com/u/3531436/node-crawler-tests/page-with-404s.html';

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

	it('should execute onPageCrawl when a page is crawled', function (done) {
		var crawler = new Crawler({
			onPageCrawl: function () {
				done();
			}
		});
		crawler.queue('http://google.com', false);
	});

	it('should include the Page object and the response in the onPageCrawl callback', function (done) {
		var crawler = new Crawler({
			onPageCrawl: function (page, response) {
				expect(page.url).toBe('http://google.com/');
				expect(response.req.method).toBe('GET');
				done();
			}
		});
		crawler.queue('http://google.com', false);
	});

	it('should execute onDrain when the crawler is finished', function (done) {
		var pagesCrawled = 0;

		var crawler = new Crawler({
			onPageCrawl: function () {
				pagesCrawled++;
			},
			onDrain: function () {
				expect(pagesCrawled).toBeGreaterThan(0);
				done();
			}
		});
		crawler.queue('http://google.com', false);
	});

	it('should not pass non 200 status code pages to onPageCrawl method', function (done) {
		var pagesCrawled = 0;

		var crawler = new Crawler({
			onPageCrawl: function (page, response) {
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

	it('should pass non 200 status code pages to onError method', function (done) {
		var pagesCrawled = 0;

		var crawler = new Crawler({
			onError: function (page, response) {
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

	it('should pass the page, error, and response to onError method when an error occurs', function (done) {
		var crawler = new Crawler({
			onError: function (page, error, response) {
				expect(page.url).toBe('avascript:/');
				expect(error.message).toBe('Invalid URI "avascript:/"');
				expect(_.isObject(response)).toBe(true);
				expect(_.keys(response).length).toBe(0);
			},
			onDrain: function () {
				done();
			},
			crawlExternal: true
		});

		crawler.queue('avascript:/');
	});

	it('should pass any crawler errors to onError method', function (done) {
		var pagesCrawled = 0;

		var crawler = new Crawler({
			onError: function (page, response) {
				pagesCrawled++;
			},
			onDrain: function () {
				expect(pagesCrawled).toBe(1);
				done();
			},
			crawlExternal: true
		});

		crawler.queue('avascript:/');
	});

});