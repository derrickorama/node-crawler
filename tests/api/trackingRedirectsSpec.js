var http = require('http');
var _ = require('underscore');
var Crawler = require('../../crawler.js').Crawler;

describe('API: tracking redirects', function () {
    var crawler;
    var mockOnDrain;
    var mockOnPageCrawl;
    var mockOnRedirect;
    var pages;
    var responseBody;
    var server;

    beforeEach(function () {
        mockOnRedirect = function (page, response, finalURL) {
            addRedirect(page.url, finalURL);
        };
        mockOnPageCrawl = function (page) {
            addPage(page);
        };
        mockOnDrain = function () {};
        pages = {};
        responseBody = '';

        crawler = new Crawler({
            crawlExternal: true,
            onRedirect: function () {
                mockOnRedirect.apply(crawler, arguments);
            },
            onPageCrawl: function () {
                mockOnPageCrawl.apply(crawler, arguments);
            },
            onDrain: function () {
                mockOnDrain.apply(crawler, arguments);
            }
        });

        server = http.createServer(function (req, res) {
            var status = 200;

            if (req.url.indexOf('/redirect') > -1) {
                status = 301;
                responseBody = http.STATUS_CODES[status] + '. Redirecting to /final';
                res.setHeader('Content-Type', 'text/plain');

                // Respond
                res.statusCode = status;
                res.setHeader('Location', '/final');
            }
            res.end(responseBody);
        }).listen(6767);
    });

    afterEach(function () {
        server.close();
    });

    function addRedirect(redirectedURL, finalURL) {
        if (pages.hasOwnProperty(finalURL) === false) {
            // Create simple version of Page
            pages[finalURL] = {
                redirects: []
            };
        }
        // Store redirects
        if (pages[finalURL].redirects.indexOf(redirectedURL) < 0) {
            pages[finalURL].redirects.push(redirectedURL);
        }
    }

    function addPage(page) {
        // Carry over redirects
        if (pages.hasOwnProperty(page.url) === true && pages[page.url].redirects.length > 0) {
            page.redirects = _.uniq(page.redirects.concat(pages[page.url].redirects), true);
        }
        // Add page
        pages[page.url] = page;
    }

    it('allows you to track redirects when final URL hasn\'t been added', function (done) {
        crawler.queue('http://localhost:6767/redirect');
        mockOnDrain = function () {
            expect(pages['http://localhost:6767/final'].redirects).toEqual([
                'http://localhost:6767/redirect'
            ]);
            expect(pages.hasOwnProperty('http://localhost:6767/redirect')).toBe(false);
            done();
        };
    });

    it('allows you to track redirects when final URL has already been added', function (done) {
        crawler.queue('http://localhost:6767/finalURL');
        responseBody = '<a href="/redirect">redirect</a>';
        mockOnDrain = function () {
            expect(pages['http://localhost:6767/final'].redirects).toEqual([
                'http://localhost:6767/redirect'
            ]);
            expect(pages.hasOwnProperty('http://localhost:6767/redirect')).toBe(false);
            done();
        };
    });

});