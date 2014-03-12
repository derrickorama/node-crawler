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
return new Crawler({
	timeout: 5000, // How long crawler will wait for a response
	crawlExternal: true, // Check external links (will not crawl)
	retries: 2, // Number of times crawler will retry a URL
	excludePatterns: ['\\/cgi-bin\\/.*\\.cgi\\?'], // Array of regex URL patterns to be excluded
	onError: function (page, error, response) {
		// Do something with error
	},
	onRedirect: function (page, response, wasCrawled) {
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