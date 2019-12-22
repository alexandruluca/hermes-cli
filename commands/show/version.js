const Command = require('ronin').Command;
const packageLib = require('../../lib/deploy');
const getUsage = require('command-line-usage');

/**
 DeployCreateCommand - requests a new deployment upload and uploads
 */
module.exports = Command.extend({
	desc: 'Get deployment info',

	options: {
		band: {
			type: 'string'
		}
	},

	help: function () {
		return getUsage([
			{
				content: 'Usage: ' + this.program.name + ' ' + this.name
			}
		]);
	},

	run: function (band, deploymentName) {
		return runCommand(band, deploymentName);

	}
});

async function runCommand(band, deploymentName) {
	if(!deploymentName) {
		throw new Error('missing deploymentname');
	}

	return packageLib.getDeploymentVersions(deploymentName, band).then(deployments => {
		deployments.forEach(d => {
			console.log(`${d.name}@${d.version} '${d.version}' band=${d.band}`);
		});
	});
}