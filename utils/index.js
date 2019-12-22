const shell = require('shelljs');
const fs = require('fs');
const yargs = require('yargs');
const path = require('path');
const handlebars = require('handlebars');
const semver = require('semver');

exports.isExistingPath = isExistingPath;
exports.execScript = execScript;
exports.pollServerAvailability = pollServerAvailability;
exports.convertPathToAbsolutePath = convertPathToAbsolutePath;
exports.getArgs = getArgs;
exports.pathExists = pathExists;
exports.copyFile = copyFile;
exports.paramRequired = paramRequired;
exports.kebabCase = kebabCase;
exports.requiredParam = requiredParam;
exports.normalizeVersion = normalizeVersion;

function execScript(cmd, opt = {}) {
	opt.silent = opt.hasOwnProperty('silent') ? opt.silent : !global.verbose;

	if(opt.message) {
		console.log(opt.message);
	}

	var res = shell.exec(cmd, opt);

	if(res.code !== 0) {
		throw new Error(`exec failed for '${cmd}' with: ${res.stderr || res.stdout}`);
	}

	if(opt.silent && opt.message) {
		console.log(opt.message + ' - DONE');
	}

	return res;
}

function isExistingPath(path) {
	return new Promise((resolve, reject) => {
		fs.stat(path, (err, stat) => {
			resolve(!err);
		});
	});
}

function pollServerAvailability(url) {
	var timeout = 1000 * 60 * 5; //5 min;
	var http = url.startsWith('https') ? require('https') : require('http');

	return new Promise((resolve, reject) => {
		var timeoutId = setTimeout(() => {
			reject(new Error(`${url} did not respond after ${timeout} millis`));
		}, timeout);

		var intervalId = setInterval(() => {
			var req = http.get(url, (res) => {

				if(res.statusCode === 200) {
					clearInterval(intervalId);
					clearTimeout(timeoutId);
					return resolve();
				}

				req.end();
			}).on("error", (err) => {
			});
		}, 2000);
	});
}

function convertPathToAbsolutePath(relPath) {
	if(relPath.startsWith('/')) {
		return relPath;
	}

	return path.join(process.cwd(), relPath);
}

function getArgs(args) {
	if(!process.argv.__patched) {
		process.argv.unshift('node');
		process.argv.unshift(__dirname);
		process.argv.__patched = true;
		//fill interpreter and path so that yargs can pick all args up, ronin splices argv
	}

	var convertedArgs;
	var argList = [];

	for(var argName in args) {
		convertedArgs = yargs.option(argName, args[argName]);
	}

	if(convertedArgs) {
		convertedArgs = convertedArgs.argv;
	} else {
		convertedArgs = {};
	}

	for(var argName in args) {
		var {isPath} = args[argName];

		if(isPath) {
			convertedArgs[argName] = convertPathToAbsolutePath(convertedArgs[argName]);
		}

		argList.push(`--${argName}=${convertedArgs[argName]}`);
	}

	return convertedArgs;
}

function pathExists(filePath) {
	return new Promise(function (resolve, reject) {
		fs.stat(filePath, function (err) {
			resolve(!err);
		})
	})
}

function copyFile(src, dest, templateData) {
	if(!templateData || Object.keys(templateData).length === 0) {
		var stream = fs.createReadStream(src).pipe(fs.createWriteStream(dest));

		return new Promise((resolve, reject) => {
			stream.on('finish', resolve);
			stream.on('error', reject);
		});
	}

	return new Promise((resolve, reject) => {
		fs.readFile(src, (err, file) => {
			if(err) {
				return reject(err);
			}
			file = file.toString('utf8');
			file = handlebars.compile(file)(templateData);

			fs.writeFile(dest, file, (err) => {
				if(err) {
					return reject(err);
				}

				return resolve();
			});
		});
	});

}

function normalizeVersion(version, band) {
	if(!version) {
		throw new Error('missing version param');
	}
	if(!band) {
		throw new Error('missing band param');
	}

	version = semver.coerce(version);

	return `${version}-${band}`;
}

function paramRequired(param) {
	throw new Error(`param '${param}' is required`);
}

function kebabCase(string) {
	return string.replace(/([a-z])([A-Z])/g, "$1-$2")
		.replace(/\s+/g, '-')
		.toLowerCase();
}

function requiredParam(paramName) {
	throw new Error(`param ${paramName} is required`);
}