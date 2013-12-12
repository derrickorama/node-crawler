var async = require('async');
var http = require('http');
var https = require('https');
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
		var crawler = this,
			i,
			page = pageInfo.page,
			pageLink,
			pageLinkData,
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

				// Ignore mailto: links
				if (
					pageLink.urlData.protocol === 'mailto:' ||
					pageLink.urlData.protocol === 'javascript:' ||
					pageLink.urlData.protocol === 'tel:' ||
					pageLink.urlData.path === null
				) {
					continue;
				}

				// Make sure we're crawling a link on the same domain
				if (
					/^\w+\:\/\//.test(pageLink.url) === true &&
					(
						pageLink.urlData.protocol !== page.urlData.protocol ||
						pageLink.urlData.host !== page.urlData.host
					)
				) {
					// Don't crawl external URLs if external URL crawling is not specified
					if (crawler._crawlExternal !== true) {
						continue;
					}

					// Crawl external URL
					crawler.queue(pageLink.url, false, true);

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
			(error && error.code && error.code === 'HPE_INVALID_CONSTANT')
		) {
			pageInfo.method = 'GET';
			this._crawlPage(pageInfo, callback);
			return false;
		}

		callback('onError', [pageInfo.page, error, response]);
	},
	_crawlPage: function (pageInfo, callback) {
		var crawler = this,
			page = pageInfo.page,
			method = pageInfo.method;

		request({
			url: page.url,
			method: method,
			timeout: this.timeout,
			strictSSL: this.strictSSL,
			jar: this.acceptCookies ? request.jar() : false,
			headers: {
				'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
			}
		}, function (error, response, body) {
			// If the crawler was killed before this request was ready, finish the process
			if (crawler._killed === true) {
				callback();
				return false;
			}

			if (error === null && response.statusCode === 200) {
				crawler._responseSuccess(pageInfo, response, body, callback);
			} else {
				// Try to load the page again if more than 0 retries are specified
				if (crawler.retries > 0) {
					if (pageInfo._retries === undefined) {
						pageInfo._retries = 0;
					}

					// If retries haven't reached the maximum retries, retry the request
					if (pageInfo._retries < crawler.retries) {
						pageInfo._retries++;
						crawler._crawlPage(pageInfo, callback);
						return false;
					}
				}

				// This page is bad, send error
				crawler._responseError(pageInfo, response, error, callback);
			}
		});
	},
	queue: function (url, crawlLinksOnPage, useHEAD) {
		var crawler = this,
			urlData = urllib.parse(url);

		url = urlData.href;

		if (this._pages.hasOwnProperty(url) === true) {
			return false;
		}

		// This stops pages from being crawled again
		this._pages[url] = {
			page: new Page(url),
			crawlLinks: crawlLinksOnPage === false ? false : true,
			method: useHEAD === true ? 'HEAD' : 'GET'
		};

		this._queue.push(this._pages[url], function (callback, args) {
			if (callback !== undefined) {
				crawler[callback].apply(this, args);
			}
		});

		return true;
	},
	kill: function () {
		this._killed = true;
		this._queue.tasks = [];
		this._queue.process = function () {}; // This makes any future calls 
	}
};

exports.Crawler = Crawler;
exports.Page = Page;