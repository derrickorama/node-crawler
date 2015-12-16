var pathlib = require('path');
var urllib = require('url');

var Crawler = (function () {
  'use strict';

  var _props = {
    crawlExternal: false,
    events: {
      finish: [],
      pageCrawled: [],
      redirect: []
    },
    excludes: [],
    mainUrl: null,
    urlsCrawled: [],
    urlsQueued: []
  };

  return new class {

    /*
    | PUBLIC METHODS
    */

    constructor() {
      /*eslint no-mixed-spaces-and-tabs:0 */
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
      this._get = function (name) {
        return _props[name];
      };
      this._set = function (name, value) {
        _props[name] = value;
      };
    }

    markCrawled(url) {
      var urlsCrawled = this._get('urlsCrawled');

      if (urlsCrawled.indexOf(url) === -1) {
        urlsCrawled.push(url);
      }
    }

    normalizeUrl (url) {
      var urlData = urllib.parse(url);
      return urlData.href.replace(/#.*/gi, '');
    }

    on(event, callback) {
      this._get('events')[event].push(callback);
    }

    queue (url) {
      var isExcludedUrl;
      var urlData = urllib.parse(url);
      var normalizedUrl = urlData.href.replace(/#.*/gi, '');
      var urlsQueued = this._get('urlsQueued'); // this object will update without "set"

      // Do not add external URLs to the queue if they shouldn't be crawled
      if (this._isExternal(urlData) === true && this._get('crawlExternal') === false) {
        return false;
      }

      // Do not add URLs that are already in the queue
      if (urlsQueued.indexOf(normalizedUrl) > -1) {
        return false;
      }

      // Do not add URLs that have already been crawled
      if (this._get('urlsCrawled').indexOf(normalizedUrl) > -1) {
        return false;
      }

      // Do not add URLs that match any exclude patterns
      isExcludedUrl = this._get('excludes').reduce((isExclude, exclude) => (exclude.test(normalizedUrl) || isExclude), false);
      if (isExcludedUrl) {
        return false;
      }

      // Add to queue
      urlsQueued.push(normalizedUrl);

      return true;
    }

    set (name, value) {
      switch (name) {
        case 'mainUrl':
          this._set('mainUrl', urllib.parse(this.normalizeUrl(value)));
          break;
        default:
          this._set(name, value);
      }
    }

    start (url) {
      // Set main URL if one is not already set
      this.set('mainUrl', url);
      this.queue(url);
      this._crawlNextPage();
    }

    /*
    | PRIVATE METHODS
    */

    _crawlNextPage () {
      var request = require(pathlib.join(__dirname, 'request'));
      var nextPage = this._get('urlsQueued').shift();

      // If there are no more pages, call the "finish" event
      if (nextPage === undefined) {
        return this._get('events').finish.forEach((callback) => callback());
      }

      // Get page data
      request({
        url: nextPage
      }, this._onResponse.bind(this, nextPage));
    }

    _isExternal (urlData) {
      var mainUrl = this._get('mainUrl');
      return urlData.protocol !== mainUrl.protocol || urlData.host !== mainUrl.host;
    }

    _onResponse (url, error, response, body) {
      'use strict';

      var urlsCrawled = this._get('urlsCrawled');

      // Make sure response is an object
      if (!response || typeof response !== 'object') {
      	response = {};
      }

      // Run checks and procedures for redirects that may have occurred
      this._processRedirect(url, response);

      // Add final page URL to list of pages crawled
      if (urlsCrawled.indexOf(response.url) < 0) {
        urlsCrawled.push(response.url);
      }

      // Run all callbacks for the pageCrawled event
      this._get('events').pageCrawled.forEach((callback) => callback(error, response, body));

      // Process next page
      this._crawlNextPage();

      // // If the crawler was killed before this request was ready, finish the process
      // if (this._killed === true) {
      // 	finishCallback();
      // 	return false;
      // }
      //
      // var finalURL;
      //
      // // Make sure response is an object
      // if (!response || typeof response !== 'object') {
      // 	response = {};
      // }
      //
      // // Store the final URL (in case there was a redirect)
      // if (response.url) {
      // 	finalURL = response.url;
      // }
      //
      // // Check if page was a redirect and save the redirect data
      // if (finalURL !== undefined && finalURL !== pageInfo.page.url) {
      //
      // 	// Check if redirect went to an external URL
      // 	if (pageInfo.page.isExternal === false && this.isExternal(pageInfo.page.url, finalURL) === true) {
      // 		pageInfo.page.isExternal = true;
      // 	}
      //
      // 	// Process redirect and get new, detached (cloned) object
      // 	pageInfo = this._processRedirect(pageInfo, finalURL, response);
      //
      // 	// If pageInfo is null, skip it. It's already been processed.
      // 	if (pageInfo === null) {
      // 		finishCallback();
      // 		return false;
      // 	}
      // }
      //
      // // Ignore error if it's due to a bad content-length and we're checking an external link
      // if (
      // 	error !== null &&
      // 	error.code === 'HPE_INVALID_CONSTANT' &&
      // 	_.pluck(response.headers, 'content-length').length > 0 &&
      // 	response.statusCode === 200 &&
      // 	pageInfo.page.isExternal === true
      // ) {
      // 	error = null;
      // }
      //
      // if (error === null && response.statusCode === 200) {
      // 	this._responseSuccess(pageInfo, response, body, finishCallback);
      // } else {
      // 	// Try to load the page again if more than 0 retries are specified
      // 	if (this.retries > 0) {
      // 		if (pageInfo._retries === undefined) {
      // 			pageInfo._retries = 0;
      // 		}
      //
      // 		// If retries haven't reached the maximum retries, retry the request
      // 		if (pageInfo._retries < this.retries) {
      // 			pageInfo._retries++;
      // 			this._crawlPage(pageInfo, finishCallback);
      // 			return false;
      // 		}
      // 	}
      //
      // 	// This page is bad, send error
      // 	this._responseError(pageInfo, response, error, finishCallback);
      // }
    }

    _processRedirect (url, response) {
      'use strict';

      var finalUrl;
      var urlsCrawled = this._get('urlsCrawled');

      // Do nothing if response doesn't have a URL
      if (!response.url) {
        return false;
      }

      // Normalize final URL
      finalUrl = this.normalizeUrl(response.url);

      // Redirect detection happens here
      if (url === finalUrl) {
        // This is not a redirect, stop now
        return false;
      }

      // Add URL to list of URLs crawled
      if (urlsCrawled.indexOf(url) < 0) {
        urlsCrawled.push(url);
      }

      // Execute redirect event handlers
      this._get('events').redirect.forEach((callback) => callback(url, response));

      // /*
      // | Note: this section was particularly picky. The sequence of events is important.
      // */
      // var cleanFinalURL = urllib.parse(response.url).href;
      // var wasAdded = false;
      //
      // // Determine if page URL was queued
      // if (this._wasCrawled(cleanFinalURL) === false) {
      // } else {
      // 	wasAdded = true;
      // }
      //
      // // Handle redirected page
      // this.onRedirect(_.clone(pageInfo.page), response, finalURL);
      //
      // // Update page info
      // pageInfo.page.redirects.push(pageInfo.page.url); // Save redirect
      // pageInfo.page.url = cleanFinalURL;
      //
      // // If page was already added/queued, skip the processing
      // if (wasAdded === true) {
      // 	return null;
      // }
      //
      // // Update pageInfo so that it's processing the page it was redirected to and not the redirect
      // return pageInfo;
    }
  }
});

exports.Crawler = Crawler;
