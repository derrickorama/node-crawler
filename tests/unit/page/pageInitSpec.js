var urllib = require('url');
var winston = require('winston');
var Page = require('../../../crawler.js').Page;

describe('Page instantiation', function () {

    beforeEach(function () {
        spyOn(urllib, 'parse').andReturn('my parsed URL object');
    });
    
    it('sets "url" to an empty string by default', function () {
        var page = new Page();
        expect(page.url).toBe('');
    });
    
    it('sets "url" to supplied "url" value', function () {
        var page = new Page('http://domain.com');
        expect(page.url).toBe('http://domain.com');
    });
    
    it('sets "urlData" to a parsed URL object', function () {
        var page = new Page();
        expect(page.urlData).toBe('my parsed URL object');
    });

    it('sets "html" to an empty string', function () {
        var page = new Page();
        expect(page.html).toBe('');
    });

    it('sets "redirects" to an empty array', function () {
        var page = new Page();
        expect(page.redirects).toEqual([]);
    });

    it('sets "type" to to "text/html"', function () {
        var page = new Page();
        expect(page.type).toBe('text/html');
    });

    it('sets "links" to an empty array', function () {
        var page = new Page();
        expect(page.links).toEqual([]);
    });

    it('sets "isExternal" to false by default', function () {
        var page = new Page();
        expect(page.isExternal).toBe(false);
    });

    it('sets "isExternal" to supplied "isExternal" value', function () {
        var page = new Page(null, true);
        expect(page.isExternal).toBe(true);
    });

    it('sets "_ph" to an object with an "exit" method', function () {
        var page = new Page();
        expect(page._ph).toEqual({
            exit: jasmine.any(Function)
        });
    });

    it('sets "phWaits" to an empty array', function () {
        var page = new Page();
        expect(page.phWaits).toEqual([]);
    });

    it('removes the hash from a URL', function () {
        var page = new Page('http://domain.com/page#blahblah');
        expect(page.url).toBe('http://domain.com/page');
    });

    it('sets "_phPage" to an object with a property of "evaluate"', function () {
        var page = new Page();
        expect(page._phPage.hasOwnProperty('evaluate')).toBe(true);
    });

    describe('_phPage.evaluate', function () {
        var mockCallback;
        var mockEvaluate;
        var page;

        beforeEach(function () {
            page = new Page();
            mockEvaluate = jasmine.createSpy('evaluate');
            mockCallback = jasmine.createSpy('callback');
            spyOn(winston, 'error');
            page._phPage.evaluate(mockEvaluate, mockCallback);
        });

        it('does not call evaluate argument', function () {
            expect(mockEvaluate).not.toHaveBeenCalled();
        });

        it('logs an error', function () {
            expect(winston.error).toHaveBeenCalledWith('Error: Page was not rendered.');
        });

        it('executes the callback with no parameters', function () {
            expect(mockCallback).toHaveBeenCalledWith();
        });
    
    });

});