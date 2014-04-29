var urllib = require('url');
var _ = require('underscore');
var Crawler = require('../../crawler.js').Crawler;
var Page = require('../../crawler.js').Page;

describe('Crawler._processRedirect method', function () {
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
	});

	it('parses the finalURL', function () {
		crawler._processRedirect(pageInfo, finalURL);
		expect(urlParseSpy).toHaveBeenCalledWith(finalURL);
	});

	describe('- when crawler pages contain the parsed URL -', function () {
		var result;
	
		beforeEach(function () {
			crawler._pages = {
				'http://www.google.com/': {
					url: 'http://www.google.com/'
				}
			};
			result = crawler._processRedirect(pageInfo, finalURL);
		});

		it('returns null', function () {
			expect(result).toBe(null);
		});
	
	});

	describe('- when crawler pages does not contain the parsed URL -', function () {
		var result;
	
		beforeEach(function () {
			crawler._pages = {};
			result = crawler._processRedirect(pageInfo, finalURL);
		});

		it('returns new pageInfo object', function () {
			crawler._pages = {};
			var result = crawler._processRedirect(pageInfo, finalURL);
			expect(result).toEqual(pageInfo);
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
			expect(onRedirectSpy).toHaveBeenCalledWith(pageInfo.page, response);
		});

		it('preserves redirect\'s page url for onRedirect method', function (done) {
			pageInfo.page.url = 'http://domain.com/redirected';

			onRedirectSpy.andCallFake(function (page, response) {
				setTimeout(function () {
					expect(page.url).toBe('http://domain.com/redirected');
					done();
				});
			});

			crawler._processRedirect(pageInfo, finalURL, response);
		});

		describe('record in crawler pages', function () {
		
			beforeEach(function () {
				crawler._pages = {
					'http://www.google.com/': {
						url: 'http://www.google.com/'
					}
				};
				pageInfo = {
					page: {
						url: 'http://www.google.com/',
						redirects: []
					},
					whatever: true
				};
				mockURLData = {
					href: 'http://finalurl.com/'
				};
				crawler._processRedirect(pageInfo, finalURL, response);
			});

			it('is updated with parsed finalURL key', function () {
				expect(_.keys(crawler._pages).length).toBe(1);
				expect(crawler._pages.hasOwnProperty('http://finalurl.com/')).toBe(true);
			});

			it('is updated with parsed finalURL key', function () {
				expect(crawler._pages['http://finalurl.com/'].page.url).toBe('http://finalurl.com/');
			});

			it('is clones the keys in the pageInfo argument', function () {
				expect(_.keys(crawler._pages['http://finalurl.com/'])).toEqual(['page', 'whatever']);
			});

			it('is updated with parsed finalURL key', function () {
				expect(crawler._pages['http://finalurl.com/'].page.url).toBe('http://finalurl.com/');
			});

			it('is updated with the additional redirect', function () {
				expect(crawler._pages['http://finalurl.com/'].page.redirects).toEqual(['http://www.google.com/']);
			});
		
		});
	
	});

});