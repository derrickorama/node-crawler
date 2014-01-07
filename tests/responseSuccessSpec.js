var Crawler = require('../crawler.js').Crawler;
var Page = require('../crawler.js').Page;

describe('Crawler._responseSuccess method', function () {
	var callback,
		crawler,
		page,
		pageInfo,
		queueSpy,
		response,
		setHTMLSpy;

	beforeEach(function () {
		callback = jasmine.createSpy('callbackSpy');
		crawler = new Crawler();
		queueSpy = spyOn(crawler, 'queue');
		page = new Page('https://www.google.com/');
		setHTMLSpy = spyOn(page, 'setHTML');
		pageInfo = { page: page };
		response = { headers: { 'content-type': 'text/html' } };
	});

	it('sets page.type to what\'s defined in the Content-Type of the response headers', function () {
		crawler._responseSuccess(pageInfo, { headers: { 'content-type': 'application/pdf' } }, '', callback);
		expect(pageInfo.page.type).toBe('application/pdf');
	});

	it('updates the pages HTML with what returns in the "body"', function () {
		crawler._responseSuccess(pageInfo, response, '<span>I am HTML</span>', callback);
		expect(setHTMLSpy).toHaveBeenCalledWith('<span>I am HTML</span>');
	});

	it('executes supplied callback with the correct parameters', function () {
		crawler._responseSuccess(pageInfo, response, '', callback);
		expect(callback).toHaveBeenCalledWith('onPageCrawl', [pageInfo.page, response]);
	});

	describe('link finder', function () {

		beforeEach(function () {
			pageInfo.crawlLinks = true; // So that it crawls page links by default
			crawler._crawlExternal = false; // So that it doesn't crawl external links by default
			pageInfo.page.links = [
				'/page1.html',
				'/page2.html',
				'/page3.html'
			];
		});

		it('does not crawl links if pageInfo.crawlLinks is set to false', function () {
			pageInfo.crawlLinks = false;
			crawler._responseSuccess(pageInfo, response, '', callback);
			expect(queueSpy).not.toHaveBeenCalled();
		});
	
		it('queues each new link on page', function () {
			crawler._responseSuccess(pageInfo, response, '', callback);
			expect(queueSpy.callCount).toBe(3);
		});

		it('does not queue mailto: links', function () {
			pageInfo.page.links = [
				'mailto:me@email.com'
			];
			crawler._responseSuccess(pageInfo, response, '', callback);
			expect(queueSpy).not.toHaveBeenCalled();
		});

		it('does not queue javascript: links', function () {
			/*jslint scripturl:true */
			pageInfo.page.links = [
				'javascript:alert("hi")'
			];
			crawler._responseSuccess(pageInfo, response, '', callback);
			expect(queueSpy).not.toHaveBeenCalled();
		});

		it('does not queue tel: links', function () {
			pageInfo.page.links = [
				'tel:9876543210'
			];
			crawler._responseSuccess(pageInfo, response, '', callback);
			expect(queueSpy).not.toHaveBeenCalled();
		});

		it('does not queue URLs with no host', function () {
			pageInfo.page.links = [
				'http://'
			];
			crawler._responseSuccess(pageInfo, response, '', callback);
			expect(queueSpy).not.toHaveBeenCalled();
		});

		it('does not crawl URLs (by default) if they do not reside on the same domain', function () {
			pageInfo.page.links = [
				'http://external.com'
			];
			crawler._responseSuccess(pageInfo, response, '', callback);
			expect(queueSpy).not.toHaveBeenCalled();
		});

		describe('external URL queueing', function () {

			beforeEach(function () {
				pageInfo.page.links = [
					'http://external.com'
				];
				crawler._crawlExternal = true;
				crawler._responseSuccess(pageInfo, response, '', callback);
			});
		
			it('crawls external URLs if the crawler\'s _crawlExternal property is true', function () {
				expect(queueSpy.calls[0].args[0]).toBe('http://external.com/');
			});
		
			it('tells the queue that it should not crawl links on that page', function () {
				expect(queueSpy.calls[0].args[1]).toBe(false);
			});
		
			it('tells the queue that it should use a HEAD request', function () {
				expect(queueSpy.calls[0].args[2]).toBe(true);
			});
		
		});

		it('crawls external URLs if the crawler\'s _crawlExternal property is true', function () {
			
		});

		describe('URL normalization', function () {
		
			it('adds protocol and domain to relative links', function () {
				crawler._responseSuccess(pageInfo, response, '', callback);
				expect(queueSpy.calls[0].args[0]).toBe('https://www.google.com/page1.html');
				expect(queueSpy.calls[1].args[0]).toBe('https://www.google.com/page2.html');
				expect(queueSpy.calls[2].args[0]).toBe('https://www.google.com/page3.html');
			});
		
			it('resolves relative URLs based on the page.url provided', function () {
				pageInfo.page.url = 'https://www.google.com/section/page.html';
				pageInfo.page.links = [
					'../page1.html',
					'../section2/page2.html',
					'page3.html',
					'http://external.com'
				];
				crawler._crawlExternal = true; // So that the http://external.com URL is normalized and queued
				crawler._responseSuccess(pageInfo, response, '', callback);
				expect(queueSpy.calls[0].args[0]).toBe('https://www.google.com/page1.html');
				expect(queueSpy.calls[1].args[0]).toBe('https://www.google.com/section2/page2.html');
				expect(queueSpy.calls[2].args[0]).toBe('https://www.google.com/section/page3.html');
				expect(queueSpy.calls[3].args[0]).toBe('http://external.com/');
			});
		
		});
	
	});

});