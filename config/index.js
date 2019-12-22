/**
  config - index.js - manages loadding and access to the application configuration
*/
const path =  require('path');
const configPath = path.join(__dirname, 'config.json');
const config = require(configPath);
const deepExtend = require('deep-extend');
const fs = require('fs');
const objectPath = require('object-path');
const homedir = require('os').homedir();
const shell = require('shelljs');

const hermes_DIR = path.join(homedir, '.hermes-cli');
const DEPLOYMENT_LOCK_DIR = path.join(hermes_DIR, 'deployment-locks');
const globalConfigPath = path.join(hermes_DIR, 'config.json');

shell.mkdir('-p', DEPLOYMENT_LOCK_DIR);

try {
	fs.statSync(globalConfigPath)
} catch(err) {
	shell.mkdir('-p', hermes_DIR);
	fs.writeFileSync(globalConfigPath, JSON.stringify({}));
}

let globalConfig = require(globalConfigPath);
deepExtend(config, globalConfig);

validateConfig(config);

config.package.url = createPackageServerUrl();
config.package.apiUrl = getApiUrl(config.package.host);
config.package.npmpackagebaseurl = createPackageServerUrl(true);

module.exports = config;

module.exports.setConfigValue = setConfigValue;
module.exports.getIntegrationConfig = getIntegrationConfig;
module.exports.saveFile = saveFile;
module.exports.readFile = readFile;
module.exports.hermes_DIR = hermes_DIR;
module.exports.DEPLOYMENT_LOCK_DIR = DEPLOYMENT_LOCK_DIR;
module.exports.getForwardedServerUrl = getForwardedServerUrl;

function setConfigValue(key, value) {
	objectPath.set(globalConfig, key, value);

	validateConfig(Object.assign(config, globalConfig));

	fs.writeFileSync(globalConfigPath, JSON.stringify(globalConfig));
}

/**
 * Get config used for [integration/unit]/tests and deployments
 * @param {String} projectName
 * @param {Object} configSchema
 * @return {*}
 */
function getIntegrationConfig(projectName, configSchema) {
	if(!globalConfig.integrationConfigPath) {
		throw new Error(`'integrationConfigPath' is not set. Update your configuration using 'hermes config set integrationConfigPath '$pathToConfig'`);
	}

	let config = require(globalConfig.integrationConfigPath)[projectName];

	if(config) {
		validateConfig(config, configSchema);
		return config;
	}

	throw new Error(`integration config does not have anything configured for '${projectName} at path=${globalConfig.integrationConfigPath}'`);
}

/**
  validateConfig - validates the config from file against the schema.json
  in the same folder
*/
function validateConfig(config, configSchema) {
    var Ajv = require('ajv');
    var ajv = new Ajv();

    var valid = ajv.validate(configSchema || require('./schema.json'), config);
    if (!valid) {
        throw new Error('config failed validation:' + JSON.stringify(ajv.errors));
    }
}

/**
  createPackageServerUrl - assembles a package server url based on the config, with or without
  the basic authentication section inside the url
*/
function createPackageServerUrl(withBasicAuth) {
	let forwardedTo = getForwardedServerUrl();

	if (forwardedTo) {
		console.log(`forwarding calls to ${forwardedTo}`);
		return forwardedTo;
	}
	var package = config.package;
	return package.host.protocol +
		'://' +
		(withBasicAuth ? package.user.username + ':' + package.user.password + '@' : '') +
		package.host.hostname +
		(package.host.port ? ':' + package.host.port : '');
}

/**
 * @param {Object} host
 * @param {String} host.hostname
 * @param {String} host.protocol
 * @param {Number?} host.port
 */
function getApiUrl({hostname, protocol, port}) {
	let apiUrl = getForwardedServerUrl();

	if (apiUrl) {
		console.log(`forwarding api calls to '${apiUrl}'`);
	} else {
		apiUrl = `${protocol}://${hostname}`;

		if (port) {
			apiUrl += `:${port}`;
		}
	}

	apiUrl += '/api';

	return apiUrl;
}

function getForwardedServerUrl() {
	const args = process.argv.slice(2);

	let forwardTo = args.find(arg => arg.startsWith('--forward'));
	if (forwardTo) {
		forwardTo = forwardTo.split('=')[1];
	}

	return forwardTo;
}

function saveFile(file, content) {
	if(typeof content === 'object') {
		content = JSON.stringify(content);
	}

	let filePath = path.join(hermes_DIR, file);

	shell.mkdir('-p', path.dirname(filePath));

	return fs.writeFileSync(filePath, content);
}

function readFile(fileName) {
	try {
		let content = fs.readFileSync(path.join(hermes_DIR, fileName));
		try {
			return JSON.parse(content);
		} catch(err) {
			return content;
		}

	} catch(err) {
		return null;
	}
}