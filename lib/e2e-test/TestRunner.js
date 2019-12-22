const path = require('path');
const nightwatch = require('nightwatch');
const TestSuite = require('nightwatch/lib/runner/testsuite');
const _print = TestSuite.prototype.print;
const globby = require('globby');

const PLATFORM = {
	WINDOWS: 'windows',
	LINUX: 'linux',
	DARWIN: 'darwin'
};

//patch it so that we get more details about what env is running
TestSuite.prototype.print = function () {
	let propsToSkip = [
		'browserstack.user', 'browserstack.key', 'name'
	];
	var settings = this.options.desiredCapabilities;
	let suiteName = Object.keys(settings).reduce((suiteName, key) => {
		if(!propsToSkip.includes(key)) {
			suiteName += settings[key] + '/';
		}
		return suiteName;
	}, "");
	this.suiteName += `: ${suiteName}`;

	return _print.apply(this, arguments);
};

let argv = require('yargs')
	.option('only', {
		alias: 'o',
	})
	.argv;

class TestRunner {
	/**
	 * @param {Object} options
	 * @param {String} options.project
	 * @param {String} options.platform
	 * @param {String} options.configPath
	 * @param {String} options.specDir
	 */
    run(options) {
        return new Promise((resolve, reject) => {
			let config = require(options.configPath);

			options.verbose = process.argv.indexOf('--nw-verbose') > -1;

			if(config.browserStackUsername && !config.browserStackKey) {
				throw new Error(`missing 'browserStackKey'`);
			} else if(config.browserStackKey && !config.browserStackUsername) {
				throw new Error(`missing 'browserStackUsername'`);
			}

			let useBrowserStack = config.browserStackKey && config.browserStackUsername;

			if(config.selenium) {
				console.log('initializing remote selenium session');
				options.config = path.join(__dirname, 'nightwatch-conf', 'remote');
			} else if(useBrowserStack) {
				console.log('initializing browser-stack selenium session');
				options.config = path.join(__dirname, 'nightwatch-conf', 'browserstack');
          	} else {
				console.log('initializing default selenium session');
				options.config = path.join(__dirname, 'nightwatch-conf');
          	}

			options.reporter = path.join(__dirname, './reporter');

			if (!argv.only) {
				options.filter = "**/*Spec.js";
			}

            const done = (err) => {
				invalidateTestCache([
					path.join(__dirname, 'nightwatch*/*'),
					options.configPath,
					options.specDir

				]).then(() => {
					if(err) {
						throw err;
					}
				}).then(resolve).catch(reject);

			};

			if (argv.only) {
				if (!argv.only.endsWith('.js')) {
					argv.only += '.js';
				}
				let spec = argv.only;
				if(!spec.startsWith(options.specDir)) {
					spec = path.join(options.specDir, argv.only);
				}
				options.test = spec;
			}

            try {
				nightwatch.runner(options, (result) => {
					done(result === true ? null : new Error('test suite failed'));
				});
            } catch(err) {
                reject(err);
            }
        });
    }
}

function invalidateTestCache(foldersToInvalidate) {
	return globby(foldersToInvalidate, {cwd: process.cwd()}).then(files => {
		files.forEach(filePath => {
			if(filePath.endsWith('/reporter')) {
				return true;
			}
			delete require.cache[require.resolve(filePath)];
		})
	})
}

module.exports.TestRunner = TestRunner;
module.exports.PLATFORM = PLATFORM;