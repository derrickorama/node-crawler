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

	it('should not use strict ssl by default', function (done) {
		var crawler = new Crawler({
			onPageCrawl: function (page, response) {
				done();
			}
		});
		expect(crawler.strictSSL).toBe(false);
		crawler.queue(BASIC_LINK_PAGE, false);
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

	it('should allow you to turn on strict ssl', function (done) {
		var crawler = new Crawler({
			onPageCrawl: function (page, response) {
				done();
			},
			strictSSL: true
		});
		expect(crawler.strictSSL).toBe(true);
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

	it('should not retry a page if it does not fail and the number of retries is specified', function (done) {
		var requests = 0;

		var crawler = new Crawler({
			retries: 1,
			onDrain: function () {
				expect(requests).toBe(1);
				done();
			}
		});

		crawler._crawlPage = function () {
			requests++;
			Crawler.prototype._crawlPage.apply(crawler, arguments);
		};

		crawler.queue('http://dropbox.com/', false);
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

	it('should use the dummy user agent string by default for any request', function (done) {
		var crawler = new Crawler({
			onPageCrawl: function (page, response) {
				expect(response.request.headers['User-Agent']).toBe('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)');
				done();
			}
		});
		crawler.queue('http://dropbox.com', false);
	});

	it('should handle cheerio parsing errors', function (done) {
		// This should totally kill Jasmine if it's not handled
		var crawler = new Crawler({
			onDrain: function () {
				done();
			}
		});
		crawler.queue('https://dl.dropboxusercontent.com/u/3531436/node-crawler-tests/non-page.txt', false);
	});

	it('should set the MIME type for each type of page crawled', function (done) {
		var crawler = new Crawler({
			onPageCrawl: function (page) {
				if (page.url.match(/\.pdf$/gi) !== null) {
					expect(page.type).toBe('application/pdf');
				}
				if (page.url.match(/\.html$/gi) !== null) {
					expect(page.type).toBe('text/html');
				}
				if (page.url.match(/\.txt$/gi) !== null) {
					expect(page.type).toBe('text/plain');
				}
			},
			onDrain: function () {
				done();
			}
		});
		crawler.queue('https://dl.dropboxusercontent.com/u/3531436/node-crawler-tests/blank.pdf', false);
		crawler.queue('https://dl.dropboxusercontent.com/u/3531436/node-crawler-tests/basic-link-crawl.html', false);
		crawler.queue('https://dl.dropboxusercontent.com/u/3531436/node-crawler-tests/plain-text.txt', false);
	});

	it('should not try to parse (cheerio) non-text MIME types', function (done) {
		var crawler = new Crawler({
			onPageCrawl: function (page, response, pagesCrawled) {
				expect(page.$.html()).toBe('');
			},
			onDrain: function () {
				done();
			}
		});
		crawler.queue('https://dl.dropboxusercontent.com/u/3531436/node-crawler-tests/blank.pdf', false);
	});

	/*
	| Cookies
	*/

	it('should support cookies by default', function (done) {
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

	it('should allow you to turn off support for cookies', function (done) {
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