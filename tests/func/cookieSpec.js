var http = require('http');
var Crawler = require('../../crawler.js').Crawler;

describe('Crawler cookie support', function () {
	var responseBody;
	var server;

	beforeEach(function () {
		responseBody = '';
		server = http.createServer(function (req, res) {
			var status = 200;
			var responseBody = '';
			res.setHeader('Content-Type', 'text/html');
			res.setHeader('Set-Cookie', 'cookie=test');

			if (req.url === '/make-cookie') {
				status = 301;
				responseBody = http.STATUS_CODES[status] + '. Redirecting to show cookie';
				res.setHeader('Content-Type', 'text/plain');

				// Respond
				res.statusCode = status;
				res.setHeader('Location', '/show-cookie');
			}

			if (req.url === '/show-cookie') {
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
		expect(crawler.acceptCookies).toBe(true);
		crawler.queue('http://localhost:6767/make-cookie');
	});

	it('allows you to turn off support for cookies', function (done) {
		var crawler = new Crawler({
			onPageCrawl: function (page) {
				expect(page.html).toBe('');
				done();
			},
			acceptCookies: false
		});
		expect(crawler.acceptCookies).toBe(false);
		crawler.queue('http://localhost:6767/make-cookie');
	});

});