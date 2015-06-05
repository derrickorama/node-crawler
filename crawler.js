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
	isExternal: function (base, url) {
		'use strict';

		var baseURLData = urllib.parse(base);
		var urlData = urllib.parse(url);
		return urlData.protocol !== baseURLData.protocol || urlData.host !== baseURLData.host;
	},
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
	_request: function (params, callback) {
		'use strict';

		var Buffer = require('buffer').Buffer;

		var crawler = this;
		var body = new Buffer('');
		var called = false;
		var error = null;
		var errorTimeout;
		var redirects = 0;
		var req;
		var requestTimeout;
		var response;

		var COMMON_MEDIA_EXT = /\.(?:3gp|aif|asf|asx|avi|flv|iff|m3u|m4a|m4p|m4v|mov|mp3|mp4|mpa|mpg|mpeg|ogg|ra|raw|rm|swf|vob|wav|wma|wmv)$/;

		// Set timeout for request
		function waitForTimeout() {
			clearTimeout(requestTimeout);
			requestTimeout = setTimeout(function () {
				if (req) {
					req.abort();
				}
				error = { message: 'Request timed out.', code: 'ETIMEDOUT' };
				finish();
			}, params.timeout || 30000);
		}

		waitForTimeout();

		function doRequest(url, useAuth, secureProtocol) {
			var urlData = urllib.parse(url);
			var requestFunc = http;
			var query = urlData.search || '';
			var secureProtocolFix = false;

			// Make sure params.headers is an object by default
			if (!params.headers) {
				params.headers = {};
			}

			// Select correct protocol
			if (urlData.protocol === 'https:') {
				requestFunc = https;
			}

			// Add authorization if available and useAuth is flagged
			if (useAuth && params.auth) {
				params.headers.Authorization = 'Basic ' + new Buffer(params.auth.username + ':' + params.auth.password).toString('base64');
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
					secureProtocol: secureProtocol,
					headers: _.extend({
						'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
						'Accept-Encoding': 'gzip, sdch',
						'Accept-Language': 'en-US,en;q=0.8',
						'cookie': crawler.jar ? crawler.jar.getCookiesSync(urlData.href).join('; ') : '',
						'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2272.76 Safari/537.36',
						'PageSpeed': 'off' // disable ModPageSpeed
					}, params.headers)
				}, function (res) {
					var contentType = '';
					var deflateBody;

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

						if (redirects > 9) {
							error = {
								code: 'MAX_REDIRECTS_REACHED',
								message: 'The requested URL has redirected more than 9 times. This could indicate an infinite redirect loop.'
							};
							finish();
							return;
						}

						waitForTimeout();
						redirects++;
						doRequest(urllib.resolve(url, response.headers.location));
						return;
					}

					// Try to resolve secure protocol issues
					if (resolveSecureProtocol(url, urlData.protocol, useAuth, secureProtocol) === true) {
						return;
					}

					// Try to authenticate internal 401s
					if (
						params.isExternal !== true &&
						response.statusCode &&
						response.statusCode === 401 &&
						params.auth
					) {
						// Use credentials
						req.abort();
						doRequest(url, true);
						return;
					}

					if (response.headers['content-encoding'] === 'gzip') {
						deflateBody = true;
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
						// Set page HTML to nothing since we haven't downloaded the body yet
						body = '';
						req.abort();
						finish();
						return;
					}

					// Download text/HTML
					res.on('data', function (data) {
						body = Buffer.concat([body, data]);
					});

					res.on('end', function () {
						var zlib = require('zlib');

						if (deflateBody === true) {
							zlib.unzip(body, function(err, buffer) {
								if (err) {
									console.error(err);
								}
								body = buffer.toString();
								finish();
							});
						} else {
							body = body.toString();
							finish();
						}
					});
				});
			} catch (err) {
				console.error(err.stack);
				error = err;
				finish();
				return;
			}

			req.on('error', function (err) {
				// Make sure this isn't a secure protocol error
				if (resolveSecureProtocol() === true) {
					return;
				}

				error = err;
				errorTimeout = setTimeout(finish, 10);
			});

			req.end();

			function resolveSecureProtocol() {
				// Do not run the fix if it has already been fixed
				if (secureProtocolFix === true) {
					return false;
				}

				secureProtocolFix = true;

				if (
					urlData.protocol === 'https:' &&
					(
						!response ||
						!response.statusCode ||
						response.statusCode !== 200
					) &&
					(
						secureProtocol === undefined || secureProtocol === 'TLSv1_client_method'
					)
				) {
					req.abort();

					if (secureProtocol === 'TLSv1_client_method') {
						// Try the other secure protocol
						secureProtocol = 'SSLv3_client_method';
					} else {
						// Try using nothing
						secureProtocol = 'TLSv1_client_method';
					}

					doRequest(url, params.auth, secureProtocol);
					return true;
				}

				return false;
			}
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

			// Update page.type
			if (typeof response === 'object' && typeof response.headers === 'object' && response.headers.hasOwnProperty('content-type') === true) {
				page.type = response.headers['content-type'].replace(/;.*/g, '').replace(/(^\s+|\s+$)/g, '');
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
	queue: function (url, referrer, isExternal) {
		'use strict';

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
