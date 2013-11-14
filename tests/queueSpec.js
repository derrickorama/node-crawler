var Crawler = require('../crawler.js').Crawler;

describe('Crawler queue', function () {

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
		crawler.queue('http://dropbox.com');

		setTimeout(function () {
			pagesCrawled = 0;
			crawler.kill();
		}, 500);
	});

});