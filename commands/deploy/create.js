const fs = require('fs');
const {execScript, requiredParam: rp} = require('../../utils');
const logger = require('../../lib/logger');

/**
 create.js - implments the 'hermes deploy create' command
 */

const Command = require('ronin').Command;
const getUsage = require('command-line-usage');
const BANDS = ['develop', 'release', 'qa'];

const BuildPipelineFactory = require('../../build-pipeline/factory/AbstractFactory');

/**
 DeployCreateCommand - requests a new deployment upload and uploads
 */
module.exports = Command.extend({
	desc: 'This command archives the current folder, tags the repository, requests a new deployment and uploads the file.',

	options: {
		band: {
			type: 'string',
			required: true
		},
		'override-existing': {
			type: 'boolean'
		}
	},

	/**
	 help - returns the usage statement for the command
	 */
	help: function () {
		return getUsage([
			{
				content: 'Usage: ' + this.program.name + ' ' + this.name + ' --band=$band'
			},
			{
				content: 'The contents of the current folder, excluding git-related files and folders, is compressed into and archive, the repository is tagged with the specified version the archive is uploaded the the deployment bucket via the package server.'
			},
			{
				content: 'The name of the deployment file will be the name of the current folder plus the specified version, with the .zip file extension, for example project-dsm-bid-integrator-web-1.0.6.zip.'
			},
			{
				content: "Example",
			},
			{
				content: '>cd ~/src/project-dsm-bid-integrator-web\n>hermes deploy create -b release -r peter.sand@hermes.com\nDone uploading deployment project-dsm-bid-integrator-web-1.0.6.zip\n\n###'
			}
		]);
	},

	/**
	 * run - execution of the command, archives, tags and uploads
	 * @param {String=} band
	 */
	run: function (band, overrideExistingDeployment) {
		if(BANDS.indexOf(band) === -1) {
			throw new Error(`band '${band}' is not supported, only [${BANDS}] are valid`);
		}

		return BuildPipelineFactory.getDeployPipeLine({band, overrideExistingDeployment}).run();
	}
});