var request = require('request');
var _ = require('underscore');
var winston = require('winston');
var Crawler = require('../../crawler.js').Crawler;

describe('Crawler._crawlPage method', function () {
	var body;
	var crawler;
	var error;
	var pageInfo;
	var finishCallback;
	var response;

	var COMMON_MEDIA_EXCLUDES = [
		'3gp',
		'aif',
		'asf',
		'asx',
		'avi',
		'flv',
		'iff',
		'm3u',
		'm4a',
		'm4p',
		'm4v',
		'mov',
		'mp3',
		'mp4',
		'mpa',
		'mpg',
		'mpeg',
		'ogg',
		'ra',
		'raw',
		'rm',
		'swf',
		'vob',
		'wav',
		'wma',
		'wmv'
	];

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
		spyOn(crawler, 'headerCheck').andCallFake(function (page, callback) {
			callback(error, page, response);
		});
		spyOn(crawler, '_request');
		spyOn(crawler, '_onResponse');
		spyOn(crawler, '_renderPage');
	});

	it('requests headers before downloading', function () {
		crawler._crawlPage(pageInfo, finishCallback);
		expect(crawler.headerCheck).toHaveBeenCalledWith(pageInfo.page, jasmine.any(Function));
	});

	it('does not perform a request when the page.type does not contain "text/"', function () {
		pageInfo.page.type = 'application/pdf';
		crawler._crawlPage(pageInfo, finishCallback);
		expect(crawler._request).not.toHaveBeenCalled();
		expect(crawler._onResponse).toHaveBeenCalledWith(pageInfo, error, response, '', finishCallback);
	});

	it('does not perform a request when an error occurs', function () {
		error = {
			message: 'error message'
		};
		spyOn(winston, 'error'); // silence winston
		crawler._crawlPage(pageInfo, finishCallback);
		expect(crawler._request).not.toHaveBeenCalled();
		expect(crawler._onResponse).toHaveBeenCalledWith(pageInfo, error, response, '', finishCallback);
	});

	it('logs errors', function () {
		error = {
			message: 'error message'
		};
		spyOn(winston, 'error');
		crawler._crawlPage(pageInfo, finishCallback);
		expect(winston.error).toHaveBeenCalledWith('Failed on: ' + pageInfo.page.url);
		expect(winston.error).toHaveBeenCalledWith(error.message);	
	});

	_.each(COMMON_MEDIA_EXCLUDES, function (type) {

		it('excludes "' + type + '" files', function () {
			pageInfo.page.type = 'text/plain';
			pageInfo.page.url = 'http://domain.com/file.' + type;
			crawler._crawlPage(pageInfo, finishCallback);
			expect(crawler._request).not.toHaveBeenCalled();
			expect(crawler._onResponse).toHaveBeenCalledWith(pageInfo, error, response, '', finishCallback);
		});

	});

	describe('request', function () {

		beforeEach(function () {
			crawler.strictSSL = false;
			crawler.timeout = 1000;
			crawler._crawlPage(pageInfo, function () {});
		});

		it('is called', function () {
			expect(crawler._request).toHaveBeenCalled();
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
	
		it('uses one of the latest Chrome User-Agents', function () {
			expect(crawler._request.calls[0].args[0].headers).toEqual({
				'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/33.0.1750.149 Safari/537.36'
			});
		});

		it('executes _onResponse function in response callback', function () {
			// Execute the callback
			crawler._request.calls[0].args[1]('arg1', 'arg2', 'arg3');
			expect(crawler._onResponse).toHaveBeenCalledWith(pageInfo, 'arg1', 'arg2', 'arg3', jasmine.any(Function));
		});

		describe('when render is true', function () {

			beforeEach(function () {
				crawler.render = true;
				crawler._request.calls[0].args[1]('arg1', 'arg2', 'arg3');
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

	describe('request cookie setter', function () {

		it('sets jar to a new jar if crawler.acceptCookies is true', function () {
			crawler.acceptCookies = true;
			crawler._crawlPage(pageInfo);
			expect(crawler._request.calls[0].args[0].jar).toEqual(request.jar());
		});
	
		it('sets jar to false if crawler.acceptCookies is false', function () {
			crawler.acceptCookies = false;
			crawler._crawlPage(pageInfo);
			expect(crawler._request.calls[0].args[0].jar).toBe(false);
		});
	
		it('sets jar to false if crawler.acceptCookies is neither true/false', function () {
			crawler.acceptCookies = null;
			crawler._crawlPage(pageInfo);
			expect(crawler._request.calls[0].args[0].jar).toBe(false);
		});

	});

});