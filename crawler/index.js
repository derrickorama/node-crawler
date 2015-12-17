var pathlib = require('path');
var urllib = require('url');

var Crawler = (function () {
  'use strict';

  var _props = {
    crawlExternal: true,
    events: {
      error: [],
      finish: [],
      pageCrawled: [],
      redirect: []
    },
    excludes: [],
    mandatoryExcludes: [
      /^(file|ftp|javascript|mailto|tel|whatsapp):/g
    ],
    mainUrl: null,
    retries: 1,
    retriedUrls: {},
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

    get (name) {
      switch (name) {
        case 'urlsQueued':
          return this._get('urlsQueued').map((queueItem) => (queueItem.url));
        default:
          return this._get(name);
      }
    }

    kill () {
      this._set('urlsQueued', []);
    }

    markCrawled (url) {
      var urlsCrawled = this._get('urlsCrawled');

      if (urlsCrawled.indexOf(url) === -1) {
        urlsCrawled.push(url);
      }
    }

    normalizeUrl (url) {
      var urlData = urllib.parse(url);
      return urlData.href.replace(/#.*/gi, '');
    }

    on (event, callback) {
      this._get('events')[event].push(callback);
    }

    queue (url, referrer) {
      var excludes;
      var isExcludedUrl;
      var queueItem = {};
      var urlData = urllib.parse(url);
      var normalizedUrl = urlData.href.replace(/#.*/gi, '');
      var urlsQueued = this._get('urlsQueued'); // this object will update without "set"

      // Set whether URL is external or not
      queueItem.isExternal = this._isExternal(urlData);

      // Do not add external URLs to the queue if they shouldn't be crawled
      if (queueItem.isExternal === true && this._get('crawlExternal') === false) {
        return false;
      }

      // Do not add URLs that are already in the queue
      if (this._isQueued(normalizedUrl) === true) {
        return false;
      }

      // Do not add URLs that have already been crawled
      if (this._get('urlsCrawled').indexOf(normalizedUrl) > -1) {
        return false;
      }

      // Combine user-set excludes with mandatory excludes
      excludes = this._get('excludes').concat(this._get('mandatoryExcludes'));

      // Do not add URLs that match any exclude patterns
      isExcludedUrl = excludes.reduce((isExclude, exclude) => (normalizedUrl.search(exclude) > -1 || isExclude), false);
      if (isExcludedUrl || urlData.host === '') {
        return false;
      }

      // Set queue item URL
      queueItem.url = normalizedUrl;

      // Add referrer to queue item
      if (referrer) {
        queueItem.referrer = referrer;
      }

      // Add to queue
      urlsQueued.push(queueItem);

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
      var queueItem = this._get('urlsQueued').shift();

      // If there are no more pages, call the "finish" event
      if (queueItem === undefined) {
        return this._get('events').finish.forEach((callback) => callback());
      }

      // Get page data
      request({
        url: queueItem.url,
        isExternal: queueItem.isExternal
      }, this._onResponse.bind(this, queueItem));
    }

    _isExternal (urlData) {
      var mainUrl = this._get('mainUrl');
      return urlData.protocol !== mainUrl.protocol || urlData.host !== mainUrl.host;
    }

    _isQueued (url) {
      var i;
      var urlsQueued = this._get('urlsQueued');

      for (i in urlsQueued) {
        if (urlsQueued[i].url === url) {
          return true;
        }
      }

      return false;
    }

    _onResponse (queueItem, error, response, body) {
      'use strict';

      var maxRetries = this._get('retries');
      var retriedUrls = this._get('retriedUrls');
      var url = queueItem.url;
      var urlsCrawled = this._get('urlsCrawled');

      // Make sure response is an object
      if (!response || typeof response !== 'object') {
      	response = {
          url: queueItem.url
        };
      }

      // Save referrer to response if present
      if (queueItem.referrer) {
        response.referrer = queueItem.referrer;
      }

      // Save isExternal to response
      response.isExternal = queueItem.isExternal;

      // Run checks and procedures for redirects that may have occurred
      this._processRedirect(url, response);

      // If this URL has already been processed, just continue
      if (urlsCrawled.indexOf(response.url) > -1) {
        return this._crawlNextPage();
      }

      // Handle errors
      if (error || response.statusCode !== 200) {

        // Ignore error if it's due to a bad content-length and we're checking an external link
        // TODO: figure out how to write a test for this
        if (
        	error !== null &&
        	error.code === 'HPE_INVALID_CONSTANT' &&
        	response.statusCode === 200 &&
          // check both requested URL and final URL
        	(
            this._isExternal(urllib.parse(response.url)) === true ||
            this._isExternal(urllib.parse(url)) === true
          )
        ) {
        	error = null;
        }

        // Retry URLs if retries is set
        if (maxRetries > 0) {
           if (retriedUrls.hasOwnProperty(url) === false) {
             retriedUrls[url] = 0;
           }
           if (retriedUrls[url] < maxRetries) {
             retriedUrls[url]++; // increase number of retries for page
             this._get('urlsQueued').unshift(queueItem); // add URL to the front of the queue
             return this._crawlNextPage();
           }
        }

        // Add url or final URL to list of pages crawled
        urlsCrawled.push(response.url);

        this._get('events').error.forEach((callback) => callback(error, response, body));
        return this._crawlNextPage();
      }

      // Add final page URL to list of pages crawled
      urlsCrawled.push(response.url);

      // Run all callbacks for the pageCrawled event
      this._get('events').pageCrawled.forEach((callback) => callback(response, body));

      // Parse all links on the page
      this._queueLinks(response.url, body);

      // Process next page
      this._crawlNextPage();
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

      return true; // return tru to say this is a redirect
    }

    _queueLinks (url, html) {
      var cheerio = require('cheerio');
      var crawler = this;
      var $ = cheerio.load(html);

      $('a').each(function () {
  			var href = this.attr('href');
  			if (href) {
  				crawler.queue(urllib.resolve(crawler._get('mainUrl'), href), url);
  			}
  		});
    }
  }
});

exports.Crawler = Crawler;
