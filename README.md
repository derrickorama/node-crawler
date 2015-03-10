Usage
=====

# node-crawler

> A site crawler module for Node.js.


## What this does

* Crawls a domain while collecting URLs, HTML and responses for each resource.


## Install

```
npm install --save-dev git+https://github.com/derrickorama/node-crawler.git#master
```


## Example Usage

```js
var crawler = new Crawler({
	timeout: 5000, // How long crawler will wait for a response
	excludePatterns: ['\\/cgi-bin\\/.*\\.cgi\\?'], // Array of regex URL patterns to be excluded
	onError: function (page, error, response) {
		// Do something with error
	},
	onRedirect: function (page, response, finalURL) {
		// Do something with redirect
	},
	onPageCrawl: function (page, response) {
		// Do something with 200 OK page crawl
	},
	onDrain: function () {
		// Do something when queue is empty
	}
});
```

## Parameters

Here's a list of all available parameters you can supply when instantiating a new Crawler:

### acceptCookies

Defaults to **true**. Determines whether a request will save cookies.

### crawlExternal

Defaults to **false**. Determines whether crawler will make a request to an external resource. Note: this does not cause the crawler to download the external resource.

### excludePatterns

Defaults to **[]**. A set of exclude patterns (regexes) that cause the crawler to ignore URLs that match the supplied patterns.

### retries

Defaults to **0**. Determines how many request retries the crawler will attempt upon encountering a failure.

### strictSSL

Defaults to **false**. Determines whether crawler should fail due to SSL warnings.

### timeout

Defaults to **60000**. Determines the amount of time to wait for a response until the request gives up.

### workers

Defaults to **4**. Determines the number of concurrent workers to be used to make each request.

### onDrain()

Called when the crawler's queue is empty.

### onError(page Page, error Error, response Object)

Called when an error or bad status code is encountered.

### onPageCrawl (page Page, response Object)

Called when a page was successfully crawled.

### onRedirect (page Page, response Object, finalURL String)

Called when a redirect is encountered.

## Page Object

### instantiation example

```js
var page = new Page(
    'http://domain.com/page-url', // page URL
    'http://domain.com/referring-page', // referrer
    true // is an external page
);
```

### html

HTML string set from executing page.setHTML().

### isExternal

Boolean set by the third parameter during Page instantiation that determines whether a page is an external page.

### links

Array of links found on the page after executing page.setHTML().

### redirects

Array of redirects found for page during a crawl.

### referrer

Referring URL as set by the second parameter during Page instantiation.

### type

Content-Type of page as determined by crawler (e.g. text/html, application/pdf).

### url

URL of page. Note: the #hash in the URL will be stripped.

### urlData

Object returned by running Node's "url" modules' "parse" method against the page.url - contains. See [url.parse documentation](http://nodejs.org/api/url.html#url_url_parse_urlstr_parsequerystring_slashesdenotehost) for more info.

### dom()

Returns a jQuery-like cheerio object for DOM manipulation/traveral.

### setHTML(html String)

Sets the page.html property and finds and adds all anchor tags found on page.
