const {isPullRequest} = require('../utils/ci');
const {isMobileAppBuild} = require('../utils/application-build');
const {getJsonPointerValue} = require('../utils/json');

const REQUIRED_PROPS = [
	'deploymentName', 'band', 'version'
];

const REQUIRED_PROPS_ON_PR = [
	'pullRequestMeta'
];

const REQUIRED_ON_MOBILE_BUILD = [
	'iosCfBundleId', 'androidVersionCode'
];

exports.getDeploymentUploadUrlPayload = getDeploymentUploadUrlPayload;
exports.getCreateDeploymentPayload = getCreateDeploymentPayload;

/**
 *
 * @param {Object} deployment
 * @param {String} deployment.deploymentName
 * @param {String} deployment.band
 * @param {String} deployment.version
 * @param {Boolean=} deployment.isHotfix
 * @param {String=} deployment.serverTag
 * @param {String=} deployment.iosCfBundleId
 * @param {String=} deployment.androidVersionCode
 * @param {Object=} deployment.pullRequestMeta
 */
function getDeploymentUploadUrlPayload(deployment) {
	validateDeployment(deployment);

	return selectProperties(deployment, {
		selects: [
			'deploymentName',
			'band',
			'version',
			'isHotfix',
			'serverTag',
		],
		transforms: {
			'pullRequestMeta.pullId': 'pullRequestId',
			'pullRequestMeta.issueNumber': 'issueNumber'
		}
	});
}

/**
 *
 * @param {Object} deployment
 * @param {String} deployment.deploymentName
 * @param {String} deployment.band
 * @param {String} deployment.version
 * @param {Boolean=} deployment.isHotfix
 * @param {String=} deployment.serverTag
 * @param {String=} deployment.iosCfBundleId
 * @param {String=} deployment.androidVersionCode
 * @param {Boolean=} deployment.deployAsAwsLambdaFunction
 */
function getCreateDeploymentPayload(deployment) {
	validateDeployment(deployment);

	return selectProperties(deployment, {
		transforms: {
			deploymentName: 'name'
		}
	});
}

/**
 *
 * @param {Object} deployment
 * @param {String} deployment.deploymentName
 * @param {String} deployment.band
 * @param {String} deployment.version
 * @param {String=} deployment.iosCfBundleId
 * @param {String=} deployment.androidVersionCode
 * @param {Object} deployment.pullRequestMeta
 */
function validateDeployment(deployment) {
	validateProperties(REQUIRED_PROPS, deployment);

	if (isPullRequest) {
		validateProperties(REQUIRED_PROPS_ON_PR, deployment);
	}

	if (isMobileAppBuild) {
		validateProperties(REQUIRED_ON_MOBILE_BUILD, deployment);
	}
}

function validateProperties(properties, deployment) {
	properties.forEach(prop => {
		if (!deployment.hasOwnProperty(prop)) {
			throw new Error(`deployment is missing required property "${prop}"`);
		}
	});
}

/**
 *
 * @param {Object} object
 * @param {String[]} properties
 */
function selectProperties(object, {selects = [], transforms = {}} = {}) {
	if (!selects.length && !Object.keys(transforms).length) {
		return JSON.parse(JSON.stringify(object));
	}

	if (!selects.length) {
		result = JSON.parse(JSON.stringify(object));
	} else {
		result = selects.reduce((result, prop) => {
			if (object.hasOwnProperty(prop) && typeof object[prop] !== 'undefined') {
				result[prop] = object[prop];
			}

			return result;
		}, {});
	}

	return Object.keys(transforms).reduce((result, fromProp) => {
		let toProp = transforms[fromProp];
		let val = getJsonPointerValue(object, fromProp);

		if (typeof val !== 'undefined') {
			result[toProp] = val;
		}
		delete result[fromProp];

		return result;
	}, result);
}