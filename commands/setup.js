/**
  get.js - implments the 'hermes config get' command
*/
var Command = require('ronin').Command;
const config = require('../config');
const {setConfigValue, isSetupComplete, getConfigValue} = require('../config');
const getUsage = require('command-line-usage')
const inquirer = require('inquirer');
const url = require('url');

module.exports = Command.extend({
	desc: 'Initial setup for hermes-cli',

    /**
      help - returns the usage statement for the command
    */
	help: function () {
		return getUsage([
			{
				content: 'Usage: ' + this.program.name + ' ' + this.name
			},
			{
				content: 'Initial setup for hermes-cli'
			}
		]);
	},

	run: async function () {
		if(!isSetupComplete) {
			return runSetup();
		}

		let answers = await inquirer.prompt([{
			type: 'confirm',
			name: 'continue',
			message: `Setup is already complete. Setup again?`,
		}]);

		if(answers.continue) {
			return runSetup();
		}
	}
});

function runSetup() {
	return inquirer.prompt([{
		type: 'input',
		name: 'apiUrl',
		message: `Hermes api url:`,
		default: config.package && config.package.url
	}, {
		type: 'input',
		name: 'hermesUser',
		message: `Hermes user name:`,
		default: getConfigValue('package.user.username')
	}, {
		type: 'password',
		name: 'hermesUserPass',
		message: `Hermes user password:`
	}]).then(answers => {
		if (!answers.apiUrl) {
			return;
		}

		setConfigValue('package.user.username', answers.hermesUser);
		setConfigValue('package.user.password', answers.hermesUserPass);

		let urlParts = url.parse(answers.apiUrl);

		setConfigValue('package.host.protocol', urlParts.protocol.startsWith('https') ? 'https' : 'http');
		setConfigValue('package.host.host', urlParts.host)
	});
}
