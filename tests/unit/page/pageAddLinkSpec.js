var Page = require('../../../crawler.js').Page;

describe('Page.addLink method', function () {
  var page;

  beforeEach(function () {
    page = new Page('http://www.google.com/');
  });

  it('adds the URL to the links property', function () {
    page.addLink('http://www.bing.com/');
    expect(page.links).toEqual(['http://www.bing.com/']);
  });

  it('adds the full URL in relation to the page when a relative link is found', function () {
    page.addLink('/some-page');
    expect(page.links).toEqual(['http://www.google.com/some-page']);
  });

});