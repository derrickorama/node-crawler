var request = require('request');
var Crawler = require('../../crawler.js').Crawler;

describe('Crawler._crawlPage method', function () {
	var crawler;

	beforeEach(function () {
		crawler = new Crawler();
	});

	it('exists', function () {
		expect(crawler._crawlPage instanceof Function).toBe(true);
	});

	describe('request', function () {
		var onResponseSpy;
		var requestSpy;
		var PAGE_INFO = {
			page: {
				url: 'http://www.google.com'
			}
		};

		beforeEach(function () {
			requestSpy = spyOn(crawler, '_request');
			onResponseSpy = spyOn(crawler, '_onResponse');
			crawler.strictSSL = false;
			crawler.timeout = 1000;
			crawler._crawlPage(PAGE_INFO, function () {});
		});

		it('is called', function () {
			expect(requestSpy).toHaveBeenCalled();
		});
	
		it('uses the pageInfo.page.url for the url', function () {
			expect(requestSpy.calls[0].args[0].url).toBe('http://www.google.com');
		});
	
		it('uses the crawler.timeout for the timeout', function () {
			expect(requestSpy.calls[0].args[0].timeout).toBe(1000);
		});
	
		it('uses the crawler.strictSSL for the strictSSL', function () {
			expect(requestSpy.calls[0].args[0].strictSSL).toBe(false);
		});
	
		it('uses the Googlebot User-Agent', function () {
			expect(requestSpy.calls[0].args[0].headers).toEqual({
				'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
			});
		});

		it('executes _onResponse function in response callback', function () {
			// Execute the callback
			requestSpy.calls[0].args[1]('arg1', 'arg2', 'arg3');
			expect(onResponseSpy).toHaveBeenCalledWith(PAGE_INFO, 'arg1', 'arg2', 'arg3', jasmine.any(Function));
		});
	
	});

	describe('request cookie setter', function () {
		var requestSpy;
		var PAGE_INFO = {
			page: {
				url: 'http://www.google.com'
			}
		};

		beforeEach(function () {
			requestSpy = spyOn(crawler, '_request');
		});

		it('sets jar to a new jar if crawler.acceptCookies is true', function () {
			crawler.acceptCookies = true;
			crawler._crawlPage(PAGE_INFO);
			expect(requestSpy.calls[0].args[0].jar).toEqual(request.jar());
		});
	
		it('sets jar to false if crawler.acceptCookies is false', function () {
			crawler.acceptCookies = false;
			crawler._crawlPage(PAGE_INFO);
			expect(requestSpy.calls[0].args[0].jar).toBe(false);
		});
	
		it('sets jar to false if crawler.acceptCookies is neither true/false', function () {
			crawler.acceptCookies = null;
			crawler._crawlPage(PAGE_INFO);
			expect(requestSpy.calls[0].args[0].jar).toBe(false);
		});

	});

});