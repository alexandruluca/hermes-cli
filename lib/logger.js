require('colors')

module.exports = {
	info: createLogger('info'),
	debug: debug,
	error: createLogger('error'),
	warn: createLogger('warn'),
	verbose: {
		info: createLogger('info', true)
	}
};

function debug() {
	if(global.verbose) {
		console.log.apply(console, arguments);
	}
}

function createLogger(namespace, verboseOnly) {
	namespace = namespace.toUpperCase();

	let color = 'blue';

	if(namespace === 'ERROR') {
		color = 'red';
	} else if(namespace === 'warn') {
		color = 'yellow';
	}

	return function () {
		if(verboseOnly && !isVerboseEnabled()) {
			return;
		}
		let err;
		if(arguments[0] instanceof Error) {
			err = arguments[0];
			arguments[0] = err.message;
		}

		let args = Array.from(arguments);
		args.unshift(`[${namespace}]`[color]);
		console.log.apply(console, args);

		if(err && global.verbose) {
			console.log(err);
		}
	}
}

function isVerboseEnabled() {
	return global.verbose;
}