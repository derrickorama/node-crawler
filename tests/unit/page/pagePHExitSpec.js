var Page = require('../../../crawler.js').Page;

describe('Page.phExit method', function () {
    var page;

    beforeEach(function () {
        page = new Page();
        page.phWaits = ['check1', 'check2'];
        page._ph = {
            exit: jasmine.createSpy('page._ph.exit')
        };
    });

    it('removes the supplied check ID from the PhantomJS waits array', function () {
        page.phExit('check2');
        expect(page.phWaits).toEqual(['check1']);
    });

    it('does not remove anything if the check ID doesn\'t exist', function () {
        page.phExit('idontexist');
        expect(page.phWaits).toEqual(['check1', 'check2']);
    });

    it('exits PhantomJS if there are no checks remaining after check ID is removed', function () {
        page.phExit('check1');
        page.phExit('check2');
        expect(page._ph.exit.calls.length).toBe(1);
    });

    it('does not exit PhantomJS if there are still checks remaining after check ID is removed', function () {
        page.phExit('check1');
        expect(page._ph.exit.calls.length).toBe(0);
    });

});