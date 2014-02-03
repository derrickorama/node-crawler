var Crawler = require('../../crawler.js').Crawler;

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