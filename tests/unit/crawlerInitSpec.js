var async = require('async');
var _ = require('underscore');
var Crawler = require('../../crawler.js').Crawler;

describe('Crawler initialization', function () {

	beforeEach(function () {
		spyOn(async, 'queue').andReturn({});
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

	it('sets "workers" to 4 by default', function () {
		var crawler = new Crawler();
		expect(crawler.workers).toBe(4);
	});

	it('sets "workers" to the supplied "workers" value', function () {
		var crawler = new Crawler({ workers: 6 });
		expect(crawler.workers).toBe(6);
	});

	it('supplies async.queue with the # of workers specified', function () {
		new Crawler({ workers: 6 });
		expect(async.queue).toHaveBeenCalledWith(jasmine.any(Function), 6);
	});

	it('sets "auth" property to false by default', function () {
		var crawler = new Crawler();
		expect(crawler.auth).toBe(false);
	});

	it('sets "auth" property to supplied "auth" value', function () {
		var auth = { username: 'user', password: 'pass' };
		var crawler = new Crawler({ auth: auth });
		expect(crawler.auth).toBe(auth);
	});

});