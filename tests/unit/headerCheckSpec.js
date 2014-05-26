var http = require('http');
var https = require('https');
var Crawler = require('../../crawler').Crawler;
var Page = require('../../crawler').Page;

describe('Crawler.headerCheck method', function () {
    var crawler;
    var page;
    var callback;
    var mockRequest;
    var mockResponse;

    beforeEach(function () {
        crawler = new Crawler();
        page = new Page('http://www.google.com/');
        callback = jasmine.createSpy('callback');
        mockRequest = {
            abort: jasmine.createSpy('request.abort'),
            end: jasmine.createSpy('request.end'),
            on: jasmine.createSpy('request.on')
        };
        mockResponse = {
            headers: {}
        };
        spyOn(http, 'request').andReturn(mockRequest);
        spyOn(https, 'request').andReturn(mockRequest);
    });

    it('performs an HTTP request', function () {
        page = new Page('http://www.google.com/');
        crawler.headerCheck(page, callback);

        expect(http.request).toHaveBeenCalledWith({
            protocol: page.urlData.protocol,
            host: page.urlData.hostname,
            port: page.urlData.port,
            path: page.urlData.path,
            method: 'GET',
            rejectUnauthorized: false,
            headers: {
                'cookie': jasmine.any(String),
                'User-Agent': jasmine.any(String)
            }
        }, jasmine.any(Function));
        expect(mockRequest.end).toHaveBeenCalled();
    });

    it('performs an HTTPS request', function () {
        page = new Page('https://www.google.com/');
        crawler.headerCheck(page, callback);
        expect(https.request).toHaveBeenCalledWith({
            protocol: page.urlData.protocol,
            host: page.urlData.hostname,
            port: page.urlData.port,
            path: page.urlData.path,
            method: 'GET',
            rejectUnauthorized: false,
            headers: {
                'cookie': jasmine.any(String),
                'User-Agent': jasmine.any(String)
            }
        }, jasmine.any(Function));
        expect(mockRequest.end).toHaveBeenCalled();
    });

    it('aborts the request after it gets header data', function () {
        crawler.headerCheck(page, callback);
        http.request.calls[0].args[1](mockResponse);
        expect(mockRequest.abort).toHaveBeenCalled();
    });

    it('updates the page.type with the value in the response headers (if they exist)', function () {
        mockResponse.headers['content-type'] = 'application/pdf';
        crawler.headerCheck(page, callback);
        http.request.calls[0].args[1](mockResponse);
        expect(page.type).toBe('application/pdf');
    });

    it('removes extra info from the content-type when setting page.type', function () {
        mockResponse.headers['content-type'] = 'application/pdf; something else';
        crawler.headerCheck(page, callback);
        http.request.calls[0].args[1](mockResponse);
        expect(page.type).toBe('application/pdf');
    });

    it('trims content-type when setting page.type', function () {
        mockResponse.headers['content-type'] = '        application/pdf   ';
        crawler.headerCheck(page, callback);
        http.request.calls[0].args[1](mockResponse);
        expect(page.type).toBe('application/pdf');
    });

    it('executes callback', function () {
        crawler.headerCheck(page, callback);
        http.request.calls[0].args[1](mockResponse);
        expect(callback).toHaveBeenCalledWith(null, page, mockResponse);
    });

    it('executes callback on error with no response', function (done) {
        mockRequest.on.andCallFake(function (event, callback) {
            callback('some error');
        });
        crawler.headerCheck(page, callback);
        http.request.calls[0].args[1](mockResponse);

        // Mock asynchronous behavior
        setTimeout(function () {
            expect(callback).toHaveBeenCalledWith('some error', page, mockResponse);
            done();
        }, 5);
    });

    it('does not execute callback twice when error occurs and response is sent', function (done) {
        mockRequest.on.andCallFake(function (event, callback) {
            callback('some error');
        });
        crawler.headerCheck(page, callback);
        http.request.calls[0].args[1](mockResponse);

        // Mock asynchronous behavior
        setTimeout(function () {
            expect(callback.calls.length).toBe(1);
            done();
        });
    });

});