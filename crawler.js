var async = require('async');
var urllib = require('url');
var cheerio = require('cheerio');
var request = require('request');

var Crawler = function (params) {
	if (typeof params !== 'object') {
		params = {};
	}

	var crawler = this;

	// Private properties
	this._crawlExternal = params.crawlExternal || false;
	this._killed = false;
	this._pages = {};
	this._queue = async.queue(function (page, callback) {
		crawler._crawlPage(page, callback);
	}, 2);

	// Public properties
	this.acceptCookies = params.acceptCookies !== undefined ? params.acceptCookies : true;
	this.onDrain = params.onDrain || function () {};
	this.onError = params.onError || function () {};
	this.onPageCrawl = params.onPageCrawl || function () {};
	this.onRedirect = params.onRedirect || function () {};
	this.retries = params.retries || 0;
	this.strictSSL = params.strictSSL || false;
	this.timeout = params.timeout || 60000;

	this._queue.drain = function () {
		crawler.onDrain();
	};
};

var Page = function (url) {
	this.url = url || '';
	this.urlData = urllib.parse(this.url);
	this.html = '';
	this.type = 'text/html';
	this.$ = cheerio.load('');
	this.links = [];

	// Remove hash from URL
	this.url = this.url.replace(/#.*/gi, '');
};

Page.prototype = {
	setHTML: function (html) {
		/*global console */

		var page = this;

		this.html = html || '';

		// Make sure this is a text file of some sort
		if (this.type.indexOf('text/') > -1) {
			// Cheerio can kill the process during parsing, make sure it doesn't
			try {
				this.$ = cheerio.load(this.html);
			} catch (e) {
				console.log('Cheerio parsing error: ' + this.url);
			}
		}

		page.links = [];
		this.$('a').each(function () {
			var href = this.attr('href');
			if (href) {
				page.links.push(urllib.resolve(page.url, href));
			}
		});
	}
};

Crawler.prototype = {
	_responseSuccess: function (pageInfo, response, body, callback) {
		/*jshint scripturl:true */

		var crawler = this,
			i,
			page = pageInfo.page,
			pageLink,
			pageLinksLength;

		// Update page.type
		if (typeof response === 'object' && typeof response.headers === 'object' && response.headers.hasOwnProperty('content-type') === true) {
			page.type = response.headers['content-type'].replace(/;.*/g, '').replace(/(^\s+|\s+$)/g, '');
		}

		// Update HTML
		page.setHTML(body);

		if (pageInfo.crawlLinks === true) {
			pageLinksLength = page.links.length;
			for (i = 0; i < pageLinksLength; i++) {
				pageLink = new Page(urllib.resolve(page.url, page.links[i]));

				// Ignore non-page links
				if (
					pageLink.urlData.protocol === 'mailto:' ||
					pageLink.urlData.protocol === 'javascript:' ||
					pageLink.urlData.protocol === 'tel:' ||
					pageLink.urlData.host === ''
				) {
					continue;
				}

				// Make sure we're crawling a link on the same domain
				if (
					pageLink.urlData.protocol !== page.urlData.protocol ||
					pageLink.urlData.host !== page.urlData.host
				) {
					// Crawl external URLs if external URL crawling is true
					if (crawler._crawlExternal === true) {
						crawler.queue(pageLink.url, false, true);
					}
					continue;
				}

				// Crawl same-domain URL
				crawler.queue(pageLink.url);
			}
		}

		callback('onPageCrawl', [page, response]);
	},
	_responseError: function (pageInfo, response, error, callback) {
		if (typeof response !== 'object') {
			response = {};
		}

		// If a 405 was returned when requesting the HEAD, try GET instead
		if (
			((response.statusCode === 405 || response.statusCode === 403) && response.req.method === 'HEAD') ||
            // TODO: write tests for HTTP parsing errors (below)
			(error && error.code && (error.code === 'HPE_INVALID_CONSTANT' || error.code === 'HPE_INVALID_HEADER_TOKEN'))
		) {
			pageInfo.method = 'GET';
			this._crawlPage(pageInfo, callback);
			return false;
		}

		callback('onError', [pageInfo.page, error, response]);
	},
	_wasCrawled: function (url) {
		if (!url) {
			url = '';
		}

		if (typeof url !== 'string') {
			url = url.toString();
		}

		var href = urllib.parse(url).href;

		if (this._pages.hasOwnProperty(href) === true) {
			return true;
		}

		return false;
	},
	_request: request,
	_crawlPage: function (pageInfo, finishCallback) {
		var crawler = this,
			page = pageInfo.page,
			method = pageInfo.method;

		this._request({
			url: page.url,
			method: method,
			timeout: this.timeout,
			strictSSL: this.strictSSL,
			jar: this.acceptCookies ? request.jar() : false,
			headers: {
				'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
			}
		}, function (error, response, body) {
			crawler._onResponse(pageInfo, error, response, body, finishCallback);
		});
	},
	_onResponse: function (pageInfo, error, response, body, finishCallback) {
		// If the crawler was killed before this request was ready, finish the process
		if (this._killed === true) {
			finishCallback();
			return false;
		}

		var finalURL,
			wasRedirect = false,
			wasCrawled;

		// Make sure response is an object
		if (!response || typeof response !== 'object') {
			response = {};
		}

		// Store the final URL (in case there was a redirect)
		if (typeof response.request === 'object') {
			finalURL = response.request.href;
		}

		// Check if page was a redirect and save the redirect data
		if (finalURL !== undefined && finalURL !== pageInfo.page.url) {
			pageInfo.page.redirect = finalURL;
			wasRedirect = true;
		}

		wasCrawled = this._wasCrawled(finalURL);

		// Calls onRedirect callback
		if (wasRedirect === true) {
			this.onRedirect(pageInfo.page, response, wasCrawled);
		}

		// Exits if page was already crawled/processed
		if (wasRedirect === true && wasCrawled === true) {
			finishCallback();
			return false;
		}

		if (error === null && response.statusCode === 200) {
			this._responseSuccess(pageInfo, response, body, finishCallback);
		} else {
			// Try to load the page again if more than 0 retries are specified
			if (this.retries > 0) {
				if (pageInfo._retries === undefined) {
					pageInfo._retries = 0;
				}

				// If retries haven't reached the maximum retries, retry the request
				if (pageInfo._retries < this.retries) {
					pageInfo._retries++;
					this._crawlPage(pageInfo, finishCallback);
					return false;
				}
			}

			// This page is bad, send error
			this._responseError(pageInfo, response, error, finishCallback);
		}
	},
	queue: function (url, crawlLinksOnPage, useHEAD) {
		var crawler = this,
			urlData = urllib.parse(url);

		url = urlData.href;

		// This stops pages from being crawled again
		if (crawler._wasCrawled(url) === true) {
			return false;
		}
		
		this._pages[url] = {
			page: new Page(url),
			crawlLinks: crawlLinksOnPage === false ? false : true,
			method: useHEAD === true ? 'HEAD' : 'GET'
		};

		this._queue.push(this._pages[url], function () {
			crawler._asyncQueueCallback.apply(crawler, arguments);
		});

		return true;
	},
	_asyncQueueCallback: function (callback, args) {
		if (callback !== undefined) {
			this[callback].apply(this, args);
		}
	},
	kill: function () {
		this._killed = true;
		this._queue.tasks = [];
		this._queue.process = function () {}; // This makes any future calls 
	}
};

exports.Crawler = Crawler;
exports.Page = Page;