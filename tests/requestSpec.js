var _ = require('underscore');
var Crawler = require('../crawler.js').Crawler;

describe('Crawler', function () {

	var BASIC_LINK_PAGE = 'https://dl.dropboxusercontent.com/u/3531436/node-crawler-tests/basic-link-crawl.html',
		DENY_HEAD_METHOD_PAGE = 'https://dl.dropboxusercontent.com/u/3531436/node-crawler-tests/deny-head-method.html',
		EXTERNAL_URL_PAGE = 'https://dl.dropboxusercontent.com/u/3531436/node-crawler-tests/external-link-page.html',
		NON_PAGE_URLS_PAGE = 'https://dl.dropboxusercontent.com/u/3531436/node-crawler-tests/non-page-urls.html',
		RELATIVE_URL_PAGE = 'https://dl.dropboxusercontent.com/u/3531436/node-crawler-tests/relative-link-page.html';



	/*
	| Error handling
	*/

	it('should not try to set the content-type when the response object is invalid', function (done) {
		var crawler = new Crawler({
			onDrain: function () {
				done();
			}
		});
		crawler.queue('http://www.myphillylawyer.com/');
	});

});