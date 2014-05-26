var http = require('http');
var https = require('https');
var urllib = require('url');
var async = require('async');
var cheerio = require('cheerio');
var phantom = require('phantom');
var request = require('request');
var tough = require('tough-cookie');
var winston = require('winston');
var _ = require('underscore');

var USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/33.0.1750.149 Safari/537.36';

var Crawler = function (params) {
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
	this.acceptCookies = params.acceptCookies !== undefined ? params.acceptCookies : true;
	this.excludePatterns = params.excludePatterns || [];
	this.onDrain = params.onDrain || function () {};
	this.onError = params.onError || function () {};
	this.onPageCrawl = params.onPageCrawl || function () {};
	this.onRedirect = params.onRedirect || function () {};
	this.render = params.render || false;
	this.retries = params.retries || 0;
	this.strictSSL = params.strictSSL || false;
	this.timeout = params.timeout || 60000;

	this._queue.drain = function () {
		crawler.onDrain();
	};
};

var Page = function (url, isExternal) {
	var page = this;

	this.url = url || '';
	this.urlData = urllib.parse(this.url);
	this.html = '';
	this.redirects = [];
	this.type = '';
	this.links = [];
	this.isExternal = isExternal || false;
	this._ph = {
		exit: function () {}
	};
	this._phPage = {
		evaluate: function (evaluate, callback) {
			winston.error(page.PAGE_NOT_RENDERED_ERROR);
			callback();
		}
	};
	this.phWaits = [];

	// Remove hash from URL
	this.url = this.url.replace(/#.*/gi, '');
};

Page.prototype = {
	PAGE_NOT_RENDERED_ERROR: 'Error: Page was not rendered.',
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
		var page = this;

		this.html = html || '';

		page.links = [];
		this.dom()('a').each(function () {
			var href = this.attr('href');
			if (href) {
				page.links.push(urllib.resolve(page.url, href));
			}
		});
	},
	render: function (callback) {
		var page = this;
		callback(this._phPage, function (checkID) {
			page.phExit(checkID);
		});
	},
	phExit: function (checkID) {
		// Find check ID
		var index;

		// Remove check ID from array
		if (checkID) {
			index = this.phWaits.indexOf(checkID);
			if (index > -1) {
				this.phWaits.splice(index, 1);
			}
		}

		// If no other checks are present, close PhantomJS
		if (this.phWaits.length === 0) {
			this._ph.exit();
		}
	}
};

Crawler.prototype = {
	isExternal: function (base, url) {
		var baseURLData = urllib.parse(base);
		var urlData = urllib.parse(url);
		return urlData.protocol !== baseURLData.protocol || urlData.host !== baseURLData.host;
	},
	_renderPage: function (page, finish) {
		phantom.create(function (ph) {
			ph.createPage(function (phPage) {
				phPage.open(page.url, function (status) {
					if (status !== 'success') {
						winston.error('Unable to render page: ' + page.url);
					}

					page._ph = ph;
					page._phPage = phPage;

					finish();
				});
			});
		});
	},
	_responseSuccess: function (pageInfo, response, body, callback) {
		/*jshint scripturl:true */

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
				crawler.queue(pageLink.url, isExternal, isExternal);
			}
		}

		callback('onPageCrawl', [page, response]);
	},
	_responseError: function (pageInfo, response, error, callback) {
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
	headerCheck: function (page, callback, urlOverride, existingJar) {
		var crawler = this;
		var cookiejar = existingJar || new tough.CookieJar();
		var requestFunc = http;
		var urlData = urlOverride || page.urlData;
		var error = null;
		var called = false;
		var errorCallbackTimeout;

		if (urlData.protocol === 'https:') {
			requestFunc = https;
		}

		try {
			var req = requestFunc.request({
				method: 'GET',
				protocol: urlData.protocol,
				host: urlData.hostname,
				port: urlData.port,
				path: urlData.path,
				rejectUnauthorized: false,
				headers: {
					'cookie': cookiejar.getCookiesSync(urlData.href).join('; '),
					'User-Agent': USER_AGENT
				}
			}, function (res) {
				req.abort(); // Abort request, we just wanted the headers
				clearTimeout(errorCallbackTimeout);

				if (
					res.statusCode &&
					res.statusCode.toString().indexOf('30') === 0 &&
					res.headers.location
				) {
					// Save cookies
					_.each(res.headers['set-cookie'], function (cookie) {
						cookiejar.setCookieSync(cookie, urlData.href);
					});

					// Re-check headers
					crawler.headerCheck(page, callback, urllib.parse(urllib.resolve(page.url, res.headers.location)), cookiejar);
					return;
				}

				// Update page.type
				if (typeof res === 'object' && typeof res.headers === 'object' && res.headers.hasOwnProperty('content-type') === true) {
					page.type = res.headers['content-type'].replace(/;.*/g, '').replace(/(^\s+|\s+$)/g, '');
				}

				called = true;
				callback(error, page, res);
			});
		} catch (e) {
			callback(e, page);
		}

		if (req) {
			req.on('error', function (err) {
				error = err;
				errorCallbackTimeout = setTimeout(function () {
					if (called === false) {
						callback(error, page);
					}
				});
			});

			req.end();
		}
	},
	_request: request,
	_crawlPage: function (pageInfo, finishCallback) {
		var crawler = this;
		var page = pageInfo.page;
		var COMMON_MEDIA_EXT = /\.(?:3gp|aif|asf|asx|avi|flv|iff|m3u|m4a|m4p|m4v|mov|mp3|mp4|mpa|mpg|mpeg|ogg|ra|raw|rm|swf|vob|wav|wma|wmv)$/;

		// Check headers for content-type
		this.headerCheck(page, function (error, page, res) {

			// Do not download non-text documents
			if (
				page.type.indexOf('text/') < 0 ||
				error ||
				// Eliminate common file extensions that do not have the correct content-type
				page.type.indexOf('text/') > -1 && COMMON_MEDIA_EXT.test(page.url) === true
			) {
				if (error) {
					winston.error('Failed on: ' + page.url);
					winston.error(error.message);
				}
				done(error, res, '');
				return false;
			}

			// Perform actual request
			crawler._request({
				url: page.url,
				timeout: crawler.timeout,
				strictSSL: crawler.strictSSL,
				jar: crawler.acceptCookies ? request.jar() : false,
				headers: {
					'User-Agent': USER_AGENT
				}
			}, function (error, response, body) {

				if (crawler.render === true) {
					crawler._renderPage(pageInfo.page, function () {
						done(error, response, body);
					});
					return false;
				}

				done(error, response, body);
			});
		});

		function done(error, response, body) {
			crawler._onResponse(pageInfo, error, response, body, finishCallback);
		}
	},
	_processRedirect: function (pageInfo, finalURL, response) {
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
		if (typeof response.request === 'object') {
			finalURL = response.request.href;
		}

		// Check if page was a redirect and save the redirect data
		if (finalURL !== undefined && finalURL !== pageInfo.page.url) {
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
	queue: function (url, isExternal) {
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
		
		// Add page to list of pages
		this._urlsCrawled.push(url);

		// Add to async queue
		this._queue.push({
			page: new Page(url, isExternal),
			crawlLinks: isExternal !== true
		}, function () {
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