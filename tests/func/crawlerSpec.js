var Crawler = require('../../crawler.js').Crawler;

describe('Crawler link crawling feature', function () {
  'use strict';

	var BASIC_LINK_PAGE = 'https://dl.dropboxusercontent.com/u/3531436/node-crawler-tests/basic-link-crawl.html',
		NON_PAGE_URLS_PAGE = 'https://dl.dropboxusercontent.com/u/3531436/node-crawler-tests/non-page-urls.html',
		EXTERNAL_URL_PAGE = 'https://dl.dropboxusercontent.com/u/3531436/node-crawler-tests/external-link-page.html',
		RELATIVE_URL_PAGE = 'https://dl.dropboxusercontent.com/u/3531436/node-crawler-tests/relative-link-page.html';

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
			onPageCrawl: function () {
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
			onPageCrawl: function () {
				pagesCrawled++;
			},
			onDrain: function () {
				expect(pagesCrawled).toBe(4);
				done();
			}
		});

		crawler.queue(RELATIVE_URL_PAGE);
	});

	it('should consider URLs that have a hash tag with an already crawled URLs as new pages', function (done) {
		var pagesCrawled = 0;

		var crawler = new Crawler({
			onPageCrawl: function () {
				pagesCrawled++;
			},
			onError: function () {
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

	/*
	| Content parsing
	*/

	it('should handle cheerio parsing errors', function (done) {
		// This should totally kill Jasmine if it's not handled
		var crawler = new Crawler({
			onDrain: function () {
				done();
			}
		});
		spyOn(console, 'log'); // Silence error
		crawler.queue('https://dl.dropboxusercontent.com/u/3531436/node-crawler-tests/non-page.txt', false);
	}, 10000);

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
			crawlExternal: true,
			onPageCrawl: function (page) {
				expect(page.dom().html()).toBe('');
			},
			onDrain: function () {
				done();
			}
		});
		crawler.queue('https://dl.dropboxusercontent.com/u/3531436/node-crawler-tests/blank.pdf', true);
	});

	describe('pattern exclusion', function () {

		it('does not crawl URLs based on a simple pattern', function (done) {
			var pagesCrawled = 0;

			var crawler = new Crawler({
				excludePatterns: ['/Section/Page.shtml'],
				onPageCrawl: function () {
					pagesCrawled++;
				},
				onDrain: function () {
					expect(pagesCrawled).toBe(1);
					done();
				}
			});

			spyOn(crawler, '_request').andCallFake(function (params, callback) {
				callback(null, { statusCode: 200, req: { method: 'GET' } }, '<a href="/Section/Page.shtml">page</a>');
			});
			crawler.queue('http://domain.com/A/Page.shtml');
		});

		it('does not crawl URLs based on a complex pattern', function (done) {
			var pagesCrawled = 0;

			var crawler = new Crawler({
				crawlExternal: true,
				excludePatterns: ['.*Page\\.shtml'],
				onPageCrawl: function () {
					pagesCrawled++;
				},
				onDrain: function () {
					expect(pagesCrawled).toBe(2);
					done();
				}
			});

			spyOn(crawler, '_request').andCallFake(function (params, callback) {
				callback(null, { statusCode: 200, headers: { 'content-type': 'text/html' }, req: { method: 'GET' } }, '<a href="/Section/Page.shtml">page</a><a href="http://www.google.com/Project.shtml">page</a>');
			});
			crawler.queue('http://domain.com/');
		});

		it('does not crawl URLs based on multiple patterns', function (done) {
			var pagesCrawled = 0;

			var crawler = new Crawler({
				crawlExternal: true,
				excludePatterns: ['/Page/One.shtml', '/Page/Two.shtml'],
				onPageCrawl: function () {
					pagesCrawled++;
				},
				onDrain: function () {
					expect(pagesCrawled).toBe(2);
					done();
				}
			});

			spyOn(crawler, '_request').andCallFake(function (params, callback) {
				callback(null, { statusCode: 200, headers: { 'content-type': 'text/html' }, req: { method: 'GET' } }, '<a href="/Page/One.shtml">page</a><a href="/Page/Two.shtml">page</a><a href="/Page/Three.shtml">page</a>');
			});
			crawler.queue('http://domain.com/');
		});

		it('does not affect URLs that do not match the pattern', function (done) {
			var pagesCrawled = 0;

			var crawler = new Crawler({
				crawlExternal: true,
				excludePatterns: ['/Page/One.shtml', '/Page/Two.shtml'],
				onPageCrawl: function (page) {
					pagesCrawled++;
					expect(page.url === 'http://domain.com/' || page.url === 'http://domain.com/I/dont/match.shtml').toBe(true);
				},
				onDrain: function () {
					expect(pagesCrawled).toBe(2);
					done();
				}
			});

			spyOn(crawler, '_request').andCallFake(function (params, callback) {
				callback(null, { statusCode: 200, headers: { 'content-type': 'text/html' }, req: { method: 'GET' } }, '<a href="/Page/One.shtml">page</a><a href="/Page/Two.shtml">page</a><a href="/I/dont/match.shtml">page</a>');
			});
			crawler.queue('http://domain.com/');
		});

	});

});
