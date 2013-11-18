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
				var url = urllib.format(urllib.parse(href));
				page.links.push(url);
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
		page.type = response.headers['content-type'].replace(/;.*/g, '').replace(/(^\s+|\s+$)/g, '');

		// Update HTML
		page.setHTML(body);

		if (pageInfo.crawlLinks === true) {
			pageLinksLength = page.links.length;
			for (i = 0; i < pageLinksLength; i++) {
				pageLink = page.links[i];
				pageLinkData = urllib.parse(pageLink);

				// Ignore mailto: links
				if (
					pageLinkData.protocol === 'mailto:' ||
					pageLinkData.protocol === 'javascript:' ||
					pageLinkData.protocol === 'tel:' ||
					pageLinkData.path === null
				) {
					continue;
				}

				// Make sure we're crawling a link on the same domain
				if (/^\w+\:\/\//.test(pageLink) === true && pageLink.indexOf(page.urlData.protocol + '//' + page.urlData.host) !== 0) {
					
					// Don't crawl external URLs if external URL crawling is not specified
					if (crawler._crawlExternal !== true) {
						continue;
					}

					crawler.queue(pageLink, false, true);

					continue;
				}

				// If this is a relative URL, resolve the path
				if (pageLinkData.host === null) {
					pageLink = urllib.resolve(page.url, pageLink);
				}

				crawler.queue(pageLink);
			}
		}

		callback('onPageCrawl', [page, response]);
	},
	_responseError: function (pageInfo, response, error, callback) {
		if (typeof response !== 'object') {
			response = {};
		}

		// If a 405 was returned when requesting the HEAD, try GET instead
		if (response.statusCode === 405 && response.req.method === 'HEAD') {
			pageInfo.method = 'get';
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
			jar: this.acceptCookies,
			headers: {
				'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.48 Safari/537.36'
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
			method: useHEAD === true ? 'head' : 'get'
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