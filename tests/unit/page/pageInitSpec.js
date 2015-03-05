var urllib = require('url');
var Page = require('../../../crawler.js').Page;

describe('Page instantiation', function () {
  'use strict';

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

    it('sets "type" to to ""', function () {
        var page = new Page();
        expect(page.type).toBe('');
    });

    it('sets "links" to an empty array', function () {
        var page = new Page();
        expect(page.links).toEqual([]);
    });

    it('sets referrer to supplied referrer', function () {
        var page = new Page('http://www.google.com/', 'http://referrer.com/');
        expect(page.referrer).toBe('http://referrer.com/');
    });

    it('sets "isExternal" to false by default', function () {
        var page = new Page();
        expect(page.isExternal).toBe(false);
    });

    it('sets "isExternal" to supplied "isExternal" value', function () {
        var page = new Page(null, null, true);
        expect(page.isExternal).toBe(true);
    });

    it('removes the hash from a URL', function () {
        var page = new Page('http://domain.com/page#blahblah');
        expect(page.url).toBe('http://domain.com/page');
    });

});
