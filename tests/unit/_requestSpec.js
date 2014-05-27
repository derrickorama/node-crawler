var http = require('http');
var https = require('https');
var _ = require('underscore');
var Crawler = require('../../crawler').Crawler;

describe('Crawler._request method', function () {
    var crawler;
    var callback;
    var mockRequest;
    var mockResponse;
    var noResponse;

    var COMMON_MEDIA_EXCLUDES = [
        '3gp',
        'aif',
        'asf',
        'asx',
        'avi',
        'flv',
        'iff',
        'm3u',
        'm4a',
        'm4p',
        'm4v',
        'mov',
        'mp3',
        'mp4',
        'mpa',
        'mpg',
        'mpeg',
        'ogg',
        'ra',
        'raw',
        'rm',
        'swf',
        'vob',
        'wav',
        'wma',
        'wmv'
    ];

    beforeEach(function () {
        crawler = new Crawler();
        callback = jasmine.createSpy('callback');
        noResponse = false;
        mockRequest = {
            abort: jasmine.createSpy('request.abort'),
            end: jasmine.createSpy('request.end'),
            on: jasmine.createSpy('request.on')
        };
        mockResponse = {
            headers: {},
            statusCode: 200,
            on: jasmine.createSpy('response.on')
        };
        spyOn(http, 'request').andCallFake(function (params, callback) {
            setTimeout(function () {
                if (noResponse === false) {
                    callback(mockResponse);
                }
            }, 10);
            return mockRequest;
        });
        spyOn(https, 'request').andCallFake(function (params, callback) {
            setTimeout(function () {
                if (noResponse === false) {
                    callback(mockResponse);
                }
            }, 10);
            return mockRequest;
        });
    });

    it('performs an HTTP request', function (done) {
        crawler._request({
            url: 'http://www.google.com/'
        }, function () {
            expect(http.request).toHaveBeenCalledWith({
                protocol: 'http:',
                host: 'www.google.com',
                port: null,
                path: '/',
                method: 'GET',
                rejectUnauthorized: true,
                headers: {
                    'cookie': jasmine.any(String),
                    'User-Agent': jasmine.any(String)
                }
            }, jasmine.any(Function));
            expect(mockRequest.end).toHaveBeenCalled();
            done();
        });
    });

    it('performs an HTTPS request', function (done) {
        crawler._request({
            url: 'https://www.google.com/'
        }, function () {
            expect(https.request).toHaveBeenCalledWith({
                protocol: 'https:',
                host: 'www.google.com',
                port: null,
                path: '/',
                method: 'GET',
                rejectUnauthorized: true,
                headers: {
                    'cookie': jasmine.any(String),
                    'User-Agent': jasmine.any(String)
                }
            }, jasmine.any(Function));
            expect(mockRequest.end).toHaveBeenCalled();
            done();
        });
    });

    it('times out after specified timeout', function (done) {
        crawler._request({
            url: 'https://www.google.com/',
            timeout: 1
        }, function (error, response, body) {
            expect(mockRequest.abort).toHaveBeenCalled();
            expect(error).toEqual({ message: 'Request timed out.', code: 'ETIMEDOUT' });
            expect(body).toBe('');
            done();
        });
    });

    it('executes callback on error with no response', function (done) {
        noResponse = true;
        mockRequest.on.andCallFake(function (event, callback) {
            callback(new Error('some error'));
        });
        crawler._request({
            url: 'https://www.google.com/'
        }, function (error, response, body) {
            expect(error.message).toBe('some error');
            expect(response).toBe(undefined);
            expect(body).toBe('');
            done();
        });
    });

    it('executes callback with response even when error occurs', function (done) {
        mockRequest.on.andCallFake(function (event, callback) {
            callback(new Error('some error'));
        });
        crawler._request({
            url: 'https://www.google.com/'
        }, function (error, response) {
            expect(error.message).toBe('some error');
            expect(response).toBe(mockResponse);
            done();
        });
    });

    it('follows redirects', function (done) {
        mockResponse.statusCode = 301;
        mockResponse.headers['location'] = 'http://www.google.com/some-other-page';
        crawler._request({
            url: 'http://www.google.com/'
        }, function () {
            expect(http.request.calls.length).toBe(2);
            expect(mockRequest.abort.calls.length).toBe(2);
            expect(http.request).toHaveBeenCalledWith({
                protocol: 'http:',
                host: 'www.google.com',
                port: null,
                path: '/some-other-page',
                method: 'GET',
                rejectUnauthorized: true,
                headers: {
                    'cookie': jasmine.any(String),
                    'User-Agent': jasmine.any(String)
                }
            }, jasmine.any(Function));

            done();
        });
        setTimeout(function () {
            mockResponse.statusCode = 200;
            mockResponse.headers['location'] = null;
        }, 10);
    });

    it('follows redirects relative to the url of the current redirect (when domains change)', function (done) {
        mockResponse.statusCode = 301;
        mockResponse.headers['location'] = 'http://www.bing.com/some-other-page';
        crawler._request({
            url: 'http://www.google.com/'
        }, function () {
            expect(http.request.calls[2].args[0].host).toBe('www.bing.com');
            expect(http.request.calls[2].args[0].path).toBe('/another-page');
            done();
        });
        setTimeout(function () {
            mockResponse.statusCode = 301;
            mockResponse.headers['location'] = '/another-page';
        }, 10);
        setTimeout(function () {
            mockResponse.statusCode = 200;
            mockResponse.headers['location'] = null;
        }, 50);
    });

    it('aborts request when running against non-text files', function (done) {
        mockResponse.headers['content-type'] = 'application/pdf';
        crawler._request({
            url: 'https://www.google.com/file.html'
        }, function () {
            expect(mockRequest.abort).toHaveBeenCalled();
            done();
        });
    });

    _.each(COMMON_MEDIA_EXCLUDES, function (type) {

        it('aborts request when running against "' + type + '" files', function (done) {
            crawler._request({
                url: 'http://domain.com/file.' + type
            }, function () {
                expect(mockRequest.abort).toHaveBeenCalled();
                done();
            });
        });

    });

    it('returns a body on status code 200 requests', function (done) {
        mockResponse.headers['content-type'] = 'text/html';
        mockResponse.on.andCallFake(function (event, callback) {
            callback('some body');
        });
        crawler._request({
            url: 'https://www.google.com/'
        }, function (error, response, body) {
            expect(mockRequest.abort).not.toHaveBeenCalled();
            expect(error).toBe(null);
            expect(response).toBe(mockResponse);
            expect(body).toBe('some body');
            done();
        });
    });

});