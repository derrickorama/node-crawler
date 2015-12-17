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

Crawler.prototype = {
	kill: function () {
		'use strict';

		this._killed = true;
		this._queue.tasks = [];
		this._queue.process = function () {}; // This makes any future calls
	}
};

exports.Crawler = Crawler;
exports.Page = Page;
