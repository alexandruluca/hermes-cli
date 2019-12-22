const Command = require('ronin').Command;
const logger = require('../../lib/logger');
const {setConfigValue} = require('../../config');
const objectPath = require("object-path");
const getUsage = require('command-line-usage');

module.exports = Command.extend({
	desc: 'Stores a new property in the global config',

	/**
	 help - returns the usage statement for the command
	 */
	help: function() {
		return getUsage([
			{
				content: 'Usage: ' + this.program.name + ' ' + this.name + ' <configuration property or path>'
			},
			{
				content: 'Prints the value of a config property. The specified property can be a property or a dot-separated path\n\n###'
			}
		]);
	},

	run: function (key, value) {
		if(!key || !value){
			logger.error(`missing configuration ${value ? 'key': 'value'}`);
			console.log(this.help());
			return;
		}

		setConfigValue(key, value);
	}
});
