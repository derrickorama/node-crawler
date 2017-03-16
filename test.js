var Crawler = require('./crawler').Crawler;

var crawler = new Crawler({
  excludes: [
    /\/mt-search\.cgi/g
  ],
  headers: {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Encoding': 'gzip, sdch',
    'Accept-Language': 'en-US,en;q=0.8',
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2272.76 Safari/537.36',
    'PageSpeed': 'off'
  },
  workers: 10
});

crawler.start('http://www.attwatersjamesonhill.co.uk');
crawler.on('pageCrawled', function (response, body) {
  console.log(pagesCrawled() + '|' + pagesLeft());
});
crawler.on('error', function (err, response) {
  console.error('-->');
  console.error('Erorr on: ' + response.url);
  console.error(err ? err.stack : 'Bad status: ' + response.statusCode);
  console.error('Referrer:', response.referrer);
  console.log(pagesCrawled() + '/' + pagesLeft());
});
crawler.on('finish', function () {
  console.log('done');
});

function pagesCrawled() {
  return crawler.get('urlsCrawled').length;
}

function pagesLeft() {
  return crawler.get('urlsQueued').length;
}
