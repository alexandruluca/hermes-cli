const seleniumServer = require("selenium-server");
const chromedriver = require("chromedriver");

var nightwatchConfig = require('./nightwatch.common.conf');

var customConfig = {
	selenium: {
		start_process: true, // tells nightwatch to start/stop the selenium process
		server_path: seleniumServer.path,
		host: "127.0.0.1",
		port: 4444, // standard selenium port
		cli_args: {
			"webdriver.chrome.driver" : chromedriver.path
		}
	}
};

nightwatchConfig = Object.assign(nightwatchConfig, customConfig);

for(let prop in nightwatchConfig.test_settings) {
	let desiredCapabilities = nightwatchConfig.test_settings[prop].desiredCapabilities;
	if(desiredCapabilities.browser) {
		desiredCapabilities.browserName = desiredCapabilities.browser.toLowerCase();
		delete desiredCapabilities.browser;
	}
}

module.exports = nightwatchConfig;