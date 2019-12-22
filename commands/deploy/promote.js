const {Command} = require('../../lib/cli/command');
const packageServer = require('../../lib/deploy');
const {ErrorCode, CliError} = require('../../lib/error');
const inquirer = require('inquirer');
const logger = require('../../lib/logger');

module.exports = new Command({
	options: {
	},
	optionsExample: {
		deploymentInfo: 'launchbase@3.2.1',
		serverTag: 'p5'
	},
	run: async function (deploymentInfo, serverTag) {
		deploymentInfo = deploymentInfo || '';
		let [deploymentName, version] = deploymentInfo.split('@');

		if(!deploymentName || !version || !serverTag) {
			return this.helpAndExit('invalid deploymentInfo');
		}

		let deploymentMeta = {deploymentName, version, band: 'release'};

		try {
			await packageServer.getDeployment(deploymentMeta);
		} catch(err) {
			if(err.code === ErrorCode.DEPLOYMENT_NOT_FOUND) {
				throw new CliError(`deployment not found for '${deploymentName}@${version}' band='release'`);
			}
			throw err;
		}


		return inquirer.prompt([{
			type: 'confirm',
			name: 'promote',
			message: `Promote ${deploymentName}@${version} to production band?`
		}]).then(answers => {
			if(!answers.promote) {
				return;
			}

			return packageServer.promoteDeployment({deploymentName, version, serverTag}).then(() => {
				logger.info(`${deploymentName}@${version} was promoted to production band`);
			})
		});
	}
});