const Command = require('ronin').Command;
const logger = require('../../lib/logger');

const BuildPipelineFactory = require('../../build-pipeline/factory/AbstractFactory');

function getOptionList(options) {
	var optionList = [];

	Object.keys(options).forEach(optionName => {
		var option = options[optionName];
		optionList.push({
			name: optionName,
			alias: option.alias,
			description: option.description
		});
	});

	return optionList;
}

const DESCRIPTION = 'This command sets up the current project (build if needed), test followed up by a deploy and git tag';

const OPTIONS = {
	band: {
		type: "string",
		required: true
	},
	'dry-run': {
		type: "boolean"
	},
	'pr-skip-deploy': {
		type: "boolean"
	},
	'skip-test': {
		type: "boolean"
	}

};

class Deploy extends Command {
	constructor() {
		super();

		this.desc = DESCRIPTION;
		this.options = OPTIONS;
	}

	help() {
		return this.getUsage([
			{
				header: DESCRIPTION
			},
			{
				header: 'Options',
				optionList: getOptionList(OPTIONS)
			},
			{
				header: 'Usage',
				content: `${this.program.name} ${this.name} --band=$band --dry-run=true`
			},
		]);
	}

	async run (band, dryRun, skipDeployOnPullRequest, skipTest) {
		dryRun = dryRun === true;
		skipDeployOnPullRequest = skipDeployOnPullRequest === true;
		skipTest = skipTest === true;

		if(dryRun) {
			logger.info('running in dry-run mode');
		}

		if(skipDeployOnPullRequest) {
			logger.info('skipping deploy on pull request');
		}

		return BuildPipelineFactory.getTestDeployPipeline({band, dryRun, skipDeployOnPullRequest, skipTest}).run();
	}
}

module.exports = Deploy;