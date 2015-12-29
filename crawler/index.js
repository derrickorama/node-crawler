var urllib = require('url');

(function () {
  'use strict';

  class Crawler {

    /*
    | PUBLIC METHODS
    */

    constructor (userSettings) {
      /*eslint no-mixed-spaces-and-tabs:0 */
      var async = require('async');

      // Update props with any settings from instantiation
      var _props = {
        crawlExternal: true,
        doNotDownload: [],
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
        maxRedirects: 7,
        retries: 1,
        retriedUrls: {},
        timeout: 30000,
        urlsCrawled: [],
        workers: 1
      };

      Object.assign(_props, userSettings || {});

    	// this.strictSSL = params.strictSSL || false;
    	// this.timeout = params.timeout || 60000;
      //
      this._get = function (name) {
        return _props[name];
      };
      this._set = function (name, value) {
        _props[name] = value;
      };

      // Convert strings in excludes to RegExps
      _props.excludes = _props.excludes.map((exclude) => (
        exclude instanceof RegExp ? exclude : new RegExp(exclude, 'g')
      ));

      this._set('asyncQueue', async.queue(this._crawlNextPage.bind(this), this._get('workers')));
      this._get('asyncQueue').drain = this._finish.bind(this);
    }

    get (name) {
      switch (name) {
        case 'urlsQueued':
          return this._get('asyncQueue').tasks.map((queueItem) => (queueItem.data.url));
        default:
          return this._get(name);
      }
    }

    kill () {
      this.killed = true;
      this._get('asyncQueue').kill();
      this._finish();
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
      this._get('asyncQueue').push(queueItem);

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
    }

    /*
    | PRIVATE METHODS
    */

    _crawlNextPage (queueItem, finish) {
      var pathlib = require('path');
      var request = require(pathlib.join(__dirname, 'request'));

      // Get page data
      request({
        url: queueItem.url,
        auth: this._get('auth'),
        cookie: this._get('cookie'),
        doNotDownload: this._get('doNotDownload'),
        headers: this._get('headers'),
        isExternal: queueItem.isExternal,
        maxRedirects: this._get('maxRedirects'),
        timeout: this._get('timeout')
      }, this._onResponse.bind(this, queueItem, finish));
    }

    _finish () {
      this._get('events').finish.forEach((callback) => callback());
    }

    _isExternal (urlData) {
      var mainUrl = this._get('mainUrl');
      return urlData.protocol !== mainUrl.protocol || urlData.host !== mainUrl.host;
    }

    _isQueued (url) {
      var i;
      var urlsQueued = this.get('urlsQueued');

      for (i in urlsQueued) {
        if (urlsQueued[i] === url) {
          return true;
        }
      }

      return false;
    }

    _onResponse (queueItem, finish, error, response, body) {
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
        return finish();
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
        if (
          maxRetries > 0 &&
          (!error || error.message.indexOf('Exceeded maxRedirects.') !== 0) // Do not retry redirects (that's handled in the request)
        ) {
           if (retriedUrls.hasOwnProperty(url) === false) {
             retriedUrls[url] = 0;
           }
           if (retriedUrls[url] < maxRetries) {
             retriedUrls[url]++; // increase number of retries for page
             this._get('asyncQueue').unshift(queueItem); // add URL to the front of the queue
             return finish();
           }
        }

        // Add url or final URL to list of pages crawled
        urlsCrawled.push(response.url);

        this._get('events').error.forEach((callback) => callback(error, response, body));
        return finish();
      }

      // Add final page URL to list of pages crawled
      urlsCrawled.push(response.url);



      // Check if crawler was killed before the response was recieved
      if (this.killed !== true) {
        // Parse all links on the page and store them in the response
        response.links = this._queueLinks(response.url, body);
      }

      // Run all callbacks for the pageCrawled event
      this._get('events').pageCrawled.forEach((callback) => callback(response, body));

      // Process next page
      finish();
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

      // Store redirect in response
      response.redirect = url;

      // Add URL to list of URLs crawled
      if (urlsCrawled.indexOf(url) < 0) {
        urlsCrawled.push(url);
      }

      // Execute redirect event handlers
      this._get('events').redirect.forEach((callback) => callback(response));

      return true; // return tru to say this is a redirect
    }

    _queueLinks (url, html) {
      var cheerio = require('cheerio');
      var crawler = this;
      var $ = cheerio.load(html);
      var pageLinks = [];

      $('a').each(function () {
        var href = $(this).attr('href');
        var fullHref;

  			if (href) {
          fullHref = urllib.resolve(crawler._get('mainUrl'), href);
          if (pageLinks.indexOf(fullHref) < 0) {
            pageLinks.push(fullHref);
            crawler.queue(fullHref, url);
          }
  			}
  		});

      return pageLinks;
    }
  }

  exports.Crawler = Crawler;
}());
