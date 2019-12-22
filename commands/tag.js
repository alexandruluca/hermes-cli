const path = require('path');
const Command = require('ronin').Command;
const getUsage = require('command-line-usage');
const {gitTag} = require('./scripts');

module.exports = Command.extend({
	desc: 'Create a git tag based on the current version',

	help: function () {
		return getUsage([
			{
				header: 'Create a git tag based on the current version'
			},
			{
				header: 'Usage',
				content: `${this.program.name} ${this.name}`
			},
		]);
	},

	run: async function (band, customdeploy) {
		var {version} = require(path.join(process.cwd(), 'package.json'));

		return gitTag(version);
	}
});