module.exports = function (params, callback) {
  var request = require('request');
  var abortedDownload = false;

  var requestParams = {
    url: params.url,
    headers: params.headers,
    jar: params.cookie !== undefined ? params.cookie : true,
    maxRedirects: params.maxRedirects,
    strictSSL: false,
    timeout: params.timeout
  };

  if (params.isExternal !== true && params.auth) {
    requestParams.auth = Object.assign({
      sendImmediately: false // this forces request to wait for the 401 status code before using authentication
    }, params.auth);
  }

  var req = request.get(requestParams, finish)
    .on('response', function (response) {
      // Abort (preventing download) for the following pages
      if (
        // External pages (we don't need the body for anything)
        params.isExternal === true ||
        // Non-text documents
        (response.headers && response.headers['content-type'] && response.headers['content-type'].indexOf('text/') < 0) ||
        // Paths that match the doNotDownload list
        params.doNotDownload.reduce((exclude) => (params.url.search(exclude)), false)
      ) {
        req.abort();
        abortedDownload = response;
      }
    })
    .on('end', function () {
      // If we aborted the download, proceed to finish
      if (abortedDownload) {
        finish(null, abortedDownload, '');
      }
    });

  return req;

  function finish(error, response, body) {
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
  }
};
