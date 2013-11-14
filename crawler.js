var async = require('async');
var http = require('http');
var https = require('https');
var urllib = require('url');
var cheerio = require('cheerio');
var request = require('request');
var _ = require('underscore');

var Crawler = function (params) {
	if (typeof params !== 'object') {
		params = {};
	}

	var crawler = this;

	// Private properties
	this._crawlExternal = params.crawlExternal || false;
	this._pages = {};
	this._queue = async.queue(function (page, callback) {
		crawler._crawlPage(page, callback);
	}, 2);

	// Public properties
	this.onDrain = params.onDrain || function () {};
	this.onError = params.onError || function () {};
	this.onPageCrawl = params.onPageCrawl || function () {};
	this.timeout = params.timeout || 60000;

	this._queue.drain = function () {
		crawler.onDrain();
	};
};

var Page = function (url) {
	this.url = url || '';
	this.urlData = urllib.parse(this.url);
	this.html = '';
	this.$ = cheerio.load('');
	this.links = [];
};

Page.prototype = {
	setHTML: function (html) {
		var page = this;

		this.html = html || '';
		this.$ = cheerio.load(this.html);

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
			page = pageInfo.page;

		page.setHTML(body);

		if (pageInfo.crawlLinks === true) {
			_.each(page.links, function (pageLink) {
				var pageLinkData = urllib.parse(pageLink);

				// Ignore mailto: links
				if (
					pageLinkData.protocol === 'mailto:' ||
					pageLinkData.protocol === 'javascript:' ||
					pageLinkData.protocol === 'tel:' ||
					pageLinkData.path === null
				) {
					return false;
				}

				// Make sure we're crawling a link on the same domain
				if (/^\w+\:\/\//.test(pageLink) === true && pageLink.indexOf(page.urlData.protocol + '//' + page.urlData.host) !== 0) {
					
					// Don't crawl external URLs if external URL crawling is not specified
					if (crawler._crawlExternal !== true) {
						return false;
					}

					crawler.queue(pageLink, false, true);

					return false;
				}

				// If this is a relative URL, resolve the path
				if (pageLinkData.host === null) {
					pageLink = urllib.resolve(page.url, pageLink);
				}

				crawler.queue(pageLink);
			});
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

		request[method](page.url, function (error, response, body) {
			if (error === null && response.statusCode === 200) {
				crawler._responseSuccess(pageInfo, response, body, callback);
			} else {
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
			crawler[callback].apply(this, args);
		});
	}
};

exports.Crawler = Crawler;
exports.Page = Page;