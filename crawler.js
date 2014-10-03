var Buffer = require('buffer').Buffer;
var http = require('http');
var https = require('https');
var urllib = require('url');
var async = require('async');
var cheerio = require('cheerio');
var tough = require('tough-cookie');
var winston = require('winston');
var _ = require('underscore');

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
	var page = this;

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
		this.links.push(urllib.resolve(this.url, url));
	},
	setHTML: function (html) {
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
	_request: function (params, callback) {
		var crawler = this;
		var body = '';
		var called = false;
		var error = null;
		var errorTimeout;
		var req;
		var response;

		var COMMON_MEDIA_EXT = /\.(?:3gp|aif|asf|asx|avi|flv|iff|m3u|m4a|m4p|m4v|mov|mp3|mp4|mpa|mpg|mpeg|ogg|ra|raw|rm|swf|vob|wav|wma|wmv)$/;

		// Set timeout for request
		var requestTimeout = setTimeout(function () {
			if (req) {
				req.abort();
			}
			error = { message: 'Request timed out.', code: 'ETIMEDOUT' };
			finish();
		}, params.timeout || 30000);

		function doRequest(url, useAuth) {
			var urlData = urllib.parse(url);
			var requestFunc = http;
			var query = urlData.search || '';

			// Select correct protocol
			if (urlData.protocol === 'https:') {
				requestFunc = https;
			}

			// Attempt request
			try {
				req = requestFunc.request({
					method: params.method || 'GET',
					protocol: urlData.protocol,
					host: urlData.hostname,
					port: urlData.port,
					path: urlData.pathname + query,
					rejectUnauthorized: params.hasOwnProperty('strictSSL') ? params.strictSSL : false,
					headers: _.extend({
						'cookie': crawler.jar ? crawler.jar.getCookiesSync(urlData.href).join('; ') : '',
						'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/33.0.1750.149 Safari/537.36',
						'Authorization': useAuth && params.auth ? 'Basic ' + new Buffer(params.auth.username + ':' + params.auth.password).toString('base64') : '',
						'PageSpeed': 'off' // disable ModPageSpeed
					}, params.headers || {})
				}, function (res) {
					var contentType = '';
					response = res; // Set response
					clearTimeout(errorTimeout); // Clear error and try to download

					// Set response.url to current URL
					response.url = url;

					// Follow redirect
					if (
						response.statusCode &&
						response.statusCode.toString().indexOf('30') === 0 &&
						response.headers.location
					) {
					
						// Save cookies
						if (crawler.jar !== false) {
							_.each(response.headers['set-cookie'], function (cookie) {
								crawler.jar.setCookieSync(cookie, urlData.href, {
									ignoreError: true
								});
							});
						}

						// Peform redirect
						req.abort();
						doRequest(urllib.resolve(url, response.headers.location));
						return;
					}

					// Try to authenticate
					if (
						response.statusCode &&
						response.statusCode === 401 &&
						params.auth
					) {
						// Use credentials
						req.abort();
						doRequest(url, true);
						return;
					}

					// Update response
					if (typeof response === 'object' && typeof response.headers === 'object' && response.headers.hasOwnProperty('content-type') === true) {
						contentType = response.headers['content-type'];
					}

					// Do not download non-text documents or external page content
					if (
						contentType.indexOf('text/') < 0 ||
						// Eliminate common file extensions that do not have the correct content-type
						contentType.indexOf('text/') > -1 && COMMON_MEDIA_EXT.test(params.url) === true ||
						// Exclude external pages - we don't care about the content
						params.isExternal === true
					) {
						req.abort();
						finish();
						return;
					}

					// Download text/HTML
					res.on('data', function (data) {
						body += data.toString();
					});

					res.on('end', function () {
						finish();
					});
				});
			} catch (err) {
				error = err;
				finish();
				return;
			}

			req.on('error', function (err) {
				error = err;
				errorTimeout = setTimeout(finish, 10);
			});

			req.end();
		}

		doRequest(params.url);

		function finish() {
			if (called === true) {
				return;
			}
			called = true;
			clearTimeout(errorTimeout);
			clearTimeout(requestTimeout);
			callback(error, response, body);
		}
	},
	_crawlPage: function (pageInfo, finishCallback) {
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

			// Update page.type
			if (typeof response === 'object' && typeof response.headers === 'object' && response.headers.hasOwnProperty('content-type') === true) {
				page.type = response.headers['content-type'].replace(/;.*/g, '').replace(/(^\s+|\s+$)/g, '');
			}

			crawler._onResponse(pageInfo, error, response, body, finishCallback);
		});
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
	queue: function (url, referrer, isExternal) {
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
			page: new Page(url, referrer, isExternal),
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