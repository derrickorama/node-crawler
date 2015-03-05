var urllib = require('url');
var Crawler = require('../../crawler.js').Crawler;

describe('Crawler._processRedirect method', function () {
  'use strict';

	var pageInfo, finalURL, response;
	var crawler;
	var mockURLData;
	var onRedirectSpy;
	var urlParseSpy;

	beforeEach(function () {
		crawler = new Crawler();
		pageInfo = {
			page: {
				url: 'http://www.google.com/',
				redirects: []
			}
		};
		finalURL = 'http://www.google.com/';
		mockURLData = {
			href: 'http://www.google.com/'
		};
		response = {};
		urlParseSpy = spyOn(urllib, 'parse').andCallFake(function () {
			return mockURLData;
		});
		onRedirectSpy = spyOn(crawler, 'onRedirect');
		spyOn(crawler, '_wasCrawled');
	});

	it('parses the finalURL', function () {
		crawler._processRedirect(pageInfo, finalURL);
		expect(urlParseSpy).toHaveBeenCalledWith(finalURL);
	});

	describe('- when crawler pages contain the parsed URL -', function () {
		var result;

		beforeEach(function () {
			crawler._wasCrawled.andReturn(true);
			result = crawler._processRedirect(pageInfo, finalURL);
		});

		it('returns null', function () {
			expect(result).toBe(null);
		});

	});

	describe('- when crawler pages does not contain the parsed URL -', function () {
		beforeEach(function () {
			crawler._wasCrawled.andReturn(false);
			crawler._processRedirect(pageInfo, finalURL);
		});

		it('returns pageInfo object', function () {
			crawler._pages = {};
			var result = crawler._processRedirect(pageInfo, finalURL);
			expect(result).toEqual(pageInfo);
		});

		it('returns updated pageInfo when a redirect occurs', function () {
			pageInfo.page.url = 'http://domain.com/redirected';
			var result = crawler._processRedirect(pageInfo, finalURL);
			expect(result.page.url).toBe(finalURL);
		});

		it('adds the parsed URL to the _urlsCrawled property', function () {
			mockURLData = {
				href: 'returned URL'
			};
			crawler._urlsCrawled = [];
			crawler._processRedirect(pageInfo, finalURL);
			expect(crawler._urlsCrawled).toEqual(['returned URL']);
		});

		it('sends onRedirect the pageInfo.page and response', function () {
			crawler._processRedirect(pageInfo, finalURL, response);
			expect(onRedirectSpy).toHaveBeenCalledWith(pageInfo.page, response, finalURL);
		});

		it('preserves redirect\'s page url for onRedirect method', function (done) {
			pageInfo.page.url = 'http://domain.com/redirected';

			onRedirectSpy.andCallFake(function (page) {
				setTimeout(function () {
					expect(page.url).toBe('http://domain.com/redirected');
					done();
				});
			});

			crawler._processRedirect(pageInfo, finalURL, response);
		});

	});

});
