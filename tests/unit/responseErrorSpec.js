var Crawler = require('../../crawler.js').Crawler;
var Page = require('../../crawler.js').Page;

describe('Crawler._responseError method', function () {
	var crawler;
	var callbackSpy;
	var crawlPageSpy;
	var error;
	var pageInfo;
	var response;

	beforeEach(function () {
		crawler = new Crawler();
		crawlPageSpy = spyOn(crawler, '_crawlPage');
		callbackSpy = jasmine.createSpy('callbackSpy');
		error = {
			code: 'some error'
		};
		response = {
			statusCode: 403,
			req: {
				method: 'GET'
			}
		};
		pageInfo = {
			page: 'page stuff'
		};
	});

	it('calls the supplied callback with appropriate values', function () {
		crawler._responseError(pageInfo, response, error, callbackSpy);
		expect(callbackSpy).toHaveBeenCalledWith('onError', [pageInfo.page, error, response]);
	});

	it('uses an empty object if the supplied response is a string', function () {
		crawler._responseError(pageInfo, 'non-object', error, callbackSpy);
		expect(callbackSpy).toHaveBeenCalledWith('onError', [pageInfo.page, error, jasmine.any(Object)]);
		// First call, second arg, 3rd item in array
		expect(callbackSpy.calls[0].args[1][2]).toEqual({ req: {} });
	});

	it('uses an empty object if the supplied response is null', function () {
		crawler._responseError(pageInfo, null, error, callbackSpy);
		expect(callbackSpy).toHaveBeenCalledWith('onError', [pageInfo.page, error, jasmine.any(Object)]);
		// First call, second arg, 3rd item in array
		expect(callbackSpy.calls[0].args[1][2]).toEqual({ req: {} });
	});

	it('replaces "req" property of response with an empty object if the supplied response.req is not an object', function () {
		crawler._responseError(pageInfo, {}, error, callbackSpy);
		expect(callbackSpy).toHaveBeenCalledWith('onError', [pageInfo.page, error, jasmine.any(Object)]);
		// First call, second arg, 3rd item in array
		expect(callbackSpy.calls[0].args[1][2]).toEqual({ req: {} });
	});

	it('does not throw exceptions when error doesn\'t exist', function () {
		crawler._responseError(pageInfo, { req: { method: 'HEAD' } }, null, callbackSpy);
	});

	describe('GET requests', function () {
	
		withRetryTriggers(doNotRetryWithGET);

	});

	describe('HEAD requests', function () {

		beforeEach(function () {
			pageInfo.method = 'HEAD';
		});
	
		withRetryTriggers(retryWithGET);
	
	});

	function doNotRetryWithGET() {

		it('does not re-crawl page with a second GET request', function () {
			expect(crawlPageSpy).not.toHaveBeenCalled();
		});

		it('sends error through callback', function () {
			expect(callbackSpy).toHaveBeenCalledWith('onError', [pageInfo.page, error, response]);
		});

	}

	function retryWithGET() {

		it('does not send error through callback', function () {
			expect(callbackSpy).not.toHaveBeenCalled();
		});

		it('re-crawls page with a GET request', function () {
			expect(crawlPageSpy).toHaveBeenCalledWith({ page: 'page stuff', method: 'GET' }, callbackSpy);
		});

	}

	function withRetryTriggers(expectedResult) {

		describe('with 400 status code', function () {

			beforeEach(function () {
				response.statusCode = 400;
				crawler._responseError(pageInfo, response, error, callbackSpy);
			});

			expectedResult();
		});

		describe('with 403 status code', function () {

			beforeEach(function () {
				response.statusCode = 403;
				crawler._responseError(pageInfo, response, error, callbackSpy);
			});

			expectedResult();
		});

		describe('with 404 status code', function () {

			beforeEach(function () {
				response.statusCode = 404;
				crawler._responseError(pageInfo, response, error, callbackSpy);
			});

			expectedResult();
		});

		describe('with 405 status code', function () {

			beforeEach(function () {
				response.statusCode = 405;
				crawler._responseError(pageInfo, response, error, callbackSpy);
			});

			expectedResult();
		});

		describe('with HPE_INVALID_CONSTANT error', function () {

			beforeEach(function () {
				error.code = 'HPE_INVALID_CONSTANT';
				crawler._responseError(pageInfo, response, error, callbackSpy);
			});

			expectedResult();
		});

		describe('with HPE_INVALID_HEADER_TOKEN error', function () {

			beforeEach(function () {
				error.code = 'HPE_INVALID_HEADER_TOKEN';
				crawler._responseError(pageInfo, response, error, callbackSpy);
			});

			expectedResult();
		});

		describe('with HPE_INVALID_CONTENT_LENGTH error', function () {

			beforeEach(function () {
				error.code = 'HPE_INVALID_CONTENT_LENGTH';
				crawler._responseError(pageInfo, response, error, callbackSpy);
			});

			expectedResult();
		});

	}

});