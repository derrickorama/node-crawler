var _ = require('underscore');
var Crawler = require('../../crawler.js').Crawler;

describe('Crawler queue', function () {

	var mockResponse = function (params, callback) {
		callback(null, { statusCode: 200, req: { method: 'GET' } }, '');
	};

	it('should crawl a URL when one is queued', function (done) {
		var crawler = new Crawler({
			onPageCrawl: function (response) {
				expect(response.url).toBe('http://www.google.com/');
				done();
			}
		});
		spyOn(crawler, '_request').andCallFake(mockResponse);
		crawler.queue('http://www.google.com', false);
	});

	it('should allow you to stop the crawl at any point (emptying queue and not processing any responses)', function (done) {
		var pagesCrawled = 0;

		var crawler = new Crawler({
			onPageCrawl: function () {
				pagesCrawled++;
			},
			onDrain: function () {
				expect(pagesCrawled).toBe(0);
				done();
			}
		});
		crawler.queue('https://dropbox.com');

		setTimeout(function () {
			pagesCrawled = 0;
			crawler.kill();
		}, 500);
	});

});

describe('Crawler cookie support', function () {

	var BASIC_LINK_PAGE = 'https://dl.dropboxusercontent.com/u/3531436/node-crawler-tests/basic-link-crawl.html';

	/*
	| Cookies
	*/

	it('supports cookies by default', function (done) {
		var crawler = new Crawler({
			crawlExternal: true,
			onPageCrawl: function (page, response) {
				expect(_.isObject(response.request._jar)).toBe(true);
				expect(response.request._jar.hasOwnProperty('cookies')).toBe(true);
				done();
			}
		});
		expect(crawler.acceptCookies).toBe(true);
		crawler.queue('http://www.yahoo.com/', true);
	});

	it('allows you to turn off support for cookies', function (done) {
		var crawler = new Crawler({
			crawlExternal: true,
			onPageCrawl: function (page, response) {
				expect(response.request._jar).toBe(false);
				done();
			},
			acceptCookies: false
		});
		expect(crawler.acceptCookies).toBe(false);
		crawler.queue(BASIC_LINK_PAGE, true);
	});

describe('Requests', function () {

	it('should support HTTPS urls', function (done) {
		var crawler = new Crawler({
			crawlExternal: true,
			onPageCrawl: function (page) {
				expect(page.url).toBe(BASIC_LINK_PAGE);
				done();
			}
		});

		crawler.queue(BASIC_LINK_PAGE, true);
	});

});

});