var urllib = require('url');
var Crawler = require('../../crawler.js').Crawler;

/*
| _wasCrawled method
*/
describe('Crawler._wasCrawled method', function () {
	var crawler;

	beforeEach(function () {
		crawler = new Crawler();
	});

	it('exists', function () {
		expect(crawler._wasCrawled instanceof Function).toBe(true);
	});

	it('calls the parse method of the "url" module', function () {
		var parseSpy = spyOn(urllib, 'parse').andCallThrough();
		crawler._wasCrawled('http://www.google.com');
		expect(parseSpy).toHaveBeenCalledWith('http://www.google.com');
	});

	it('returns false if the URL doesn\'t exist in crawler._pages object', function () {
		var wasCrawled = crawler._wasCrawled('http://www.google.com');
		expect(wasCrawled).toBe(false);
	});

	it('returns true if the URL already exist in crawler._urlsCrawled property', function () {
		crawler._urlsCrawled = ['http://www.google.com/'];
		var wasCrawled = crawler._wasCrawled('http://www.google.com/');
		expect(wasCrawled).toBe(true);
	});

	it('considers non-strings as empty strings', function () {
		// Note: these would throw errors usuall
		crawler._wasCrawled(null);
		crawler._wasCrawled(undefined);
		crawler._wasCrawled(2);
		crawler._wasCrawled([]);
		crawler._wasCrawled({});
	});
	
});