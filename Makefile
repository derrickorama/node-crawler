init:
	rm -rf node_modules
	npm install

test:
	jasmine-node tests --verbose --captureExceptions