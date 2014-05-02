var _ = require('underscore');
var Crawler = require('../../crawler.js').Crawler;

describe('Crawler initialization', function () {

	it('should have an empty pagesCrawled object by default', function () {
		var crawler = new Crawler();
		expect(_.keys(crawler._pages).length).toBe(0);
	});

	it('should not crawl external URLs by default', function () {
		var crawler = new Crawler();
		expect(crawler._crawlExternal).toBe(false);
	});

	it('should not be "killed" by default', function () {
		var crawler = new Crawler();
		expect(crawler._killed).toBe(false);
	});

	it('should set a timeout if one is provided during init', function () {
		var crawler = new Crawler({ timeout: 1000 });
		expect(crawler.timeout).toBe(1000);
	});

	it('sets excludePatterns to an empty array by default', function () {
		var crawler = new Crawler();
		expect(crawler.excludePatterns).toEqual([]);
	});

	it('sets "excludePatterns" to the supplied "excludePatterns" value', function () {
		var crawler = new Crawler({ excludePatterns: ['/some/pattern.*'] });
		expect(crawler.excludePatterns).toEqual(['/some/pattern.*']);
	});

	it('sets "render" to false by default', function () {
		var crawler = new Crawler();
		expect(crawler.render).toBe(false);
	});

	it('sets "render" to the supplied "render" value', function () {
		var crawler = new Crawler({ render: true });
		expect(crawler.render).toBe(true);
	});

});