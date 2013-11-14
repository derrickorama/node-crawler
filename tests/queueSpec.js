var _ = require('underscore');
var Crawler = require('../crawler.js').Crawler;

describe('Crawler queue', function () {

	var BASIC_LINK_PAGE = 'https://dl.dropboxusercontent.com/u/3531436/node-crawler-tests/basic-link-crawl.html',
		DENY_HEAD_METHOD_PAGE = 'https://dl.dropboxusercontent.com/u/3531436/node-crawler-tests/deny-head-method.html',
		EXTERNAL_URL_PAGE = 'https://dl.dropboxusercontent.com/u/3531436/node-crawler-tests/external-link-page.html',
		NON_PAGE_URLS_PAGE = 'https://dl.dropboxusercontent.com/u/3531436/node-crawler-tests/non-page-urls.html',
		RELATIVE_URL_PAGE = 'https://dl.dropboxusercontent.com/u/3531436/node-crawler-tests/relative-link-page.html';

	it('should allow you to specify whether or not to crawl URLs found on the page', function (done) {
		var pagesCrawled = 0;

		var crawler = new Crawler({
			onPageCrawl: function (response, data) {
				pagesCrawled++;
			},
			onDrain: function () {
				expect(pagesCrawled).toBe(1);
				done();
			}
		});

		crawler.queue('http://google.com', false);
	});

	it('should crawl a URL when one is queued', function (done) {
		var crawler = new Crawler({
			onPageCrawl: function (response, data) {
				expect(response.url).toBe('http://www.google.com/');
				done();
			}
		});
		crawler.queue('http://www.google.com', false);
	});

	it('should crawl all URLs that are queued', function (done) {
		var urlsCrawled = [];

		var crawler = new Crawler({
			onPageCrawl: function (response, data) {
				urlsCrawled.push(response.url);

				if (
					urlsCrawled.indexOf('http://www.google.com/') > -1 &&
					urlsCrawled.indexOf('http://www.bing.com/') > -1 &&
					urlsCrawled.indexOf('http://www.yahoo.com/') > -1 &&
					urlsCrawled.indexOf('http://www.findlaw.com/') > -1
				) {
					done();
				}
			}
		});

		crawler.queue('http://www.google.com', false);
		crawler.queue('http://www.bing.com', false);
		crawler.queue('http://www.yahoo.com', false);
		crawler.queue('http://www.findlaw.com', false);
	});

	it('should not queue already crawled URLs', function (done) {
		var pagesCrawled = 0;

		var crawler = new Crawler({
			onPageCrawl: function (response, data) {
				pagesCrawled++;
			},
			onDrain: function () {
				expect(pagesCrawled).toBe(1);
				done();
			}
		});

		crawler.queue('http://www.google.com', false);
		crawler.queue('http://www.google.com', false);
	});

	it('should consider URLs as the same URLs if they functionally point to the same resource', function (done) {
		var pagesCrawled = 0;

		var crawler = new Crawler({
			onPageCrawl: function (response, data) {
				pagesCrawled++;
			},
			onDrain: function () {
				expect(pagesCrawled).toBe(1);
				done();
			}
		});

		crawler.queue('http://www.google.com', false);
		crawler.queue('http://www.google.com/', false);
	});

	it('should support HTTPS urls', function (done) {
		var crawler = new Crawler({
			onPageCrawl: function (page) {
				expect(page.url).toBe(BASIC_LINK_PAGE);
				done();
			}
		});

		crawler.queue(BASIC_LINK_PAGE, false);
	});

	it('should find and crawl URLs found on the pages in the queue', function (done) {
		var pagesCrawled = 0;

		var crawler = new Crawler({
			onPageCrawl: function () {
				pagesCrawled++;
			},
			onDrain: function () {
				expect(pagesCrawled).toBe(2);
				done();
			}
		});

		crawler.queue(BASIC_LINK_PAGE);
	});

	it('should not crawl external URLs', function (done) {
		var pagesCrawled = 0;

		var crawler = new Crawler({
			onPageCrawl: function (response, data) {
				pagesCrawled++;
			},
			onDrain: function () {
				expect(pagesCrawled).toBe(1);
				done();
			}
		});

		crawler.queue(EXTERNAL_URL_PAGE);
	});

	it('should crawl relative URLs', function (done) {
		var pagesCrawled = 0;

		var crawler = new Crawler({
			onPageCrawl: function (response, data) {
				pagesCrawled++;
			},
			onDrain: function () {
				expect(pagesCrawled).toBe(4);
				done();
			}
		});

		crawler.queue(RELATIVE_URL_PAGE);
	});

	it('should try getting the HEAD of external links if specified to crawl external links', function (done) {
		var pagesCrawled = 0;

		var crawler = new Crawler({
			onPageCrawl: function (page, response) {
				pagesCrawled++;

				if (page.url.indexOf('google.com') > -1) {
					expect(response.req.method).toBe('HEAD');
				}
			},
			onDrain: function () {
				expect(pagesCrawled).toBe(3);
				done();
			},
			crawlExternal: true
		});

		crawler.queue(EXTERNAL_URL_PAGE);
	});

	it('should attempt a GET request if a HEAD request is rejected', function (done) {
		var pagesCrawled = 0;

		var crawler = new Crawler({
			onPageCrawl: function (page, response) {
				pagesCrawled++;
			},
			onDrain: function () {
				expect(pagesCrawled).toBe(2);
				done();
			},
			crawlExternal: true
		});

		crawler.queue(DENY_HEAD_METHOD_PAGE);
	});

	it('should ignore URLs if they are non-page URIs or hashes without a URL', function (done) {
		var pagesCrawled = 0;

		var crawler = new Crawler({
			onPageCrawl: function () {
				pagesCrawled++;
			},
			onError: function (page, response) {
				pagesCrawled++;
			},
			onDrain: function () {
				expect(pagesCrawled).toBe(1);
				done();
			},
			crawlExternal: true
		});

		crawler.queue(NON_PAGE_URLS_PAGE);
	});

});