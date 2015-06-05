init:
	rm -rf node_modules
	npm install

test:
	jasmine-node tests/func --verbose --captureExceptions
	jasmine-node tests/unit --verbose --captureExceptions