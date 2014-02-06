var async = require('async');
var urllib = require('url');
var cheerio = require('cheerio');
var _ = require('underscore');
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
	}, 3);

	// Public properties
	this.acceptCookies = params.acceptCookies !== undefined ? params.acceptCookies : true;
	this.excludePatterns = params.excludePatterns || [];
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

var Page = function (url, isExternal) {
	this.url = url || '';
	this.urlData = urllib.parse(this.url);
	this.html = '';
	this.type = 'text/html';
	this.links = [];
	this.isExternal = isExternal || false;

	// Remove hash from URL
	this.url = this.url.replace(/#.*/gi, '');
};

Page.prototype = {
	dom: function () {
		var $;

		// Make sure this is a text file of some sort
		if (this.type.indexOf('text/') > -1) {
			// Cheerio can kill the process during parsing, make sure it doesn't
			try {
				$ = cheerio.load(this.html);
			} catch (e) {
				console.log('Cheerio parsing error: ' + this.url);
			}
		}

		if ($ === undefined) {
			$ = cheerio.load('');
		}

		return $;
	},
	setHTML: function (html) {
		/*global console */

		var page = this;

		this.html = html || '';

		page.links = [];
		this.dom()('a').each(function () {
			var href = this.attr('href');
			if (href) {
				page.links.push(urllib.resolve(page.url, href));
			}
		});
	}
};

Crawler.prototype = {
	isExternal: function (base, url) {
		var baseURLData = urllib.parse(base);
		var urlData = urllib.parse(url);
		return urlData.protocol !== baseURLData.protocol || urlData.host !== baseURLData.host;
	},
	_responseSuccess: function (pageInfo, response, body, callback) {
		/*jshint scripturl:true */

		var crawler = this,
			i,
			isExternal,
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
				isExternal = false;

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
				isExternal = crawler.isExternal(page.urlData.href, pageLink.urlData.href);

				// Crawl same-domain URL
				// - tell queue whether this is external and to use a HEAD request if true
				crawler.queue(pageLink.url, isExternal, isExternal);
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

		// Check if page was crawled already
		wasCrawled = this._wasCrawled(finalURL);

		// Handle redirect and do not run any other callbacks (success or failure)
		if (wasRedirect === true) {
			this.onRedirect(pageInfo.page, response, wasCrawled);

			// Queues final URL if page was not crawled yet
			if (wasCrawled === false) {
				// Queue the page as an external link if appropriate (using pageInfo.page.isExternal)
				// Note: otherwise the crawler will start crawling the external site
				this.queue(finalURL, pageInfo.page.isExternal, pageInfo.page.isExternal);
			}

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
	queue: function (url, isExternal, useHEAD) {
		var crawler = this,
			urlData = urllib.parse(url),
			isExclude = false;

		// Do not queue if this is an external link and we aren't supposed to crawl external links
		if (isExternal === true && crawler._crawlExternal === false) {
			return false;
		}

		url = urlData.href;

		// This stops pages from being crawled again
		if (crawler._wasCrawled(url) === true) {
			return false;
		}

		// Don't crawl excludes
		_.each(crawler.excludePatterns, function (pattern) {
			var regex = new RegExp(pattern, 'gi');
			if (regex.test(url) === true) {
				isExclude = true;
			}
		});
		if (isExclude === true) {
			return false;
		}
		
		this._pages[url] = {
			page: new Page(url, isExternal),
			crawlLinks: isExternal !== true,
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