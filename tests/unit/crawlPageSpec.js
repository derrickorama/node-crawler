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
		spyOn(crawler, '_renderPage');
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

		it('executes _onResponse function in response callback', function () {
			// Execute the callback
			crawler._request.calls[0].args[1](null, 'arg2', 'arg3');
			expect(crawler._onResponse).toHaveBeenCalledWith(pageInfo, null, 'arg2', 'arg3', jasmine.any(Function));
		});

		describe('when render is true', function () {

			beforeEach(function () {
				crawler.render = true;
				crawler._request.calls[0].args[1](null, 'arg2', 'arg3');
			});

			it('renders the page', function () {
				expect(crawler._renderPage).toHaveBeenCalledWith(pageInfo.page, jasmine.any(Function));
			});

			it('calls _onResponse *after* page is rendered', function () {
				expect(crawler._onResponse).not.toHaveBeenCalled();
				crawler._renderPage.calls[0].args[1]();
				expect(crawler._onResponse).toHaveBeenCalled();
			});
		
		});
	
	});

});