const path = require('path');
const shush = require('shush');
const {getArgs, kebabCase} = require('../../utils');
const logger = require('../logger');
const {getIntegrationConfig} = require('../../config');

const Action = {
	DB_FLUSH: 'flush'
};

class TestDeploy {
	constructor() {
		let deployDir = path.dirname(module.parent.filename);
		delete require.cache[__filename];
		this.projectName = deployDir.split(path.sep).pop();
		this.configSchema = shush(path.join(deployDir, 'config-schema.json'));
	}

	getArgs() {
		return {};
	}

	async run() {
		const retArgs = getArgs(this.getArgs());

		if(!this.runScript) {
			throw new Error(`${this.constructor.name} does not implement 'runScript'`);
		}

		return this.runScript(retArgs);
	}

	getConfig() {
		return getIntegrationConfig(this.projectName, this.configSchema);
	}

	/**
	 * Custom action on regenerating a database
	 */
	flushDatabase() {
		throw new Error(`'${Action.DB_FLUSH}' not implemented`);
	}

	runActions(actions = []) {
		actions = actions.map(action => {
			logger.info(`performing '${action}' on ${this.projectName}`);
			if(action === Action.DB_FLUSH) {
				return this.flushDatabase();
			}

			logger.warn(`'${action}' not supported!`);
		});

		return Promise.all(actions);
	}

	getTestArgList() {
		let config = this.getConfig();
		let argList = [];

		for(let prop in config) {
			let val = config[prop];
			if(typeof val !== 'string') {
				continue;
			}

			argList.push(`--${kebabCase(prop)}=${val}`);


		}

		return argList.join(' ');
	}
}

module.exports = TestDeploy;