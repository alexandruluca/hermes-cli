const CliCommand = require('ronin').Command;
const getUsage = require('command-line-usage');
const STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
const ARGUMENT_NAMES = /([^\s,]+)/g;
const logger = require('../logger');

exports.Command = class Command {
	constructor(opt) {
		['options', 'optionsExample'].forEach(requiredOption => {
			if(!opt[requiredOption]) {
				throw new Error(`missing option='${requiredOption}'`);
			}
		});

		let me = this;
		opt.helpAndExit = function(message) {
			let options = opt.options;
			let run = opt.run;
			let flags = Object.keys(options);
			let optionCount = Object.keys(options).length;
			let paramNames = getParamNames(run);

			if(paramNames.length > optionCount) {
				paramNames = paramNames.slice(0, paramNames.length, optionCount);
			}

			let help = me.help.apply(this, [flags, paramNames]);
			if(message) {
				help = `${message}\n${help}`;
			}
			help += me.exampleHelp.apply(this, [flags, paramNames, opt.optionsExample]);
			logger.error(help);
			process.exit(1);
		};

		return CliCommand.extend(opt);
	}

	help(flags, paramNames) {
		let argHelp = flags.map(flag => `--${flag}=$${flag}`);

		argHelp = argHelp.concat(paramNames.map(pName => `$${pName}`));

		return getUsage([
			{
				content: 'Usage: ' + this.program.name + ' ' + this.name + ' ' + argHelp.join(' ')
			}
		]);
	}

	exampleHelp(flags, paramNames, vals) {
		let argHelp = flags.map(flag => `--${flag}=${vals[flag]}`);

		argHelp = argHelp.concat(paramNames.map(pName => `${vals[pName]}`));

		return getUsage([
			{
				content: 'Example: ' + this.program.name + ' ' + this.name + ' ' + argHelp.join(' ')
			}
		]);
	}
};

function getParamNames(func) {
	var fnStr = func.toString().replace(STRIP_COMMENTS, '');
	var result = fnStr.slice(fnStr.indexOf('(')+1, fnStr.indexOf(')')).match(ARGUMENT_NAMES);
	if(result === null)
		result = [];
	return result;
}