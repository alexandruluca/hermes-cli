var defaultConf = require('./nightwatch.common.conf');
const defaults = require('defaults-deep');

global.DEFAULT_TIMEOUT = 10000;

nightwatch_config = {
	src_folders: [
		global.CONFIG.specDir// Where you are storing your Nightwatch e2e tests
	],
	output_folder: global.CONFIG.reportingDir, //
	selenium: {
		"start_process": false,
		"host": "hub-cloud.browserstack.com",
		"port": 80
	},

	test_settings: {
	}
};

for(let prop in defaultConf.test_settings) {
	nightwatch_config.test_settings[prop] = defaultConf.test_settings[prop];
}

// Code to copy seleniumhost/port into test settings
for (var i in nightwatch_config.test_settings) {
	var config = nightwatch_config.test_settings[i];
	config['selenium_host'] = nightwatch_config.selenium.host;
	config['selenium_port'] = nightwatch_config.selenium.port;

	defaults(config, {
		desiredCapabilities: {
			'browserstack.user': global.CONFIG.browserStackUsername,
			'browserstack.key': global.CONFIG.browserStackKey
		}
	});
}

module.exports = nightwatch_config;