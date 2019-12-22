const Command = require('ronin').Command;
const {getCIChangeLogInfo} = require('../../utils/deployment');

class ChangeLog extends Command {
	constructor() {
		super();
		this.desc = 'Get deployment changelog';

		this.options = {
			band: {
				type: 'string',
				required: true
			}
		}
	}

	async run (band, deploymentName) {
		if(!deploymentName) {
			throw new Error('missing deploymentname');
		}

		let {changelog, deploymentMeta: {version}} = getCIChangeLogInfo(deploymentName, band);

		console.log(`${deploymentName}@${version}\n${changelog}`);
	}
}

module.exports = ChangeLog;
