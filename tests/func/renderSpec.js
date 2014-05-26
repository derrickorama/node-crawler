var http = require('http');
var Crawler = require('../../crawler.js').Crawler;

describe('Crawler page rendering', function () {
    var crawler;
    var responseBody;
    var server;

    beforeEach(function () {
        crawler = new Crawler();
        server = http.createServer(function (req, res) {
            res.setHeader('Content-Type', 'text/html');
            res.end(responseBody);
        }).listen(6767);
    });

    afterEach(function () {
        server.close();
    });

    it('renders page when rendering is enabled', function (done) {
        var crawler = new Crawler({
            onPageCrawl: function (page) {
                page.render(function (browser) {
                    browser.evaluate(function () {
                        /*global document */
                        return document.title;
                    }, function (result) {
                        expect(result).toBe('My Page Title');
                        page.phExit();
                        done();
                    });
                });
            },
            onDrain: function () {
                done();
            },
            render: true
        });

        responseBody = '<title>My Page Title</title>';
        crawler.queue('http://localhost:6767');
    });

    it('does not render anything when rendering is not enabled', function (done) {
        var crawler = new Crawler({
            onPageCrawl: function (page) {
                page.render(function (browser) {
                    browser.evaluate(function () {
                        return document.title;
                    }, function (result) {
                        expect(result).toBe(undefined);
                    });
                });
            },
            onDrain: function () {
                done();
            }
        });

        responseBody = '<title>My Page Title</title>';
        crawler.queue('http://localhost:6767');
    });

});