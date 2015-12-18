var pathlib = require('path');
var Crawler = require(pathlib.join(__dirname, '..', 'crawler')).Crawler;

describe('initialization', function () {

  var crawler;

  beforeEach(function () {
    crawler = new Crawler();
  });

  it('combines user specified settings with the defaults', function () {
    crawler.get('crawlExternal').should.equal(true);
    crawler = new Crawler({
      crawlExternal: false
    });
    crawler.get('crawlExternal').should.equal(false);
  });

  it('adds a _get method', function () {
    (Crawler.prototype._get === undefined).should.equal(true);
    crawler = new Crawler();
    crawler._get.should.be.an.instanceof(Function);
  });

  it('adds a _set method', function () {
    (Crawler.prototype._set === undefined).should.equal(true);
    crawler = new Crawler();
    crawler._set.should.be.an.instanceof(Function);
  });

  it('creates an async queue', function () {
    (crawler.get('asyncQueue') === undefined).should.be.true;
    crawler = new Crawler();
    crawler.get('asyncQueue').tasks.should.eql([]);
  });

  it('allows you to specify the number of workers for the queue', function () {
    crawler = new Crawler({
      workers: 6
    });
    crawler.get('asyncQueue').concurrency.should.eql(6);
  });

  it('uses the _finish method as the aysnc queue\'s "drain" event handler', function () {
    crawler = new Crawler();
    crawler.get('asyncQueue').drain.name.should.eql('bound _finish');
  });

  it('converts strings in "excludes" property to regular expressions', function () {
    crawler = new Crawler({
      excludes: ['^\\/some\\/path\\.escaped$']
    });
    crawler.get('excludes').should.eql([
      /^\/some\/path\.escaped$/g
    ]);
  });

});
