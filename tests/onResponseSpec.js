var Crawler = require('../crawler.js').Crawler;
var Page = require('../crawler.js').Page;

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
		crawler._onResponse({ page: page }, null, {}, '', callbackSpy);
		expect(callbackSpy).toHaveBeenCalled();
	});

	it('does not run finish callback if crawler is not killed', function () {
		var callbackSpy = jasmine.createSpy('finishCallback');
		crawler._killed = false;
		crawler._onResponse({ page: page }, null, {}, '', callbackSpy);
		expect(callbackSpy).not.toHaveBeenCalled();
	});

	it('returns false if crawler is killed', function () {
		crawler._killed = true;
		var result = crawler._onResponse({ page: page }, null, {}, '', function () {});
		expect(result).toBe(false);
	});

	it('does not return false if crawler is not killed', function () {
		crawler._killed = false;
		var result = crawler._onResponse({ page: page }, null, {}, '', function () {});
		expect(result).not.toBeDefined();
	});

	it('always converts response to an object', function () {
		// These calls should fail if this is not handled
		crawler._onResponse({ page: page }, null, '', '', function () {});
		crawler._onResponse({ page: page }, null, null, '', function () {});
		crawler._onResponse({ page: page }, null, undefined, '', function () {});
		crawler._onResponse({ page: page }, null, [], '', function () {});
	});

	describe('page redirect detection', function () {
		var pageInfo,
			redirectedResponse;

		beforeEach(function () {
			page.url = 'http://www.google.com/';
			pageInfo = { page: page };
			redirectedResponse = { request: { href: 'http://www.alreadycrawled.com/' } };
		});
	
		it('determines if page was redirected and what URL it redirected to', function () {
			crawler._pages = {
				'http://www.alreadycrawled.com/': true
			};
			crawler._onResponse(pageInfo, null, redirectedResponse, '', function () {});
			expect(pageInfo.page.redirect).toBe('http://www.alreadycrawled.com/');
		});

		it('calls onRedirect when a redirect occurs', function () {
			var onRedirectSpy = spyOn(crawler, 'onRedirect');
			crawler._pages = {
				'http://www.alreadycrawled.com/': true
			};
			crawler._onResponse(pageInfo, true, redirectedResponse, '', function () {});
			expect(onRedirectSpy).toHaveBeenCalledWith(page, redirectedResponse);
		});

		it('calls onRedirect when a redirect occurs, even when final page wasn\'t already crawled', function () {
			var onRedirectSpy = spyOn(crawler, 'onRedirect');
			crawler._onResponse(pageInfo, true, redirectedResponse, '', function () {});
			expect(onRedirectSpy).toHaveBeenCalledWith(page, redirectedResponse);
		});

		it('does not call _responseSuccess, _responseError, or _crawlPage if it redirects to a URL that was already crawled', function () {
			var crawlPageSpy = spyOn(crawler, '_crawlPage');
			crawler._pages = {
				'http://www.alreadycrawled.com/': true
			};
			crawler.retries = 1; // So crawler attempts to retry
			crawler._onResponse(pageInfo, true, { request: { href: 'http://www.alreadycrawled.com/' } }, '', function () {});
			expect(crawlPageSpy).not.toHaveBeenCalled();
			crawler._onResponse(pageInfo, null, { request: { href: 'http://www.alreadycrawled.com/' } }, '', function () {});
			expect(failureSpy).not.toHaveBeenCalled();
			crawler._onResponse(pageInfo, null, { statusCode: 200, request: { href: 'http://www.alreadycrawled.com/' } }, '', function () {});
			expect(successSpy).not.toHaveBeenCalled();
		});

		it('does not call onRedirect when a redirect does not occur', function () {
			var onRedirectSpy = spyOn(crawler, 'onRedirect');
			pageInfo = {
				page: new Page('http://www.alreadycrawled.com/')
			};
			crawler._onResponse(pageInfo, null, redirectedResponse, '', function () {});
			expect(onRedirectSpy).not.toHaveBeenCalled();
		});

		it('does not call onRedirect when a redirect does not occur, but page was already crawled', function () {
			var onRedirectSpy = spyOn(crawler, 'onRedirect');
			pageInfo = {
				page: new Page('http://www.alreadycrawled.com/')
			};
			crawler._pages = {
				'http://www.alreadycrawled.com/': true
			};
			crawler._onResponse(pageInfo, null, redirectedResponse, '', function () {});
			expect(onRedirectSpy).not.toHaveBeenCalled();
		});

		it('does not try to check responses that don\'t exist', function () {
			crawler._onResponse(pageInfo, null, undefined, '', function () {});
			expect(page.redirect).not.toBeDefined();
		});

		it('does not try to check the request if it doesn\'t exist', function () {
			crawler._onResponse(pageInfo, null, { request: {} }, '', function () {});
			expect(page.redirect).not.toBeDefined();
		});
	
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
			var pageInfo = { page: page };
			crawler._onResponse(pageInfo, null, response, body, callback);
			expect(successSpy).toHaveBeenCalled();
			expect(successSpy.calls[0].args[0]).toBe(pageInfo);
			expect(successSpy.calls[0].args[1]).toEqual(response);
			expect(successSpy.calls[0].args[2]).toEqual(body);
			expect(successSpy.calls[0].args[3]).toBe(callback);
		});

		it('does not execute _responseSuccess method when errors occur (when error is not null)', function () {
			crawler._onResponse({ page: page }, true, response, body, callback);
			expect(successSpy).not.toHaveBeenCalled();
		});

		it('does not execute _responseSuccess method when status code is not 200', function () {
			crawler._onResponse({ page: page }, null, { statusCode: 400 }, body, callback);
			expect(successSpy).not.toHaveBeenCalled();
		});
	
	});

	describe('error process', function () {
		var response;
		var body;
		var callback;
		var crawlPageSpy;
		var pageInfo;
		
		beforeEach(function () {
			crawlPageSpy = spyOn(crawler, '_crawlPage');
			response = {
				statusCode: 200
			};
			body = 'my body';
			pageInfo = { page: page };
			callback = function () {};
		});

		it('executes _responseError method when errors occur (when error is not null)', function () {
			crawler._onResponse(pageInfo, true, response, body, callback);
			expect(failureSpy).toHaveBeenCalled();
			expect(failureSpy.calls[0].args[0]).toBe(pageInfo);
			expect(failureSpy.calls[0].args[1]).toEqual(response);
			expect(failureSpy.calls[0].args[2]).toEqual(true);
			expect(failureSpy.calls[0].args[3]).toBe(callback);
		});

		it('executes _responseError method when status code is not 200', function () {
			crawler._onResponse(pageInfo, null, { statusCode: 400 }, body, callback);
			expect(failureSpy).toHaveBeenCalled();
			expect(failureSpy.calls[0].args[0]).toBe(pageInfo);
			expect(failureSpy.calls[0].args[1]).toEqual({ statusCode: 400 });
			expect(failureSpy.calls[0].args[2]).toEqual(null);
			expect(failureSpy.calls[0].args[3]).toBe(callback);
		});

		it('sets the page\'s retries to 0 if it does not have the property already', function () {
			crawler.retries = 1;
			pageInfo.page._retries = undefined;
			crawler._onResponse(pageInfo, true, response, body, callback);

			// Information is stored in pageInfo instead of the Page object
			expect(pageInfo._retries).toBe(1); // Note: it increments by 1
		});

		it('increases the number of retries if the page\'s retries is less than the number of retries specified in the crawler', function () {
			crawler.retries = 1;
			pageInfo.page._retries = 0;
			crawler._onResponse(pageInfo, true, response, body, callback);

			// Information is stored in pageInfo instead of the Page object
			expect(pageInfo._retries).toBe(1);
		});

		it('does not increase the number of retries if the page\'s retries is equal to or greater than the number of retries specified in the crawler', function () {
			crawler.retries = 1;
			pageInfo.page._retries = 1;
			crawler._onResponse(pageInfo, true, response, body, callback);
			expect(page._retries).toBe(1);
		});

		it('does not process retries if the crawlers retries are set to 0', function () {
			crawler.retries = 0;
			crawler._onResponse(pageInfo, true, response, body, callback);
			expect(page._retries).not.toBeDefined();
		});

		it('runs _crawlPage method if a retry should occur', function () {
			crawler.retries = 1;
			crawler._onResponse(pageInfo, true, response, body, callback);
			expect(crawlPageSpy).toHaveBeenCalledWith(pageInfo, callback);
		});

		it('should not execute _responseError method if a retry occurs', function () {
			crawler.retries = 1;
			crawler._onResponse(pageInfo, true, response, body, callback);
			expect(failureSpy).not.toHaveBeenCalled();
		});
	
	});

});