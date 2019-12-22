const {parseXml} = require('../xml');
const fs = require('fs');
const path = require('path');
const {isMobileAppBuild} = require('../../utils/manifest');

const CONFIG_XML_PATH = path.join(process.cwd(), 'client/config.xml');

exports.getVersionNumbers = getVersionNumbers;
exports.writeConfigXml = writeConfigXml;
exports.isMobileAppBuild = isMobileAppBuild;

async function getVersionNumbers() {
	if (!isMobileAppBuild) {
		return {};
	}
	let configXml = await parseXml(fs.readFileSync(CONFIG_XML_PATH));

	let androidVersionCode = configXml.widget.$['android-versionCode'];
	let iosCfBundleId = configXml.widget.$['ios-CFBundleVersion'];

	return {
		iosCfBundleId,
		androidVersionCode
	};
}

async function writeConfigXml(replacementValues) {
	let configXml = fs.readFileSync(CONFIG_XML_PATH, 'utf8');

	for(let key in replacementValues) {
		let val = replacementValues[key];
		configXml = configXml.replace(new RegExp(`${key}="[-0-9a-z.]+"`), `${key}="${val}"`);
	}

	fs.writeFileSync(CONFIG_XML_PATH, configXml);
}