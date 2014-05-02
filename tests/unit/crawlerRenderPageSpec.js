var phantom = require('phantom');
var winston = require('winston');
var Crawler = require('../../crawler').Crawler;

describe('Crawler._renderPage method', function () {
    var crawler;
    var createPageSpy;
    var mockFinish;
    var mockPageOpenStatus;
    var mockPH;
    var mockPHPage;
    var page;
    var pageOpenSpy;

    beforeEach(function () {
        crawler = new Crawler();
        page = {
            url: 'http://domain.com'
        };
        mockFinish = jasmine.createSpy('finish callback');
        mockPageOpenStatus = 'success';
        pageOpenSpy = jasmine.createSpy('page.open').andCallFake(function (url, callback) {
            callback(mockPageOpenStatus);
        });
        mockPHPage = {
            open: pageOpenSpy
        };
        createPageSpy = jasmine.createSpy('ph.createPage').andCallFake(function (callback) {
            callback(mockPHPage);
        });
        mockPH = {
            createPage: createPageSpy
        };
        spyOn(phantom, 'create').andCallFake(function (callback) {
            callback(mockPH);
        });
        spyOn(winston, 'error'); // Silence and spy on winston
    });

    describe('successful render', function () {

        beforeEach(function () {
            crawler._renderPage(page, mockFinish);
        });

        it('creates a new PhantomJS instance', function () {
            expect(phantom.create).toHaveBeenCalled();
        });

        it('creates a new PhantomJS page', function () {
            expect(createPageSpy).toHaveBeenCalled();
        });

        it('opens the page object\'s URL', function () {
            expect(pageOpenSpy).toHaveBeenCalledWith(page.url, jasmine.any(Function));
        });

        it('does not log any errors', function () {
            expect(winston.error).not.toHaveBeenCalled();
        });

        it('executes finish callback', function () {
            expect(mockFinish).toHaveBeenCalled();
        });

        it('stores PhantomJS object in "_ph" property', function () {
            expect(page._ph).toBe(mockPH);
        });

        it('stores PhantomJS page in "_phPage" property', function () {
            expect(page._phPage).toBe(mockPHPage);
        });
    
    });

    describe('execution (with errors)', function () {

        beforeEach(function () {
            mockPageOpenStatus = 'error';
            crawler._renderPage(page, mockFinish);
        });

        it('logs errors if page.open fails', function () {
            expect(winston.error).toHaveBeenCalledWith('Unable to render page: ' + page.url);
        });
    
    });

    describe('ph.exit', function () {
    
        
    
    });

});