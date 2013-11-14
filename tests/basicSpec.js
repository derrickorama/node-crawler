var _ = require('underscore');
var Crawler = require('../crawler.js').Crawler;

describe('Crawler', function () {

	it('should have a default timeout of 60000', function () {
		var crawler = new Crawler();
		expect(crawler.timeout).toBe(60000);
	});

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

});