const pathlib = require('path');
const urllib = require('url');
const async = require('async');
const cheerio = require('cheerio');
const _ = require('lodash');
const request = require(pathlib.join(__dirname, 'request'));

const HTTP_STATUS_OK = 200;
const NO_RETRIES = 0;

(function () {

  class Crawler {

    /*
    | PUBLIC METHODS
    */

    constructor(userSettings) {
      /*eslint no-mixed-spaces-and-tabs:0 */

      // Update props with any settings from instantiation
      const _props = {
        CACHE_BUST_PREFIX: '__cb__',
        cacheBust: false,
        cacheBustString: '',
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

      // Use public "set" method instead of setting directly (normalizes settings)
      this.set('excludes', _props.excludes);
      this.set('doNotDownload', _props.doNotDownload);
      this.set('cacheBust', _props.cacheBust);

      this._set('asyncQueue', async.queue(this._crawlNextPage.bind(this), this._get('workers')));
      this._get('asyncQueue').drain = this._finish.bind(this);
    }

    get(name) {
      switch (name) {
      case 'urlsQueued':
        return this._get('asyncQueue').tasks.map((queueItem) => queueItem.data.url);
      default:
        return this._get(name);
      }
    }

    kill() {
      this.killed = true;
      this._get('asyncQueue').kill();
      this._finish();
    }

    normalizeUrl(url) {
      const urlData = urllib.parse(url);
      return urlData.href.replace(/#.*/gi, '');
    }

    on(event, callback) {
      this._get('events')[event].push(callback);
    }

    queue(url, referrer) {
      const queueItem = {};
      const urlData = urllib.parse(url);
      const normalizedUrl = urlData.href.replace(/#.*/gi, '');

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
      if (this._get('urlsCrawled').includes(normalizedUrl)) {
        return false;
      }

      // Combine user-set excludes with mandatory excludes
      const excludes = this._get('excludes').concat(this._get('mandatoryExcludes'));

      // Do not add URLs that match any exclude patterns
      const isExcludedUrl = excludes.reduce(
        (isExclude, exclude) => normalizedUrl.match(exclude) !== null || isExclude,
      false);
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

    set(name, value) {
      switch (name) {
      case 'cacheBust':
        if (value === true) {
          this._set('cacheBustString', `${this._get('CACHE_BUST_PREFIX')}${new Date().getTime()}`);
        }
        this._set('cacheBust', value);
        break;
      case 'excludes':
      case 'doNotDownload':
        // Convert strings in excludes to RegExps
        this._set(name, value.map((item) => {
          return item instanceof RegExp ? item : new RegExp(item, 'g');
        }));
        break;
      case 'mainUrl':
        this._set('mainUrl', urllib.parse(this.normalizeUrl(value)));
        break;
      default:
        this._set(name, value);
      }
    }

    start(url) {
      // Set main URL if one is not already set
      this.set('mainUrl', url);
      this.queue(url);
    }

    /*
    | PRIVATE METHODS
    */

    _crawlNextPage(queueItem, finish) {

      // Get page data
      request({
        url: queueItem.isExternal ? queueItem.url : this._buildUrl(queueItem.url),
        originalUrl: queueItem.url,
        auth: this._get('auth'),
        cookie: this._get('cookie'),
        doNotDownload: this._get('doNotDownload'),
        headers: this._get('headers'),
        isExternal: queueItem.isExternal,
        maxRedirects: this._get('maxRedirects'),
        timeout: this._get('timeout')
      }, this._onResponse.bind(this, queueItem, finish));
    }

    _finish() {
      this._get('events').finish.forEach((callback) => callback());
    }

    _isExternal(urlData) {
      const mainUrl = this._get('mainUrl');
      return urlData.protocol !== mainUrl.protocol || urlData.host !== mainUrl.host;
    }

    _isQueued(url) {
      const urlsQueued = this.get('urlsQueued');

      for (const i in urlsQueued) {
        if (urlsQueued[i] === url) {
          return true;
        }
      }

      return false;
    }

    _buildUrl(url) {
      if (this._get('cacheBust') === true) {
        return `${url}${this._makeCacheBustUrl(url)}`;
      }
      return url;
    }

    _makeCacheBustUrl(url) {
      const queryDelimeter = url.includes('?') ? '&' : '?';
      return `${queryDelimeter}${this._get('cacheBustString')}`;
    }

    _stripCacheBustQuery(url) {
      return url.replace(new RegExp(`[\?&]${this._get('cacheBustString')}`, 'gi'), '');
    }

    _onResponse(queueItem, finish, error, response, body) {
      const maxRetries = this._get('retries');
      const retriedUrls = this._get('retriedUrls');
      const url = queueItem.url;
      const urlsCrawled = this._get('urlsCrawled');

      // Make sure response is an object
      if (!response || typeof response !== 'object') {
        response = {
          url: queueItem.url
        };
      }

      // Strip cache busting query string
      if (this._get('cacheBust') === true) {
        response.url = this._stripCacheBustQuery(response.url);
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
      if (urlsCrawled.includes(response.url)) {
        return finish();
      }

      // Handle errors
      if (error || response.statusCode !== HTTP_STATUS_OK) {

        // Ignore error if it's due to a bad content-length and we're checking an external link
        // TODO: figure out how to write a test for this
        if (
        	error !== null &&
        	error.code === 'HPE_INVALID_CONSTANT' &&
        	response.statusCode === HTTP_STATUS_OK &&
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
          maxRetries > NO_RETRIES &&
          // Do not retry redirects (that's handled in the request)
          _.get(error, 'message', '').startsWith('Exceeded maxRedirects') !== true
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

    _processRedirect(url, response) {
      const urlsCrawled = this._get('urlsCrawled');

      // Do nothing if response doesn't have a URL
      if (!response.url) {
        return false;
      }

      // Normalize final URL
      const finalUrl = this.normalizeUrl(response.url);

      // Redirect detection happens here
      if (url === finalUrl) {
        // This is not a redirect, stop now
        return false;
      }

      // Store redirect in response
      response.redirect = url;

      // Add URL to list of URLs crawled
      if (!urlsCrawled.includes(url)) {
        urlsCrawled.push(url);
      }

      // Execute redirect event handlers
      this._get('events').redirect.forEach((callback) => callback(response));

      return true; // return tru to say this is a redirect
    }

    _queueLinks(url, html) {
      const $ = cheerio.load(html);
      const pageLinks = [];

      $('a').each((index, el) => {
        const href = $(el).attr('href');

        if (href) {
          const fullHref = urllib.resolve(this._get('mainUrl'), href);
          if (!pageLinks.includes(fullHref)) {
            pageLinks.push(fullHref);
            this.queue(fullHref, url);
          }
        }
      });

      return pageLinks;
    }
  }

  exports.Crawler = Crawler;
}());
