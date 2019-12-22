const SCREENSHOT_PATH = "./screenshots/";
const TEST_SETTING_GLOBALS = require('./test-settings')(global.CONFIG);

var FILECOUNT = 0; // "global" screenshot file count

global.DEFAULT_TIMEOUT = 10000;


var nightwatchConfig = {
	src_folders: [
		global.CONFIG.specDir// Where you are storing your Nightwatch e2e tests
	],
	output_folder: global.CONFIG.reportingDir, // reports (test outcome) output by nightwatch
	test_settings: {}
};

for(var prop in global.CAPABILITIES) {
	let capability = global.CAPABILITIES[prop];

	//global setup, like beforeEach
	capability.globals = TEST_SETTING_GLOBALS;

	nightwatchConfig.test_settings[prop] = capability;
}


module.exports = nightwatchConfig;
module.exports.imgpath = imgPath;
module.exports.SCREENSHOT_PATH = SCREENSHOT_PATH;

/**
 * The default is to save screenshots to the root of your project even though
 * there is a screenshots path in the config object above! ... so we need a
 * function that returns the correct path for storing our screenshots.
 * While we're at it, we are adding some meta-data to the filename, specifically
 * the Platform/Browser where the test was run and the test (file) name.
 */
function imgPath (browser) {
	var a = browser.options.desiredCapabilities;
	var meta = [a.platform];
	meta.push(a.browserName ? a.browserName : 'any');
	meta.push(a.version ? a.version : 'any');
	meta.push(a.name); // this is the test filename so always exists.
	var metadata = meta.join('~').toLowerCase().replace(/ /g, '');
	return SCREENSHOT_PATH + metadata + '_' + padLeft(FILECOUNT++) + '_';
}

function padLeft (count) { // theregister.co.uk/2016/03/23/npm_left_pad_chaos/
	return count < 10 ? '0' + count : count.toString();
}