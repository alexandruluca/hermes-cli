var nightwatchConfig = require('./nightwatch.common.conf');

var customConfig = {
	selenium: {
		start_process : false,
		port : global.CONFIG.seleniumServerPort
	}
};

nightwatchConfig = Object.assign(nightwatchConfig, customConfig);

for(var browserName in nightwatchConfig.test_settings) {
	var browserConfig = nightwatchConfig.test_settings[browserName];

	browserConfig['selenium_host'] = nightwatchConfig.selenium.host;
	browserConfig['selenium_port'] = nightwatchConfig.selenium.port;
}

module.exports = nightwatchConfig;