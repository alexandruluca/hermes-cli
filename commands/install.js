var Command = require('ronin').Command;
const api = require('../lib/package-api');
const inquirer = require('inquirer');
const getUsage = require('command-line-usage');

/**
 create.js - implments the 'hermes deploy create' command
 */
const packageServer = require('../lib/deploy');

/**
 DeployCreateCommand - requests a new deployment upload and uploads
 */
module.exports = Command.extend({
	desc: 'Downloads and extracts a deployment',

	options: {
		band: {
			type: 'string'
		}
	},

	/**
	 help - returns the usage statement for the command
	 */
	help: function () {
		return getUsage([
			{
				content: 'Usage: ' + this.program.name + ' ' + this.name + ' $deploymentName@$$version'
			}
		]);
	},

	run: async function (band, deploymentName) {
		if(!deploymentName) {
			console.log(this.help());
			throw new Error('missing ${deploymentName}');
		}

		var [deploymentName, version] = deploymentName.split('@');

		if(!version) {
			var deployments = await api.deployments.getDeploymentVersions({deploymentName, band, latest: true});
			if(deployments.length === 0) {
				var msg = `no deployment found for '${deploymentName}'`;
				if(band) {
					msg += ` band=${band}`;
				}
				throw new Error(msg);
			}

			version = deployments[0].version;
			band = band || deployments[0].band;
		} else {
			var deploymentMeta = {deploymentName, version, band};

			var existingDeployment = await packageServer.getDeployment(deploymentMeta);

			if(!band) {
				band = existingDeployment.band;
			}
		}

		return inquirer.prompt([{
			type: 'confirm',
			name: 'install',
			message: `Continue with ${deploymentName}@${version} band=${band} installation?`
		}]).then(answers => {
			if(!answers.install) {
				return;
			}

			return packageServer.downloadDeployment({deploymentName, band, version});
		});
	}
});