var Crawler = require('../../crawler.js').Crawler;

describe('Crawler._onResponse method', function () {
	var body;
	var crawler;
	var crawlPageSpy;
	var failureSpy;
	var finishCallbackSpy;
	var pageInfo;
	var processRedirectSpy;
	var successSpy;
	var queueSpy;

	beforeEach(function () {
		body = 'my body';
		crawler = new Crawler();
		pageInfo = {
			page: {
				url: 'http://www.google.com/'
			}
		};
		crawlPageSpy = spyOn(crawler, '_crawlPage');
		failureSpy = spyOn(crawler, '_responseError');
		finishCallbackSpy = jasmine.createSpy('finishCallback');
		processRedirectSpy = spyOn(crawler, '_processRedirect');
		successSpy = spyOn(crawler, '_responseSuccess');
		queueSpy = spyOn(crawler, 'queue');
	});

	it('exists', function () {
		expect(crawler._onResponse instanceof Function).toBe(true);
	});

	it('always converts response to an object', function () {
		// These calls should fail if this is not handled
		crawler._onResponse(pageInfo, null, '', '', function () {});
		crawler._onResponse(pageInfo, null, null, '', function () {});
		crawler._onResponse(pageInfo, null, undefined, '', function () {});
		crawler._onResponse(pageInfo, null, [], '', function () {});
	});

	describe('when killed', function () {
		var result;

		beforeEach(function () {
			crawler._killed = true;
			result = crawler._onResponse(pageInfo, null, {}, '', finishCallbackSpy);
		});

		it('returns false', function () {
			expect(result).toBe(false);
		});
	
		it('runs finish callback', function () {
			expect(finishCallbackSpy).toHaveBeenCalled();
		});

		it('does not run _processRedirect', function () {
			expect(processRedirectSpy).not.toHaveBeenCalled();
		});

		it('does not run _responseSuccess', function () {
			expect(successSpy).not.toHaveBeenCalled();
		});

		it('does not run _crawlPage', function () {
			expect(crawlPageSpy).not.toHaveBeenCalled();
		});
	
	});

	describe('- on redirect -', function () {
		var response;
		var result;

		beforeEach(function () {
			pageInfo.page.url = 'http://www.google.com/';
			pageInfo.page.isExternal = false;
			response = { statusCode: 200, url: 'http://www.alreadycrawled.com/' };
		});

		it('marks pages as external when final URL is not on the same domain', function () {
			result = crawler._onResponse(pageInfo, null, response, '', finishCallbackSpy);
			expect(pageInfo.page.isExternal).toBe(true);
		});

		it('calls _processRedirect', function () {
			result = crawler._onResponse(pageInfo, null, response, '', finishCallbackSpy);
			expect(processRedirectSpy).toHaveBeenCalledWith(pageInfo, response.url, response);
		});

		describe('when _processRedirect returns null', function () {

			beforeEach(function () {
				processRedirectSpy.andReturn(null);
				result = crawler._onResponse(pageInfo, null, response, '', finishCallbackSpy);
			});
		
			it('executes the finishCallback', function () {
				expect(finishCallbackSpy).toHaveBeenCalled();
			});

			it('does not execute _responseSuccess', function () {
				expect(successSpy).not.toHaveBeenCalled();
			});

			it('does not execute _responseError', function () {
				expect(failureSpy).not.toHaveBeenCalled();
			});
		
		});

		describe('when _processRedirect returns non-null', function () {

			beforeEach(function () {
				processRedirectSpy.andReturn({ page: { url: 'http://www.alreadycrawled.com/' } });
			});

			it('executes _responseSuccess if successful', function () {
				result = crawler._onResponse(pageInfo, null, response, '', finishCallbackSpy);
				expect(successSpy.calls[0].args[0]).toEqual({ page: { url: 'http://www.alreadycrawled.com/' } });
			});

			it('executes _responseError if failed', function () {
				result = crawler._onResponse(pageInfo, true, response, '', finishCallbackSpy);
				expect(failureSpy.calls[0].args[0]).toEqual({ page: { url: 'http://www.alreadycrawled.com/' } });
			});
		
		});

	});

	describe('on 200 response', function () {
		var response;
		
		beforeEach(function () {
			response = {
				statusCode: 200
			};
		});

		it('executes _responseSuccess method', function () {
			crawler._onResponse(pageInfo, null, response, body, finishCallbackSpy);
			expect(successSpy).toHaveBeenCalled();
			expect(successSpy.calls[0].args[0]).toBe(pageInfo);
			expect(successSpy.calls[0].args[1]).toEqual(response);
			expect(successSpy.calls[0].args[2]).toEqual(body);
			expect(successSpy.calls[0].args[3]).toBe(finishCallbackSpy);
		});

		it('does not execute _responseError', function () {
			crawler._onResponse(pageInfo, null, response, body, finishCallbackSpy);
			expect(failureSpy).not.toHaveBeenCalled();
		});

		it('does not execute _responseSuccess method when errors occur (when error is not null)', function () {
			crawler._onResponse(pageInfo, true, response, body, finishCallbackSpy);
			expect(successSpy).not.toHaveBeenCalled();
		});
	
	});

	describe('on non 200 response', function () {
		var response;
		
		beforeEach(function () {
			response = {
				statusCode: 400
			};
		});

		it('executes _responseError method', function () {
			crawler._onResponse(pageInfo, null, response, body, finishCallbackSpy);
			expect(failureSpy).toHaveBeenCalled();
			expect(failureSpy.calls[0].args[0]).toBe(pageInfo);
			expect(failureSpy.calls[0].args[1]).toEqual(response);
			expect(failureSpy.calls[0].args[2]).toEqual(null);
			expect(failureSpy.calls[0].args[3]).toBe(finishCallbackSpy);
		});

		onErrorSpecs(response, null);
	
	});

	describe('on error', function () {
		var response;
		
		beforeEach(function () {
			response = {
				statusCode: 200
			};
		});

		it('executes _responseError method', function () {
			crawler._onResponse(pageInfo, true, response, body, finishCallbackSpy);
			expect(failureSpy).toHaveBeenCalled();
			expect(failureSpy.calls[0].args[0]).toBe(pageInfo);
			expect(failureSpy.calls[0].args[1]).toEqual(response);
			expect(failureSpy.calls[0].args[2]).toEqual(true);
			expect(failureSpy.calls[0].args[3]).toBe(finishCallbackSpy);
		});

		onErrorSpecs(response, true);
	
	});

	describe('on parse errors with external links that return 200 and include a content-length header', function () {
		var response;

		beforeEach(function () {
			pageInfo.page.isExternal = true;
			response = { statusCode: 200, headers: { 'content-length': '4' } };
			crawler._onResponse(pageInfo, { code: 'HPE_INVALID_CONSTANT' }, response, body, finishCallbackSpy);
		});
	
		it('does not execute _responseError method', function () {
			expect(failureSpy).not.toHaveBeenCalled();
		});

		it('executes _responseSuccess method', function () {
			expect(successSpy).toHaveBeenCalledWith(pageInfo, response, body, finishCallbackSpy);
		});
	
	});

	function onErrorSpecs(response, error) {

		it('does not execute _responseSuccess', function () {
			crawler._onResponse(pageInfo, error, response, body, finishCallbackSpy);
			expect(successSpy).not.toHaveBeenCalled();
		});

		it('sets the page\'s retries to 0 if it does not have the property already', function () {
			crawler.retries = 1;
			pageInfo.page._retries = undefined;
			crawler._onResponse(pageInfo, error, response, body, finishCallbackSpy);

			// Information is stored in pageInfo instead of the Page object
			expect(pageInfo._retries).toBe(1); // Note: it increments by 1
		});

		it('increases the number of retries if the page\'s retries is less than the number of retries specified in the crawler', function () {
			crawler.retries = 1;
			pageInfo.page._retries = 0;
			crawler._onResponse(pageInfo, error, response, body, finishCallbackSpy);

			// Information is stored in pageInfo instead of the Page object
			expect(pageInfo._retries).toBe(1);
		});

		it('does not increase the number of retries if the page\'s retries is equal to or greater than the number of retries specified in the crawler', function () {
			crawler.retries = 1;
			pageInfo.page._retries = 1;
			crawler._onResponse(pageInfo, error, response, body, finishCallbackSpy);
			expect(pageInfo.page._retries).toBe(1);
		});

		it('does not process retries if the crawlers retries are set to 0', function () {
			crawler.retries = 0;
			crawler._onResponse(pageInfo, error, response, body, finishCallbackSpy);
			expect(pageInfo.page._retries).not.toBeDefined();
		});

		it('runs _crawlPage method if a retry should occur', function () {
			crawler.retries = 1;
			crawler._onResponse(pageInfo, error, response, body, finishCallbackSpy);
			expect(crawlPageSpy).toHaveBeenCalledWith(pageInfo, finishCallbackSpy);
		});

		it('does not execute _responseError method if a retry occurs', function () {
			crawler.retries = 1;
			crawler._onResponse(pageInfo, error, response, body, finishCallbackSpy);
			expect(failureSpy).not.toHaveBeenCalled();
		});

	}

});