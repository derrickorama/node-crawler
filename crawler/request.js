var http = require('http');
var https = require('https');
var urllib = require('url');
var winston = require('winston');

module.exports = function (params, callback) {
  'use strict';

  var Buffer = require('buffer').Buffer;

  var crawler = this;
  var body = new Buffer('');
  var called = false;
  var error = null;
  var errorTimeout;
  var redirects = 0;
  var req;
  var requestTimeout;
  var response;

  var COMMON_MEDIA_EXT = /\.(?:3gp|aif|asf|asx|avi|flv|iff|m3u|m4a|m4p|m4v|mov|mp3|mp4|mpa|mpg|mpeg|ogg|ra|raw|rm|swf|vob|wav|wma|wmv)$/;

  function doRequest(url, useAuth, secureProtocol) {
    var urlData = urllib.parse(url);
    var requestFunc = http;
    var query = urlData.search || '';
    var secureProtocolFix = false;

    // Start timeout
    waitForTimeout();

    // Make sure params.headers is an object by default
    if (!params.headers) {
      params.headers = {};
    }

    // Select correct protocol
    if (urlData.protocol === 'https:') {
      requestFunc = https;
    }

    // Add authorization if available and useAuth is flagged
    if (useAuth && params.auth) {
      params.headers.Authorization = 'Basic ' + new Buffer(params.auth.username + ':' + params.auth.password).toString('base64');
    }

    // Attempt request
    try {
      req = requestFunc.request({
        method: params.method || 'GET',
        protocol: urlData.protocol,
        host: urlData.hostname,
        port: urlData.port,
        path: urlData.pathname + query,
        rejectUnauthorized: params.hasOwnProperty('strictSSL') ? params.strictSSL : false,
        secureProtocol: secureProtocol,
        headers: Object.assign({
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Encoding': 'gzip, sdch',
          'Accept-Language': 'en-US,en;q=0.8',
          'cookie': params.jar ? params.jar.getCookiesSync(urlData.href).join('; ') : '',
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2272.76 Safari/537.36',
          'PageSpeed': 'off' // disable ModPageSpeed
        }, params.headers)
      }, function (res) {
        var contentType = '';
        var deflateBody;

        response = res; // Set response
        clearTimeout(errorTimeout); // Clear error and try to download

        // Set response.url to current URL
        response.url = url;

        // Follow redirect
        if (
          response.statusCode &&
          response.statusCode.toString().indexOf('30') === 0 &&
          response.headers.location
        ) {

          // Save cookies
          // if (crawler.jar !== false) {
          //   response.headers['set-cookie'].forEach(function (cookie) {
          //     crawler.jar.setCookieSync(cookie, urlData.href, {
          //       ignoreError: true
          //     });
          //   });
          // }

          // Peform redirect
          req.abort();

          if (redirects > 9) {
            error = {
              code: 'MAX_REDIRECTS_REACHED',
              message: 'The requested URL has redirected more than 9 times. This could indicate an infinite redirect loop.'
            };
            finish();
            return;
          }
          redirects++;
          doRequest(urllib.resolve(url, response.headers.location));
          return;
        }

        // Try to resolve secure protocol issues
        if (resolveSecureProtocol(url, urlData.protocol, useAuth, secureProtocol) === true) {
          return;
        }

        // Try to authenticate internal 401s
        if (
          params.isExternal !== true &&
          response.statusCode &&
          response.statusCode === 401 &&
          params.auth
        ) {
          // Use credentials
          req.abort();
          doRequest(url, true);
          return;
        }

        if (response.headers['content-encoding'] === 'gzip') {
          deflateBody = true;
        }

        // Update response
        if (typeof response === 'object' && typeof response.headers === 'object' && response.headers.hasOwnProperty('content-type') === true) {
          contentType = response.headers['content-type'];
        }

        // Do not download non-text documents or external page content
        if (
          contentType.indexOf('text/') < 0 ||
          // Eliminate common file extensions that do not have the correct content-type
          contentType.indexOf('text/') > -1 && COMMON_MEDIA_EXT.test(params.url) === true ||
          // Exclude external pages - we don't care about the content
          params.isExternal === true
        ) {
          // Set page HTML to nothing since we haven't downloaded the body yet
          body = '';
          req.abort();
          finish();
          return;
        }

        // Download text/HTML
        res.on('data', function (data) {
          body = Buffer.concat([body, data]);
        });

        res.on('end', function () {
          var zlib = require('zlib');

          if (deflateBody === true) {
            zlib.unzip(body, function(err, buffer) {
              if (err) {
                winston.error(err);
              }
              body = buffer.toString();
              finish();
            });
          } else {
            body = body.toString();
            finish();
          }
        });
      });
    } catch (err) {
      winston.error(err.stack);
      error = err;
      finish();
      return;
    }

    req.on('error', function (err) {
      // Make sure this isn't a secure protocol error
      if (resolveSecureProtocol() === true) {
        return;
      }

      error = err;
      errorTimeout = setTimeout(finish, 10);
    });

    req.end();

    // Set timeout for request
    function waitForTimeout() {
      clearTimeout(requestTimeout);
      requestTimeout = setTimeout(function () {

        // Make sure this isn't a secure protocol error
        if (resolveSecureProtocol() === true) {
          return;
        }

        if (req) {
          req.abort();
        }

        error = { message: 'Request timed out.', code: 'ETIMEDOUT' };
        finish();
      }, params.timeout || 30000);
    }

    function resolveSecureProtocol() {
      // Do not run the fix if it has already been fixed
      if (secureProtocolFix === true) {
        return false;
      }

      secureProtocolFix = true;

      if (
        urlData.protocol === 'https:' &&
        (
          !response ||
          !response.statusCode ||
          response.statusCode !== 200
        ) &&
        (
          secureProtocol === undefined || secureProtocol === 'TLSv1_client_method'
        )
      ) {
        req.abort();

        if (secureProtocol === 'TLSv1_client_method') {
          // Try the other secure protocol
          secureProtocol = 'SSLv3_client_method';
        } else {
          // Try using nothing
          secureProtocol = 'TLSv1_client_method';
        }

        doRequest(url, params.auth, secureProtocol);
        return true;
      }

      return false;
    }
  }

  doRequest(params.url);

  function finish() {
    if (called === true) {
      return;
    }
    called = true;
    clearTimeout(errorTimeout);
    clearTimeout(requestTimeout);
    callback(error, response, body);
  }
};
