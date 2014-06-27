var http = require('http');
var tough = require('tough-cookie');
var Crawler = require('../../crawler.js').Crawler;

describe('Crawler cookie support', function () {
	var cookie;
	var responseBody;
	var server;

	beforeEach(function () {
		responseBody = '';
		cookie = 'cookie=test';
		server = http.createServer(function (req, res) {
			var status = 200;
			res.setHeader('Content-Type', 'text/html');

			if (req.url.indexOf('/make-cookie') > -1) {
				status = 301;
				res.setHeader('Set-Cookie', cookie);
				responseBody = http.STATUS_CODES[status] + '. Redirecting to show cookie';
				res.setHeader('Content-Type', 'text/plain');

				// Respond
				res.statusCode = status;
				res.setHeader('Location', '/show-cookie');
			} else if (req.url.indexOf('/show-cookie') > -1) {
				responseBody = req.headers['cookie'];
			}

			res.end(responseBody);
		}).listen(6767);
	});

	afterEach(function () {
		server.close();
	});

	/*
	| Cookies
	*/

	it('supports cookies by default', function (done) {
		var crawler = new Crawler({
			onPageCrawl: function (page) {
				expect(page.html).toBe('cookie=test; Path=/');
			},
			onDrain: function () {
				done();
			}
		});
		expect(crawler.jar instanceof tough.CookieJar).toBe(true);
		crawler.queue('http://localhost:6767/make-cookie');
	});

	it('allows you to turn off support for cookies', function (done) {
		var crawler = new Crawler({
			onPageCrawl: function (page) {
				expect(page.html).toBe('');
				done();
			},
			jar: false
		});
		expect(crawler.jar).toBe(false);
		crawler.queue('http://localhost:6767/make-cookie');
	});

	it('ignores cookie parsing errors', function (done) {
		// This will throw an exception and kill the process if it's not handled
		var crawler = new Crawler({
			onPageCrawl: function () {
				done();
			}
		});
		cookie = 'AMA Publishing GroupMachineID=635368805209600916';
		crawler.queue('http://localhost:6767/make-cookie');
	});

	it('allows you to provide an existing cookie jar', function () {
		var cookieJar = new tough.CookieJar();

		cookieJar.setCookieSync('blah=yes', 'http://domain.com', {
			ignoreError: true
		});

		var crawler = new Crawler({
			jar: cookieJar
		});

		expect(crawler.jar.getCookiesSync('http://domain.com').toString()).toBe('blah=yes; Path=/');
	});

});