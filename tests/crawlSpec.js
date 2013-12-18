var request = require('request');
var Crawler = require('../crawler.js').Crawler;
var Page = require('../crawler.js').Page;

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
			method: 'HEAD',
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
	
		it('uses the pageInfo.method for the method', function () {
			expect(requestSpy.calls[0].args[0].method).toBe('HEAD');
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
			method: 'HEAD',
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

describe('Crawler._onResponse method', function () {
	var crawler;
	var failureSpy;
	var page;
	var successSpy;

	beforeEach(function () {
		crawler = new Crawler();
		page = new Page();
		failureSpy = spyOn(crawler, '_responseError');
		successSpy = spyOn(crawler, '_responseSuccess');
	});

	it('exists', function () {
		expect(crawler._onResponse instanceof Function).toBe(true);
	});

	it('runs finish callback if crawler is killed', function () {
		var callbackSpy = jasmine.createSpy('finishCallback');
		crawler._killed = true;
		crawler._onResponse(page, null, {}, '', callbackSpy);
		expect(callbackSpy).toHaveBeenCalled();
	});

	it('does not run finish callback if crawler is not killed', function () {
		var callbackSpy = jasmine.createSpy('finishCallback');
		crawler._killed = false;
		crawler._onResponse(page, null, {}, '', callbackSpy);
		expect(callbackSpy).not.toHaveBeenCalled();
	});

	it('returns false if crawler is killed', function () {
		crawler._killed = true;
		var result = crawler._onResponse(page, null, {}, '', function () {});
		expect(result).toBe(false);
	});

	it('does not return false if crawler is not killed', function () {
		crawler._killed = false;
		var result = crawler._onResponse(page, null, {}, '', function () {});
		expect(result).not.toBeDefined();
	});

	describe('success process', function () {
		var response;
		var body;
		var callback;
		
		beforeEach(function () {
			response = {
				statusCode: 200
			};
			body = 'my body';
			callback = function () {};
		});

		it('executes _responseSuccess method when no errors occur and when the status code is 200', function () {
			crawler._onResponse(page, null, response, body, callback);
			expect(successSpy).toHaveBeenCalled();
			expect(successSpy.calls[0].args[0]).toBe(page);
			expect(successSpy.calls[0].args[1]).toEqual(response);
			expect(successSpy.calls[0].args[2]).toEqual(body);
			expect(successSpy.calls[0].args[3]).toBe(callback);
		});

		it('does not execute _responseSuccess method when errors occur (when error is not null)', function () {
			crawler._onResponse(page, true, response, body, callback);
			expect(successSpy).not.toHaveBeenCalled();
		});

		it('does not execute _responseSuccess method when status code is not 200', function () {
			crawler._onResponse(page, null, { statusCode: 400 }, body, callback);
			expect(successSpy).not.toHaveBeenCalled();
		});
	
	});

	describe('error process', function () {
		var response;
		var body;
		var callback;
		var crawlPageSpy;
		
		beforeEach(function () {
			crawlPageSpy = spyOn(crawler, '_crawlPage');
			response = {
				statusCode: 200
			};
			body = 'my body';
			callback = function () {};
		});

		it('executes _responseError method when errors occur (when error is not null)', function () {
			crawler._onResponse(page, true, response, body, callback);
			expect(failureSpy).toHaveBeenCalled();
			expect(failureSpy.calls[0].args[0]).toBe(page);
			expect(failureSpy.calls[0].args[1]).toEqual(response);
			expect(failureSpy.calls[0].args[2]).toEqual(true);
			expect(failureSpy.calls[0].args[3]).toBe(callback);
		});

		it('executes _responseError method when status code is not 200', function () {
			crawler._onResponse(page, null, { statusCode: 400 }, body, callback);
			expect(failureSpy).toHaveBeenCalled();
			expect(failureSpy.calls[0].args[0]).toBe(page);
			expect(failureSpy.calls[0].args[1]).toEqual({ statusCode: 400 });
			expect(failureSpy.calls[0].args[2]).toEqual(null);
			expect(failureSpy.calls[0].args[3]).toBe(callback);
		});

		it('sets the page\'s retries to 0 if it does not have the property already', function () {
			crawler.retries = 1;
			page._retries = undefined;
			crawler._onResponse(page, true, response, body, callback);
			expect(page._retries).toBe(1); // Note: it increments by 1
		});

		it('increases the number of retries if the page\'s retries is less than the number of retries specified in the crawler', function () {
			crawler.retries = 1;
			page._retries = 0;
			crawler._onResponse(page, true, response, body, callback);
			expect(page._retries).toBe(1);
		});

		it('does not increase the number of retries if the page\'s retries is equal to or greater than the number of retries specified in the crawler', function () {
			crawler.retries = 1;
			page._retries = 1;
			crawler._onResponse(page, true, response, body, callback);
			expect(page._retries).toBe(1);
		});

		it('does not process retries if the crawlers retries are set to 0', function () {
			crawler.retries = 0;
			crawler._onResponse(page, true, response, body, callback);
			expect(page._retries).not.toBeDefined();
		});

		it('runs _crawlPage method if a retry should occur', function () {
			crawler.retries = 1;
			crawler._onResponse(page, true, response, body, callback);
			expect(crawlPageSpy).toHaveBeenCalledWith(page, callback);
		});

		it('should not execute _responseError method if a retry occurs', function () {
			crawler.retries = 1;
			crawler._onResponse(page, true, response, body, callback);
			expect(failureSpy).not.toHaveBeenCalled();
		});
	
	});

});

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