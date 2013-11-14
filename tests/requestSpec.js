var _ = require('underscore');
var Crawler = require('../crawler.js').Crawler;

describe('Crawler', function () {

	var BASIC_LINK_PAGE = 'https://dl.dropboxusercontent.com/u/3531436/node-crawler-tests/basic-link-crawl.html',
		DENY_HEAD_METHOD_PAGE = 'https://dl.dropboxusercontent.com/u/3531436/node-crawler-tests/deny-head-method.html',
		EXTERNAL_URL_PAGE = 'https://dl.dropboxusercontent.com/u/3531436/node-crawler-tests/external-link-page.html',
		NON_PAGE_URLS_PAGE = 'https://dl.dropboxusercontent.com/u/3531436/node-crawler-tests/non-page-urls.html',
		RELATIVE_URL_PAGE = 'https://dl.dropboxusercontent.com/u/3531436/node-crawler-tests/relative-link-page.html';

	it('should have a default timeout of 60000', function () {
		var crawler = new Crawler();
		expect(crawler.timeout).toBe(60000);
	});

	it('should change the timeout of a request based on the timeout specified', function (done) {
		var crawler = new Crawler({
			timeout: 1,
			onDrain: function () {
				var timeEnd = new Date();
				// Make sure the timing falls within .1 seconds of the timeout
				expect((timeEnd - timeStart)/1000).toBeCloseTo(0, 1);
				done();
			}
		});
		
		expect(crawler.timeout).toBe(1);

		var timeStart = new Date();
		crawler.queue('http://dropbox.com', false);
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

	it('should have a default retries property of 0', function () {
		var crawler = new Crawler();
		expect(crawler.retries).toBe(0);
	});

	it('should change number of retries if specified', function () {
		var crawler = new Crawler({ retries: 1 });
		expect(crawler.retries).toBe(1);
	});

	it('should retry a failed page if it fails and the number of retries is specified', function (done) {
		var requests = 0;

		var crawler = new Crawler({
			retries: 1,
			onDrain: function () {
				expect(requests).toBe(2);
				done();
			}
		});

		crawler._crawlPage = function () {
			requests++;
			Crawler.prototype._crawlPage.apply(crawler, arguments);
		};

		crawler.queue('http://dropbox.com/trololololo', false);
	});

});