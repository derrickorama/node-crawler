var pathlib = require('path');
var urllib = require('url');

var Crawler = (function () {
  'use strict';

  var _crawlExternal = false;
  var _crawledUrls = [];
  var _excludes = [];
  var _events = {
    finish: [],
    pageCrawled: []
  };
  var _mainUrl = null;
  var _urlsQueued = [];

  return new class {
    constructor(params) {
      'use strict';

    	// if (typeof params !== 'object') {
    	// 	params = {};
    	// }
      //
    	// var crawler = this;
      //
    	// // Private properties
    	// this._crawlExternal = params.crawlExternal || false;
    	// this._killed = false;
    	// this._urlsCrawled = [];
    	// this.workers = params.workers || 4;
    	// this._queue = async.queue(function (page, callback) {
    	// 	crawler._crawlPage(page, callback);
    	// }, this.workers);
      //
    	// // Public properties
      //
    	// // Set cookie jar
    	// if (params.jar === false) {
    	// 	this.jar = false;
    	// } else {
    	// 	// Create new jar if "true" or use jar provided
    	// 	this.jar = typeof params.jar === 'object' ? params.jar : new tough.CookieJar();
    	// }
      //
    	// this.auth = params.auth || false;
    	// this.excludePatterns = params.excludePatterns || [];
    	// this.onDrain = params.onDrain || function () {};
    	// this.onError = params.onError || function () {};
    	// this.onPageCrawl = params.onPageCrawl || function () {};
    	// this.onRedirect = params.onRedirect || function () {};
    	// this.retries = params.retries || 0;
    	// this.strictSSL = params.strictSSL || false;
    	// this.timeout = params.timeout || 60000;
      //
    	// this._queue.drain = function () {
    	// 	crawler.onDrain();
    	// };
    }

    queued() {
      return _urlsQueued;
    }

    queue (url) {
      var isExcludedUrl;
      var urlData = urllib.parse(url);
      var normalizedUrl = urlData.href.replace(/#.*/gi, '');

      // Set main URL if one is not already set
      if (_mainUrl === null) {
        _mainUrl = urllib.parse(normalizedUrl);;
      }

      // Do not add external URLs to the queue if they shouldn't be crawled
      if (isExternal(urlData) === true && this.crawlExternal() === false) {
        return false;
      }

      // Do not add URLs that are already in the queue
      if (_urlsQueued.indexOf(normalizedUrl) > -1) {
        return false;
      }

      // Do not add URLs that have already been crawled
      if (this.getCrawled().indexOf(normalizedUrl) > -1) {
        return false;
      }

      // Do not add URLs that match any exclude patterns
      isExcludedUrl = _excludes.reduce((isExclude, exclude) => (exclude.test(normalizedUrl) || isExclude), false);
      if (isExcludedUrl) {
        return false;
      }

      // Add to queue
      _urlsQueued.push(normalizedUrl);

      return true;
    }

    crawlExternal(update) {
      if (!update) {
        return _crawlExternal;
      }
      _crawlExternal = Boolean(update);
    }

    excludes(excludesList) {
      if (!excludesList) {
        return _excludes;
      }
      _excludes = excludesList;
    }

    getCrawled() {
      return _crawledUrls;
    }

    markCrawled(url) {
      if (_crawledUrls.indexOf(url) === -1) {
        _crawledUrls.push(url);
      }
    }

    on(event, callback) {
      _events[event].push(callback);
    }

    start() {
      crawlNextPage();
    }
  }

  function isExternal(urlData) {
		return urlData.protocol !== _mainUrl.protocol || urlData.host !== _mainUrl.host;
  }

  function crawlNextPage() {
    var request = require(pathlib.join(__dirname, 'request'));
    var nextPage = _urlsQueued.shift();

    // If there are no more pages, call the "finish" event
    if (nextPage === undefined) {
      return _events.finish.forEach((callback) => callback());
    }

    // Get page data
    request({
      url: nextPage
    }, function (error, response, body) {

      // Run all callbacks for the pageCrawled event
      _events.pageCrawled.forEach((callback) => callback(error, response, body));

      // Process next page
      crawlNextPage();
    });
  }
});

exports.Crawler = Crawler;
