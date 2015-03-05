var Crawler = require('../../crawler').Crawler;

describe('Crawler.isExternal method', function () {
  'use strict';

	var crawler;

	beforeEach(function () {
		crawler = new Crawler();
	});

	it('returns true when the domains of the two URLs do not match', function () {
		var result;

		result = crawler.isExternal('http://www.google.com/', 'http://www.windows.com/');
		expect(result).toBe(true);

		result = crawler.isExternal('http://google.com/', 'http://www.google.com/');
		expect(result).toBe(true);
	});

	it('returns true when the protocol of the two URLs do not match', function () {
		var result;

		result = crawler.isExternal('http://www.google.com/', 'https://www.google.com/');
		expect(result).toBe(true);

		result = crawler.isExternal('http://www.google.com/', 'ftp://www.google.com/');
		expect(result).toBe(true);
	});

	it('returns false when the domains and protocols of the two URLs match', function () {
		var result;

		result = crawler.isExternal('http://www.google.com/', 'http://www.google.com/');
		expect(result).toBe(false);

		result = crawler.isExternal('http://www.google.com/', 'http://www.google.com/some/page.html');
		expect(result).toBe(false);
	});

});
