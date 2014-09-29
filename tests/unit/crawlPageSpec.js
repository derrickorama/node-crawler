var winston = require('winston');
var Crawler = require('../../crawler.js').Crawler;

describe('Crawler._crawlPage method', function () {
	var body;
	var crawler;
	var error;
	var pageInfo;
	var finishCallback;
	var response;

	beforeEach(function () {
		body = 'response body';
		crawler = new Crawler();
		error = null;
		pageInfo = {
			page: {
				url: 'http://www.google.com',
				type: 'text/html'
			}
		};
		response = 'response object';
		finishCallback = jasmine.createSpy('finishCallback');
		spyOn(crawler, '_request');
		spyOn(crawler, '_onResponse');
	});

	it('logs errors', function () {
		spyOn(winston, 'error');
		crawler._request.andCallFake(function (params, callback) {
			callback(new Error('error message'));
		});
		crawler._crawlPage(pageInfo, finishCallback);
		expect(winston.error).toHaveBeenCalledWith('Failed on: ' + pageInfo.page.url);
		expect(winston.error).toHaveBeenCalledWith('error message');
	});

	describe('request', function () {

		beforeEach(function () {
			crawler.strictSSL = false;
			crawler.timeout = 1000;
			crawler.acceptCookies = true;
			pageInfo.page.isExternal = true;
			crawler.auth = { username: 'user', password: 'pass' };
			crawler._crawlPage(pageInfo, function () {});
		});
	
		it('uses the pageInfo.page.url for the url', function () {
			expect(crawler._request.calls[0].args[0].url).toBe('http://www.google.com');
		});
	
		it('uses the crawler.timeout for the timeout', function () {
			expect(crawler._request.calls[0].args[0].timeout).toBe(1000);
		});
	
		it('uses the crawler.strictSSL for the strictSSL', function () {
			expect(crawler._request.calls[0].args[0].strictSSL).toBe(false);
		});

		it('passes the pageInfo.page.isExternal property to the request', function () {
			expect(crawler._request.calls[0].args[0].isExternal).toBe(true);
		});

		it('passes the crawler.auth property to the request', function () {
			expect(crawler._request.calls[0].args[0].auth).toBe(crawler.auth);
		});

		it('executes _onResponse function in response callback', function () {
			// Execute the callback
			crawler._request.calls[0].args[1](null, 'arg2', 'arg3');
			expect(crawler._onResponse).toHaveBeenCalledWith(pageInfo, null, 'arg2', 'arg3', jasmine.any(Function));
		});
	
	});

});