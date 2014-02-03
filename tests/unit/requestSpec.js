var request = require('request');
var Crawler = require('../../crawler.js').Crawler;

describe('Crawler._request method', function () {
	var crawler;

	beforeEach(function () {
		crawler = new Crawler();
	});

	it('exists', function () {
		expect(crawler._request instanceof Function).toBe(true);
	});

	it('is an instance of the request module', function () {
		expect(crawler._request).toBe(request);
	});

});