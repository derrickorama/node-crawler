var cheerio = require('cheerio');
var Page = require('../crawler.js').Page;

describe('Page.dom method', function () {
	var page;

	beforeEach(function () {
		page = new Page();
	});

	it('loads nothing when first cheerio load results in undefined (e.g. when an error occurs)', function () {
		var cheerioSpy = spyOn(cheerio, 'load').andReturn(undefined);
		page.dom();
		expect(cheerioSpy.calls.length).toBe(2);
		expect(cheerioSpy.calls[1].args[0]).toBe('');
	});
	
	describe('when page.type is a text file', function () {
		var consoleSpy;

		beforeEach(function () {
			consoleSpy = spyOn(console, 'log');
			page.type = 'text/html';
			page.html = '<html><body>my html</body></html>';
			page.url = 'http://www.google.com/';
		});
	
		it('loads page HTML via cheerio on HTML text files', function () {
			var cheerioSpy = spyOn(cheerio, 'load');
			page.dom();
			expect(cheerioSpy).toHaveBeenCalledWith(page.html);
		});
	
		it('loads page HTML via cheerio on plain text files', function () {
			page.type = 'text/plain';
			var cheerioSpy = spyOn(cheerio, 'load');
			page.dom();
			expect(cheerioSpy).toHaveBeenCalledWith(page.html);
		});

		it('returns the DOM from cheerio', function () {
			var cheerioSpy = spyOn(cheerio, 'load').andReturn('here\'s your DOM');
			var result = page.dom();
			expect(result).toBe('here\'s your DOM');
		});

		// Note: need to figure out how to test this
		// it('logs errors when loading page throws exceptions', function () {
		// page.dom();
		// expect(consoleSpy).toHaveBeenCalledWith('Cheerio parsing error: ' + page.url);
		// });
	
	});

	describe('when page.type is not a text file', function () {

		beforeEach(function () {
			page.type = 'application/zip';
		});
	
		it('loads an empty string', function () {
			var cheerioSpy = spyOn(cheerio, 'load');
			page.dom();
			expect(cheerioSpy.calls.length).toBe(1);
			expect(cheerioSpy).toHaveBeenCalledWith('');
		});

		it('returns the DOM from cheerio', function () {
			var cheerioSpy = spyOn(cheerio, 'load').andReturn('here\'s your DOM');
			var result = page.dom();
			expect(result).toBe('here\'s your DOM');
		});
	
	});

});