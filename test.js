#!/usr/bin/env node
/* eslint no-console:0 */

const argv = require('yargs')
  .usage('Usage: $0 [url]')
  .demandCommand(1)
  .argv;
const _ = require('lodash');
const Crawler = require('./crawler').Crawler;

const crawler = new Crawler({
  excludes: [
    /\/mt-search\.cgi/g
  ],
  headers: {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Encoding': 'gzip, sdch',
    'Accept-Language': 'en-US,en;q=0.8',
    'User-Agent': `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36${''
      }(KHTML, like Gecko) Chrome/41.0.2272.76 Safari/537.36`,
    'PageSpeed': 'off'
  },
  workers: 10
});

const pagesCrawled = () => {
  return crawler.get('urlsCrawled').length;
};

const pagesLeft = () => {
  return crawler.get('urlsQueued').length;
};

crawler.start(_.first(argv._));
crawler.on('pageCrawled', (/*response, body*/) => {
  console.log(`${pagesCrawled()} crawled | ${pagesLeft()} left`);
});
crawler.on('redirect', (response) => {
  if (!response.isExternal) {
    console.log(`Redirect: ${response.redirect} -> ${response.url}`);
  }
});
crawler.on('error', (err, response) => {
  console.error('-->');
  console.error(`Erorr on: ${response.url}`);
  console.error(err ? err.stack : `Bad status: ${response.statusCode}`);
  console.error('Referrer:', response.referrer);
  console.log(`${pagesCrawled()}/${pagesLeft()}`);
});
crawler.on('finish', () => {
  console.log('done');
});
