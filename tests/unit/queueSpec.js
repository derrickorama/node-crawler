var urllib = require('url');
var Crawler = require('../../crawler.js').Crawler;
var Page = require('../../crawler.js').Page;

/*
| queue method
*/

describe('Crawler.queue method', function () {
    var crawler;
    var asyncQueueSpy;

    beforeEach(function () {
        crawler = new Crawler();

        // Crawl external links
        crawler._crawlExternal = true;

        // This is so the queue doesn't actually process the URL
        asyncQueueSpy = spyOn(crawler._queue, 'push');
    });

    describe('when _crawlExternal is false', function () {
        var result;

        beforeEach(function () {
            crawler._crawlExternal = false;
            result = crawler.queue('http://www.google.com', true, true);
        });
    
        it('returns false', function () {
            expect(result).toBe(false);
        });

        it('does not add to the async queue', function () {
            expect(asyncQueueSpy).not.toHaveBeenCalled();
        });

        it('does not add url to list of pages', function () {
            expect(crawler._urlsCrawled).not.toContain('http://www.google.com/');
        });
    
    });

    it('uses the parse method of the url module to create a canonicalized URL', function () {
        var parseSpy = spyOn(urllib, 'parse').andCallThrough();
        crawler.queue('http://www.google.com');
        expect(parseSpy).toHaveBeenCalledWith('http://www.google.com');
    });

    it('adds the canonicalized URL to the _urlsCrawled property', function () {
        crawler.queue('http://www.google.com');
        expect(crawler._urlsCrawled).toContain('http://www.google.com/');
    });

    it('checks if the URL was already crawled via the _wasCrawled method', function () {
        var wasCrawledSpy = spyOn(crawler, '_wasCrawled').andReturn(false);
        crawler.queue('http://www.google.com/');
        expect(wasCrawledSpy).toHaveBeenCalledWith('http://www.google.com/');
    });

    it('returns false if URL was already crawled', function () {
        // Add page to _urlsCrawled property
        crawler._urlsCrawled = ['http://www.google.com/'];

        var added = crawler.queue('http://www.google.com/');
        expect(added).toBe(false);
    });

    describe('pattern exclusion', function () {

        beforeEach(function () {
            crawler.excludePatterns = ['/Section/Page\\.shtml', '.*whatever\\.shtml'];
        });
    
        it('returns false if a URL matches a pattern', function () {
            var result;

            result = crawler.queue('http://domain.com/Section/Page.shtml');
            expect(result).toBe(false);
            result = crawler.queue('http://meh.com/whatever.shtml');
            expect(result).toBe(false);
        });

        it('does not add URL to _urlsCrawled', function () {
            crawler.queue('http://domain.com/Section/Page.shtml');
            expect(crawler._urlsCrawled).toEqual([]);
        });

        it('does not affect non-matched URLs', function () {
            var result = crawler.queue('http://domain.com/Other-Section/Page.shtml');
            expect(result).toBe(true);
            expect(crawler._urlsCrawled).toContain('http://domain.com/Other-Section/Page.shtml');
        });
    
    });

    describe('page addition', function () {

        it('adds a key to the _urlsCrawled array', function () {
            crawler.queue('http://www.google.com/');
            expect(crawler._urlsCrawled).toContain('http://www.google.com/');
        });

        describe('isExternal property', function () {
            
            it('sets crawlLinks property to false if isExternal is true', function () {
                crawler.queue('http://www.google.com/', true);
                expect(asyncQueueSpy.calls[0].args[0].crawlLinks).toBe(false);
            });
            
            it('sets crawlLinks property to true if isExternal is false', function () {
                crawler.queue('http://www.google.com/', false);
                expect(asyncQueueSpy.calls[0].args[0].crawlLinks).toBe(true);
            });
            
            it('sets crawlLinks property to true if not specified', function () {
                crawler.queue('http://www.google.com/');
                expect(asyncQueueSpy.calls[0].args[0].crawlLinks).toBe(true);
            });

            it('sets page\'s isExternal property to true if isExternal is true', function () {
                crawler.queue('http://www.google.com/', true);
                expect(asyncQueueSpy.calls[0].args[0].page.isExternal).toBe(true);
            });

            it('sets page\'s isExternal property to false if isExternal is false', function () {
                crawler.queue('http://www.google.com/', false);
                expect(asyncQueueSpy.calls[0].args[0].page.isExternal).toBe(false);
            });

            it('sets page\'s isExternal property to false if isExternal is not defined', function () {
                crawler.queue('http://www.google.com/');
                expect(asyncQueueSpy.calls[0].args[0].page.isExternal).toBe(false);
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
            expect(asyncQueueSpy).toHaveBeenCalled();
            expect(asyncQueueSpy.calls[0].args[0].page instanceof Page).toBe(true);
            expect(asyncQueueSpy.calls[0].args[0].page.url).toBe('http://www.google.com/');
        });

        it('executes the _asyncQueueCallback method', function () {
            // Make sure function calls the _asyncQueueCallback method
            asyncQueueSpy.calls[0].args[1]('args');
            expect(asyncQueueCallbackSpy.calls[0].args[0]).toEqual(crawler);
            expect(asyncQueueCallbackSpy.calls[0].args[1]).toEqual({
                '0': 'args',
            });
        });

    });

    it('returns true if URL was successfully added to queue', function () {
        var added = crawler.queue('http://www.google.com/');
        expect(added).toBe(true);
    });

});