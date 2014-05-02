var Page = require('../../../crawler.js').Page;

describe('Page.render method', function () {
    var page;
    var mockCallback;

    beforeEach(function () {
        page = new Page();
        page._phPage = 'phPageObject';
        mockCallback = jasmine.createSpy('callback');
        spyOn(page, 'phExit');
    });

    it('executes the supplied callback with PhantomJS "page" object and an exit callback', function () {
        page.render(mockCallback);
        expect(mockCallback).toHaveBeenCalledWith('phPageObject', jasmine.any(Function));
    });

    it('exits PhantomJS when the exit callback is called', function () {
        mockCallback.andCallFake(function (page, exit) {
            exit('myCheckID');
        });
        page.render(mockCallback);
        expect(page.phExit).toHaveBeenCalledWith('myCheckID');
    });

});