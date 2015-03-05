var Crawler = require('../../crawler.js').Crawler;

describe('Crawler queue', function () {
  'use strict';

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
		crawler.queue('http://www.google.com', null, false);
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
