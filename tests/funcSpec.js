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