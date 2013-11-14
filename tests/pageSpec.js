var _ = require('underscore');
var Page = require('../crawler.js').Page;

describe('Crawler page', function () {

	it('should set the url to "" by default', function () {
		var page = new Page();
		expect(page.url).toBe('');
	});

	it('should set the html to "" by default', function () {
		var page = new Page();
		expect(page.html).toBe('');
	});

	it('should have an empty DOM by default', function () {
		var page = new Page();
		expect(page.$.hasOwnProperty('_root')).toBe(true);
	});

	it('should have an empty array of links by default', function () {
		var page = new Page();
		expect(_.isArray(page.links)).toBe(true);
		expect(page.links.length).toBe(0);
	});

	it('should allow you to set a url property', function () {
		var page = new Page('http://www.google.com/');
		expect(page.url).toBe('http://www.google.com/');
	});

	it('should parse the URL for each page to break it up into separate components', function () {
		var page = new Page('http://www.google.com/');
		expect(page.urlData.protocol).toBe('http:');
		expect(page.urlData.host).toBe('www.google.com');
		expect(page.urlData.hostname).toBe('www.google.com');
		expect(page.urlData.pathname).toBe('/');
		expect(page.urlData.path).toBe('/');
		expect(page.urlData.href).toBe('http://www.google.com/');
	});

	it('should allow you to set the HTML of a page', function () {
		var page = new Page('http://www.google.com/');
		page.setHTML('<html></html>');
		expect(page.html).toBe('<html></html>');
	});

	it('should load the HTML into a DOM-like environment (like jQuery)', function () {
		var page = new Page('http://www.google.com/');
		page.setHTML('<html><div id="myID">the text</div></html>');
		expect(_.isObject(page.$)).toBe(true);
		expect(page.$('#myID').length).toBe(1);
	});

	it('should gracefully handle DOM parsing errors', function () {
		var page = new Page('http://www.google.com/');
		page.setHTML('$$&($#*(#*$@($</html><div><div>');
	});

	it('should save all links on a page', function () {
		var page = new Page('http://www.google.com/');
		page.setHTML('<a href="http://google.com">link</a>');

		expect(page.links.length).toBe(1);
		expect(page.links.indexOf('http://google.com/')).toBeGreaterThan(-1);
	});

	it('should clear all links when new HTML is set', function () {
		var page = new Page('http://www.google.com/');

		page.setHTML('<a href="http://google.com">link</a>');
		page.setHTML('<a href="http://google.com">link</a>');

		expect(page.links.length).toBe(1);
		expect(page.links.indexOf('http://google.com/')).toBeGreaterThan(-1);
	});

});