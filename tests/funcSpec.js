var _ = require('underscore');
var Crawler = require('../crawler.js').Crawler;

describe('Crawler queue', function () {

	it('should crawl a URL when one is queued', function (done) {
		var crawler = new Crawler({
			onPageCrawl: function (response, data) {
				expect(response.url).toBe('http://www.google.com/');
				done();
			}
		});
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
			onPageCrawl: function (page, response) {
				expect(_.isObject(response.request._jar)).toBe(true);
				expect(response.request._jar.hasOwnProperty('cookies')).toBe(true);
				done();
			}
		});
		expect(crawler.acceptCookies).toBe(true);
		crawler.queue('http://www.yahoo.com/', false);
	});

	it('allows you to turn off support for cookies', function (done) {
		var crawler = new Crawler({
			onPageCrawl: function (page, response) {
				expect(response.request._jar).toBe(false);
				done();
			},
			acceptCookies: false
		});
		expect(crawler.acceptCookies).toBe(false);
		crawler.queue(BASIC_LINK_PAGE, false);
	});

});