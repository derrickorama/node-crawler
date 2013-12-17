var urllib = require('url');
var async = require('async');
var Crawler = require('../crawler.js').Crawler;
var Page = require('../crawler.js').Page;

/*
| queue method
*/

describe('Crawler.queue method', function () {
    var crawler;
    var asyncQueueSpy;

    beforeEach(function () {
        crawler = new Crawler();

        // This is so the queue doesn't actually process the URL
        asyncQueueSpy = spyOn(crawler._queue, 'push');
    });

    it('uses the parse method of the url module to create a canonicalized URL', function () {
        var parseSpy = spyOn(urllib, 'parse').andCallThrough();
        crawler.queue('http://www.google.com');
        expect(parseSpy).toHaveBeenCalledWith('http://www.google.com');
    });

    it('adds the canonicalized URL to the _pages property', function () {
        crawler.queue('http://www.google.com');
        expect(crawler._pages.hasOwnProperty('http://www.google.com/')).toBe(true);
    });

    it('checks if the URL was already crawled via the _wasCrawled method', function () {
        var wasCrawledSpy = spyOn(crawler, '_wasCrawled').andReturn(false);
        crawler.queue('http://www.google.com/');
        expect(wasCrawledSpy).toHaveBeenCalledWith('http://www.google.com/');
    });

    it('returns false if URL was already crawled', function () {
        // Add page to _pages property
        crawler._pages['http://www.google.com/'] = true;

        var added = crawler.queue('http://www.google.com/');
        expect(added).toBe(false);
    });

    describe('page addition', function () {

        it('adds a key to the _pages object', function () {
            crawler.queue('http://www.google.com/');
            expect(crawler._pages.hasOwnProperty('http://www.google.com/')).toBe(true);
        });

        it('adds a new Page object for each page', function () {
            crawler.queue('http://www.google.com/');
            expect(crawler._pages['http://www.google.com/'].page instanceof Page).toBe(true);
            expect(crawler._pages['http://www.google.com/'].page.url).toBe('http://www.google.com/');
        });

        describe('crawl links setter', function () {
            
            it('sets crawlLinks property to true if specified', function () {
                crawler.queue('http://www.google.com/', true);
                expect(crawler._pages['http://www.google.com/'].crawlLinks).toBe(true);
            });
            
            it('sets crawlLinks property to false if specified', function () {
                crawler.queue('http://www.google.com/', false);
                expect(crawler._pages['http://www.google.com/'].crawlLinks).toBe(false);
            });
            
            it('sets crawlLinks property to true if not specified', function () {
                crawler.queue('http://www.google.com/');
                expect(crawler._pages['http://www.google.com/'].crawlLinks).toBe(true);
            });

        });

        describe('GET/HEAD method setter', function () {

            it('sets method to HEAD if true is specified', function () {
                crawler.queue('http://www.google.com/', null, true);
                expect(crawler._pages['http://www.google.com/'].method).toBe('HEAD');
            });

            it('sets method to GET if false specified', function () {
                crawler.queue('http://www.google.com/', null, false);
                expect(crawler._pages['http://www.google.com/'].method).toBe('GET');
            });

            it('sets method to GET if not specified', function () {
                crawler.queue('http://www.google.com/');
                expect(crawler._pages['http://www.google.com/'].method).toBe('GET');
            });

        });

    });

    describe('async.queue addition', function () {
        var asyncQueueCallbackSpy;

        beforeEach(function () {
            asyncQueueCallbackSpy = spyOn(crawler._asyncQueueCallback, 'apply');
            crawler.queue('http://www.google.com/');
        });
        
        it('adds the URL data to the async.queue', function () {
            var page = crawler._pages['http://www.google.com/'];
            expect(asyncQueueSpy).toHaveBeenCalled();
            expect(asyncQueueSpy.calls[0].args[0]).toEqual(page);
        });

        it('executes the _asyncQueueCallback method', function () {
            // Make sure function calls the _asyncQueueCallback method
            asyncQueueSpy.calls[0].args[1]();
            expect(asyncQueueCallbackSpy.calls[0].args[0]).toEqual(crawler);
            expect(asyncQueueCallbackSpy.calls[0].args[1]).toEqual({});
        });

    });

    it('adds the URL data to the async.queue', function () {
        var asyncQueueCallbackSpy = spyOn(crawler._asyncQueueCallback, 'apply');

        crawler.queue('http://www.google.com/');
        var page = crawler._pages['http://www.google.com/'];
        expect(asyncQueueSpy).toHaveBeenCalled();
        expect(asyncQueueSpy.calls[0].args[0]).toEqual(page);

        // Make sure function calls the _asyncQueueCallback method
        asyncQueueSpy.calls[0].args[1]();
        expect(asyncQueueCallbackSpy.calls[0].args[0]).toEqual(crawler);
        expect(asyncQueueCallbackSpy.calls[0].args[1]).toEqual({});
    });

    it('returns true if URL was successfully added to queue', function () {
        var added = crawler.queue('http://www.google.com/');
        expect(added).toBe(true);
    });

});

/*
| _asyncQueueCallback method
*/
describe('Crawler._asyncQueueCallback method', function () {
    var crawler;

    beforeEach(function () {
        crawler = new Crawler();
    });

    it('exists', function () {
        expect(crawler._asyncQueueCallback instanceof Function).toBe(true);
    });

    it('runs supplied callback with any number of arguments', function () {
        crawler.customCallback = function () {};
        var callbackSpy = spyOn(crawler, 'customCallback');
        crawler._asyncQueueCallback('customCallback', ['arg1', 'arg2']);
        expect(callbackSpy).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('does not execute callback if it is undefined', function () {
        // Should throw an error if this isn't caught
        crawler._asyncQueueCallback();
    });

});