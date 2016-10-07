'use strict';

const request = require('request');

module.exports = function (params, callback) {
  let abortedDownload = false;

  const requestParams = {
    url: params.url,
    gzip: true, // accept gzip, always
    headers: params.headers,
    jar: params.cookie !== undefined ? params.cookie : true,
    maxRedirects: params.maxRedirects,
    strictSSL: false, // we aren't strict here, just trying to scrape
    timeout: params.timeout
  };

  if (params.isExternal !== true && params.auth) {
    requestParams.auth = Object.assign({
      // this forces request to wait for the 401 status code before using authentication
      sendImmediately: false
    }, params.auth);
  }

  const finish = (error, response, body) => {
    // Add "url" property to response
    if (response) {
      response.url = response.request.href;
    }

    // Add code for certain error
    if (error) {
      if (error.message.indexOf('Exceeded maxRedirects') === 0) {
        error.code = 'MAX_REDIRECTS_REACHED';
      }
      if (error.message === 'ETIMEDOUT') {
        error.message = 'Request timed out.';
      }
    }

    callback(error, response, body || '');
  };

  const req = request.get(requestParams, finish)
    .on('response', (response) => {
      const NOT_AN_INDEX = -1;

      // Abort (preventing download) for the following pages
      if (
        // External pages (we don't need the body for anything)
        params.isExternal === true ||
        // Non-text documents
        response.headers &&
        response.headers['content-type'] &&
        response.headers['content-type'].indexOf('text/') < 0 ||
        // Paths that match the doNotDownload list
        params.doNotDownload.reduce(
          (hasExclude, exclude) =>
            params.originalUrl.search(exclude) !== NOT_AN_INDEX || hasExclude
        , false)
      ) {
        req.abort();
        abortedDownload = response;
      }
    })
    .on('end', () => {
      // If we aborted the download, proceed to finish
      if (abortedDownload) {
        finish(null, abortedDownload, '');
      }
    });

  return req;
};
