#!/usr/bin/env node
const api = require('../lib/package-api');
const logger = require('../lib/logger');

api.initialize().then(() => {
	require('./index.js');
}).catch(err => {
	if(err.indexOf('Can\'t read from server.') > -1) {
		logger.error(`lb-packages initialization failed: ${err}`);
	}
	process.exit(1);
});
