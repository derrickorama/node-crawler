var _ = require('underscore');
var Crawler = require('../../crawler.js').Crawler;

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
				expect(response.request._jar.hasOwnProperty('_jar')).toBe(true);
				expect(response.request._jar._jar.hasOwnProperty('store')).toBe(true);
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