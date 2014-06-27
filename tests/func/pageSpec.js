var _ = require('underscore');
var Page = require('../../crawler.js').Page;

describe('Crawler page', function () {

	/*
	| URL setting
	*/

	it('should parse the URL for each page to break it up into separate components', function () {
		var page = new Page('http://www.google.com/');
		expect(page.urlData.protocol).toBe('http:');
		expect(page.urlData.host).toBe('www.google.com');
		expect(page.urlData.hostname).toBe('www.google.com');
		expect(page.urlData.pathname).toBe('/');
		expect(page.urlData.path).toBe('/');
		expect(page.urlData.href).toBe('http://www.google.com/');
	});

	it('should not include the hash when setting a URL', function () {
		var page = new Page('http://www.google.com/#hash');
		expect(page.url).toBe('http://www.google.com/');
		expect(page.urlData.hash).toBe('#hash');
	});

	/*
	| HTML setting
	*/

	it('should allow you to set the HTML of a page', function () {
		var page = new Page('http://www.google.com/');
		page.setHTML('<html></html>');
		expect(page.html).toBe('<html></html>');
	});

	it('should load the HTML into a DOM-like environment (like jQuery)', function () {
		var page = new Page('http://www.google.com/');
		page.type = 'text/html';
		page.setHTML('<html><div id="myID">the text</div></html>');
		expect(_.isObject(page.dom())).toBe(true);
		expect(page.dom()('#myID').length).toBe(1);
	});

	it('should gracefully handle DOM parsing errors', function () {
		var page = new Page('http://www.google.com/');
		page.setHTML('$$&($#*(#*$@($</html><div><div>');
	});

	/*
	| Link parsing
	*/

	it('should clear all links when new HTML is set', function () {
		var page = new Page('http://www.google.com/');
		page.type = 'text/html';

		page.setHTML('<a href="http://google.com">link</a>');
		page.setHTML('<a href="http://google.com">link</a>');

		expect(page.links.length).toBe(1);
		expect(page.links.indexOf('http://google.com/')).toBeGreaterThan(-1);
	});

	it('should save all links on a page', function () {
		var page = new Page('http://www.google.com/');
		page.type = 'text/html';
		page.setHTML('<a href="http://google.com">link</a>');

		expect(page.links.length).toBe(1);
		expect(page.links.indexOf('http://google.com/')).toBeGreaterThan(-1);
	});

	it('should save relative links as a full, resolved path', function () {
		var page = new Page('http://www.google.com/');
		page.type = 'text/html';
		page.setHTML('<a href="/I-am-relative">link</a>');
		expect(page.links.length).toBe(1);
		expect(page.links.indexOf('http://www.google.com/I-am-relative')).toBeGreaterThan(-1);

		page = new Page('http://www.google.com/section/');
		page.type = 'text/html';
		page.setHTML('<a href="I-am-relative">link</a>');
		expect(page.links.length).toBe(1);
		expect(page.links.indexOf('http://www.google.com/section/I-am-relative')).toBeGreaterThan(-1);

		page = new Page('http://www.google.com/sibling');
		page.type = 'text/html';
		page.setHTML('<a href="I-am-relative">link</a>');
		expect(page.links.length).toBe(1);
		expect(page.links.indexOf('http://www.google.com/I-am-relative')).toBeGreaterThan(-1);
	});

});