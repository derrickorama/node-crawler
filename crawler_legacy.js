var http = require('http');
var https = require('https');
var urllib = require('url');
var async = require('async');
var cheerio = require('cheerio');
var tough = require('tough-cookie');
var winston = require('winston');
var _ = require('underscore');

var Crawler = function (params) {
	'use strict';

	if (typeof params !== 'object') {
		params = {};
	}

	var crawler = this;

	// Private properties
	this._crawlExternal = params.crawlExternal || false;
	this._killed = false;
	this._urlsCrawled = [];
	this.workers = params.workers || 4;
	this._queue = async.queue(function (page, callback) {
		crawler._crawlPage(page, callback);
	}, this.workers);

	// Public properties

	// Set cookie jar
	if (params.jar === false) {
		this.jar = false;
	} else {
		// Create new jar if "true" or use jar provided
		this.jar = typeof params.jar === 'object' ? params.jar : new tough.CookieJar();
	}

	this.auth = params.auth || false;
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

var Page = function (url, referrer, isExternal) {
	'use strict';

	this.url = url || '';
	this.urlData = urllib.parse(this.url);
	this.html = '';
	this.redirects = [];
	this.type = '';
	this.links = [];
	this.referrer = referrer;
	this.isExternal = isExternal || false;

	// Remove hash from URL
	this.url = this.url.replace(/#.*/gi, '');
};

Page.prototype = {
	dom: function () {
		'use strict';

		var $;

		// Cheerio can kill the process during parsing, make sure it doesn't
		try {
			$ = cheerio.load(this.html);
		} catch (e) {
			console.log('Cheerio parsing error: ' + this.url);
		}

		if ($ === undefined) {
			$ = cheerio.load('');
		}

		return $;
	},
	addLink: function (url) {
		'use strict';

		this.links.push(urllib.resolve(this.url, url));
	},
	setHTML: function (html) {
		'use strict';

		var page = this;

		this.html = html || '';

		page.links = [];
		this.dom()('a').each(function () {
			var href = this.attr('href');
			if (href) {
				page.addLink(href);
			}
		});
	}
};

Crawler.prototype = {
	_responseSuccess: function (pageInfo, response, body, callback) {
		/*eslint no-script-url:0 */
		'use strict';

		var crawler = this,
			i,
			isExternal,
			page = pageInfo.page,
			pageLink,
			pageLinksLength;

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
				crawler.queue(pageLink.url, page.url, isExternal);
			}
		}

		callback('onPageCrawl', [page, response]);
	},
	_responseError: function (pageInfo, response, error, callback) {
		'use strict';

		// Replace response with an object if it is not one already
		if (_.isObject(response) !== true) {
			response = {
				req: {}
			};
		}

		// Extend response.req (in case it's undefined)
		response = _.extend({
			req: {}
		}, response);

		callback('onError', [pageInfo.page, error, response]);
	},
	_wasCrawled: function (url) {
		'use strict';

		if (!url) {
			url = '';
		}

		if (typeof url !== 'string') {
			url = url.toString();
		}

		var href = urllib.parse(url).href;

		if (this._urlsCrawled.indexOf(href) > -1) {
			return true;
		}

		return false;
	},
	_crawlPage: function (pageInfo, finishCallback) {
		'use strict';

		var crawler = this;
		var page = pageInfo.page;

		// Check headers for content-type
		this._request({
			url: page.url,
			timeout: crawler.timeout,
			strictSSL: crawler.strictSSL,
			isExternal: page.isExternal,
			auth: crawler.auth
		}, function (error, response, body) {
			if (error) {
				winston.error('Failed on: ' + page.url);
				winston.error(error.message);
			}

			crawler._onResponse(pageInfo, error, response, body, finishCallback);
		});
	},
	_processRedirect: function (pageInfo, finalURL, response) {
		'use strict';

		/*
		| Note: this section was particularly picky. The sequence of events is important.
		*/
		var cleanFinalURL = urllib.parse(finalURL).href;
		var wasAdded = false;

		// Determine if page URL was queued
		if (this._wasCrawled(cleanFinalURL) === false) {
			this._urlsCrawled.push(cleanFinalURL); // Add URL to URLs crawled
		} else {
			wasAdded = true;
		}

		// Handle redirected page
		this.onRedirect(_.clone(pageInfo.page), response, finalURL);

		// Update page info
		pageInfo.page.redirects.push(pageInfo.page.url); // Save redirect
		pageInfo.page.url = cleanFinalURL;

		// If page was already added/queued, skip the processing
		if (wasAdded === true) {
			return null;
		}

		// Update pageInfo so that it's processing the page it was redirected to and not the redirect
		return pageInfo;
	},
	_onResponse: function (pageInfo, error, response, body, finishCallback) {
		'use strict';

		// If the crawler was killed before this request was ready, finish the process
		if (this._killed === true) {
			finishCallback();
			return false;
		}

		var finalURL;

		// Make sure response is an object
		if (!response || typeof response !== 'object') {
			response = {};
		}

		// Store the final URL (in case there was a redirect)
		if (response.url) {
			finalURL = response.url;
		}

		// Check if page was a redirect and save the redirect data
		if (finalURL !== undefined && finalURL !== pageInfo.page.url) {

			// Check if redirect went to an external URL
			if (pageInfo.page.isExternal === false && this.isExternal(pageInfo.page.url, finalURL) === true) {
				pageInfo.page.isExternal = true;
			}

			// Process redirect and get new, detached (cloned) object
			pageInfo = this._processRedirect(pageInfo, finalURL, response);

			// If pageInfo is null, skip it. It's already been processed.
			if (pageInfo === null) {
				finishCallback();
				return false;
			}
		}

		// Ignore error if it's due to a bad content-length and we're checking an external link
		if (
			error !== null &&
			error.code === 'HPE_INVALID_CONSTANT' &&
			_.pluck(response.headers, 'content-length').length > 0 &&
			response.statusCode === 200 &&
			pageInfo.page.isExternal === true
		) {
			error = null;
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
	_asyncQueueCallback: function (callback, args) {
		'use strict';

		if (callback !== undefined) {
			this[callback].apply(this, args);
		}
	},
	kill: function () {
		'use strict';

		this._killed = true;
		this._queue.tasks = [];
		this._queue.process = function () {}; // This makes any future calls
	}
};

exports.Crawler = Crawler;
exports.Page = Page;
