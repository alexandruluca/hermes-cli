const path = require('path');
const fs = require('fs');
const PAUSE_TIMEOUT = 100;//timeout between actions in millis

module.exports = function ({specDir, userInteractionTimeout = PAUSE_TIMEOUT}) {
	const testDir = path.dirname(specDir);
	const commandsDir = path.join(testDir, 'commands');
	const suiteDir = path.join(testDir, 'suites');

	let commands = {};

	const suiteCommands = {};

	function addCommands(commandsDir) {
		try {
			let files = fs.readdirSync(commandsDir);
			files.forEach(fileName => {
				let filePath = path.join(commandsDir, fileName);
				let stats = fs.statSync(filePath);

				if(stats.isDirectory()) {
					addCommands(filePath);
					return;
				}

				let cmdName = fileName.substring(0, fileName.lastIndexOf('.'));
				commands[cmdName] = require(filePath);
			});
		} catch(err) {
			if(err.code !== 'ENOENT') {
				throw err;
			}
			//commands dir does not exist, no operation
		}
	}

	addCommands(commandsDir);

	try {
		let files = fs.readdirSync(suiteDir);
		files.forEach(fileName => {
			let suite = fileName.substring(0, fileName.lastIndexOf('.'));
			suiteCommands[suite] = require(path.join(suiteDir, fileName));
		});
	} catch(err) {
		console.log(err);
		if(err.code !== 'ENOENT') {
			throw err;
		}
		// suites dir does not exist
	}

	return {
		waitForConditionTimeout: 5000, // sometimes internet is slow so wait.
		beforeEach: function (client, done) {
			if(!client.customClick) {
				client.customClick = client.click;
			}

			if(!client.__patched) {
				for(let suiteName in suiteCommands) {
					let fn = suiteCommands[suiteName];
					client[suiteName] = function() {
						return fn.apply(client);
					};
				}
				const waitForElementVisible = client.waitForElementVisible;
				const url = client.url;

				client.waitForElementVisible = function () {
					this.pause(userInteractionTimeout);
					return waitForElementVisible.apply(this, arguments);
				};

				client.url = function () {
					this.pause(userInteractionTimeout);
					return url.apply(this, arguments);
				};

				client.__patched = true;

				extendCommands(client, commands);
			}

			done();
		},
		afterEach: function (client, done) {
			client.end(function() {
				done();
			});
		}
	};
};

/**
 *
 * @param {NightwatchAPI} client
 * @param {Object} commands
 */
function extendCommands(client, commands) {
	let _super = {};

	for(let commandName in commands) {
		var existingCommand = client[commandName];

		if(existingCommand) {
			_super[commandName] = existingCommand.bind(client);
		}

		client[commandName] = commands[commandName].bind(client);
	}

	client.super = _super;
}

