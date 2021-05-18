#!/usr/bin/env node
const api = require('../lib/package-api');
const logger = require('../lib/logger');

const isSetupCommand = process.argv[2] === 'setup';
global.isSetupCommand = isSetupCommand;

(async () => {
	try {
		if (!isSetupCommand) {
			await api.initialize();
		}
		require('./index.js');
	} catch (err) {
		if ((err.message || err).indexOf('Can\'t read from server.') > -1) {
			logger.error(`lb-packages initialization failed: ${err}`);
		}
		console.log(err);
		process.exit(1);
	}
})();