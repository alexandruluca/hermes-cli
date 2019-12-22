const ErrorCode = {
	DEPLOYMENT_NOT_FOUND: 'deployment_not_found'
};

class CliError extends Error {
	constructor(message) {
		super(message);
	}
}

exports.CliError = CliError;
exports.ErrorCode = ErrorCode;