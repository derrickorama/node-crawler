(function () {
	var argv = require('optimist').argv;
	var _ = require('underscore');
	var Crawler = require('./crawler.js').Crawler;

	var url = argv._[0];

	console.log('Checking URL: ' + url);
	console.log('==============' + url.replace(/./gi, '='));

	var Settings = {
		show: {
			statusCodes: true
		},
		callbacks: {},
		defaultOnPageCrawl: function (page, response) {
			console.log('====== onPageCrawl ======');

			// Show all info if nothing specified
			if (Settings.showSpecific !== true) {
				console.log(page);
				console.log(response);
			} else {
				// Show status codes
				if (Settings.show['status-codes'] === true) {
					console.log('Status code: ' + response.statusCode);
				}
			}
		},
		defaultOnDrain: function () {
			//console.log('====== onDrain ======');
		},
		defaultOnError: function (page, error, response) {
			console.log('====== onError ======');

			// Show all info if nothing specified
			if (Settings.showSpecific !== true) {
				console.log(page);
				console.log(error);
				console.log(response);
			} else {
				// Show status codes
				if (Settings.show['status-codes'] === true) {
					console.log('Status code: ' + response.statusCode);
				}
			}
		},
		runCallbacks: function (args) {
			Settings.callbacks.onPageCrawl = args['on-crawl'] === true ? Settings.defaultOnPageCrawl : function () {};
			Settings.callbacks.onDrain = args['on-drain'] === true ? Settings.defaultOnDrain : function () {};
			Settings.callbacks.onError = args['on-error'] === true ? Settings.defaultOnError : function () {};
		},
		showMe: function (type) {
			if (Settings.showSpecific !== true) {
				// Don't show anything other than what's specified from here on in
				_.each(Settings.show, function (showType) {
					Settings.show[showType] = false;
				});
				Settings.showSpecific = true;
			}

			// Show this
			Settings.show[type] = true;
		},
		init: function () {
			Settings.callbacks = {
				onPageCrawl: Settings.defaultOnPageCrawl,
				onDrain: Settings.defaultOnDrain,
				onError: Settings.defaultOnError
			};
		}
	};

	// Initialize
	Settings.init();

	// Check for isolated callback debugging
	if (argv['on-error'] || argv['on-drain'] || argv['on-crawl']) {
		Settings.runCallbacks(argv);
	}

	// Check for logging specifics
	if (argv['status-codes']) {
		Settings.showMe('status-codes');
	}

	console.log('');

	var crawler = new Crawler(Settings.callbacks);
	crawler.queue(url, false);
}());