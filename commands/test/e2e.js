const Command = require('ronin').Command;
const getUsage = require('command-line-usage');
const path = require('path');
const fs = require('fs');
const Ajv = require('ajv');
const ajv = new Ajv();
const {TestRunner, PLATFORM} = require('../../lib/e2e-test/TestRunner');
const CONFIG_SCHEMA = require('../../lib/e2e-test/config-schema');
const defaultConfig = require('../../lib/e2e-test/default-config');
const logger = require('../../lib/logger');
const shell = require('shelljs');
const {getCustomDeploy} = require('../../utils/deployment');
const defaults = require('defaults-deep');

const log = console.log

console.log = function() {
	log.apply(console, new Error());
	return log.apply(console, arguments);
}

/**
 DeployCreateCommand - requests a new deployment upload and uploads
 */
module.exports = Command.extend({
	desc: 'This command does an end-to-end test',

	options: {
		'config-path': {
			type: 'string',
			alias: 'c'
		},
		'reporting-dir': {
			type: 'string',
			alias: 'r'
		},
		'spec-dir': {
			type: 'string',
			alias: 's'
		},
		'config-schema-path': {
			type: 'string',
			alias: 'p'
		},
		'cwd': {
			type: 'string'
		}
	},

	/**
	 help - returns the usage statement for the command
	 */
	help: function () {
		return getUsage([
			{
				content: 'Usage: ' + this.program.name + ' ' + this.name + ' -c $configurationPath -s $testSpecificationDir'
			}
		]);
	},

	/**
	 * @param {String} configPath
	 * @param {String} specDir
	 * @param {String} reportingDir
	 * @param {String} configSchemaPath
	 * @param { {name: string, actions: ('db-flush')[]}[] } dependencies
	 */
	run: async function (configPath, reportingDir, specDir, configSchemaPath, cwd, dependencies) {
		return this.runCommand({
			configPath,
			reportingDir,
			specDir,
			configSchemaPath,
			cwd,
			dependencies
		});
	},
	runCommand: async function({configPath, reportingDir, specDir, configSchemaPath, cwd, dependencies}) {
		console.log('e2e args');
		console.log(arguments);
		cwd = cwd || '';
		configPath = configPath || path.join(cwd, './test/config.json');
		reportingDir = reportingDir || path.join(cwd, './test/reporting');
		specDir = specDir || path.join(cwd, './test/spec');
		configSchemaPath = configSchemaPath || path.join(cwd, './test/config-schema.json');
		dependencies = dependencies || [];

		configPath = getAbsFilePath(configPath);
		specDir = getAbsFilePath(specDir);
		reportingDir = getAbsFilePath(reportingDir);
		configSchemaPath = getAbsFilePath(configSchemaPath);

		shell.mkdir('-p', reportingDir);

		logger.debug(`config path: ${configPath}`);
		logger.debug(`config-schema path: ${configSchemaPath}`);
		logger.debug(`spec dir: ${specDir}`);
		logger.debug(`reporting dir: ${reportingDir}`);


		let runPrerequisiteActions = dependencies.map(({name, actions}) => {
			const CustomDeploy = getCustomDeploy(name);
			if(!CustomDeploy) {
				return;
			}

			return new CustomDeploy().runActions(actions);
		});

		await Promise.all(runPrerequisiteActions);

		let configOptions = {
			configPath,
			configSchemaPath,
			specDir,
			reportingDir
		};

		const config = Object.assign(defaultConfig, initTestConfiguration(configOptions));

		let capabilities = initCapabilities(config.desiredCapabilities);

		var testSuites = Promise.resolve();

		for(let capabilityName in capabilities) {
			testSuites = testSuites.then(() => {
				var options = {
					configPath,
					specDir,
					env: capabilityName
				};

				return new TestRunner().run(options);
			})
		}

		return testSuites;
	}
});

function getAbsFilePath(filePath) {
	if(!filePath) {
		throw new Error('no path provided');
	}
	if(!filePath.startsWith('/')) {
		filePath = path.join(process.cwd(), filePath);
	}

	try {
		fs.statSync(filePath)
	} catch(err) {
		throw new Error(`invalid path: '${filePath}'`);
	}

	return filePath;
}

function initTestConfiguration({configPath, specDir, reportingDir, configSchemaPath}) {
	var rootConfig = {};
	var rootConfigSchema = CONFIG_SCHEMA;

	if(configSchemaPath) {
		var customConfigSchema = require(configSchemaPath);
		rootConfigSchema = defaults(CONFIG_SCHEMA, customConfigSchema);
	}

	try {
		rootConfig = require(configPath);
	} catch(err) {
		throw new Error(`missing root config.json at path='${configPath}'`);
	}

	var valid = ajv.validate(rootConfigSchema, rootConfig);

	if(!valid) {
		throw new Error(ajv.errors.map(e => `'${e.dataPath}' ${e.message}`).join(', '));
	}

	rootConfig.specDir = specDir;
	rootConfig.reportingDir = reportingDir;

	global.CONFIG = rootConfig;

	return rootConfig;
}

function initCapabilities(desiredCapabilities = []) {
	global.CAPABILITIES = {};

	desiredCapabilities.forEach(capability => {
		let headless = capability.headless;
		headless = headless === true;
		delete capability.headless;

		var options = {};

		if(headless) {
			options.args = ["--headless"]
		}

		let capabilityName = capability.browser;

		if(capability.browser_version) {
			capabilityName += '/' + capability.browser_version;
		}

		global.CAPABILITIES[capabilityName] = {
			desiredCapabilities: capability
		};

		if(headless) {
			global.CAPABILITIES[capabilityName].desiredCapabilities.chromeOptions = options;
		}
	});

	return global.CAPABILITIES;
}
