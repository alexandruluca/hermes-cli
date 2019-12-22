/**
  index.js - defines the ronin program that is the main module and entry point of the hermes-cli
*/
require('colors');
const ronin = require('ronin');
const getUsage = require('command-line-usage');
const version = require('../package.json').version;
const logger = require('../lib/logger');
const path = require('path');
const {acquireLock, cleanupAcquiredLocks} = require('../utils/deployment');


global.verbose = process.argv.indexOf('--verbose') > -1;

if(global.verbose) {
	logger.info('running in verbose mode');
}

if(process.argv && process.argv.length > 2)
{
  var thirdArgument = process.argv[2];
  if(thirdArgument === '-v' || thirdArgument === '--version'){
    console.log(version);
    return;
  }
}

/**
  Prepares the usage section for the command-line-usage pacakge.
*/
function getUsageSections(){
  return [
    {
      header: 'hermes commandline utility',
      content: 'Version ' + version
    },
    {
      content: 'Enables managing hermes related tasks from the commandline'
    },
    {
      content: 'The utility consists of several commands, for help type:'
    },
    {
      content: '>hermes COMMAND OPTION -h'
    },
    {
      content: 'To print the version, type:'
    },
    {
      content: '>hermes -v'
    }
  ];
}

var usage = getUsage(getUsageSections());

/**
  ronin point of entry
*/
var program = global.program = ronin({
  path: path.join(__dirname, '..'),
  desc: usage
});
const args = process.argv.slice(2);
const command = args[0];

const ignoreLockOnCommands = ['ci'];

let bandArg = process.argv.find(arg => arg.includes('--band'));
if(bandArg) {
	let band = bandArg.split('=')[1];
	if(!['develop', 'release', 'qa'].includes(band)) {
		logger.error(`band needs to be one of ['develop', 'release', 'qa]`);
		process.exit(1);
	}
}

process.on('unhandledRejection', err => {
	logger.error(err);
	cleanupAcquiredLocks();
	process.exit(1);
});

process.on('SIGINT', () => {
	cleanupAcquiredLocks();
	process.exit();
});

Promise.resolve().then(async () => {
	if(!ignoreLockOnCommands.includes(command)) {
		await acquireLock();
	}

	return program.run();
}).catch(err => {
	if(err.message === 'command is not a constructor') {
		logger.error('command not found');
	} else {
		logger.error(err);
	}

	cleanupAcquiredLocks();
	process.exit(1);
});

const Command = require('ronin/build/command');

const _buildArgs = Command.prototype._buildArgs;

Command.prototype._buildArgs = function () {
	let args = _buildArgs.apply(this, arguments);

	return args;
};