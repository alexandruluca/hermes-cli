const payloadFactory = require('./payload-factory');
const api = require('../lib/package-api').getInstance();
const {isPullRequest, getPullRequestMeta} = require('../utils/ci');
const {getDeploymentMeta} = require('../utils/deployment');
const logger = require('../lib/logger');
const s3Upload = require('../utils/s3');
const {execScript} = require('../utils');
const fs = require('fs');

exports.getDeploymentUploadUrl = getDeploymentUploadUrl;
exports.createDeployment = createDeployment;

async function getDeploymentUploadUrl(deploymentMeta) {
	deploymentMeta = deploymentMeta || await getDeploymentMeta();

	let payload = payloadFactory.getDeploymentUploadUrlPayload(deploymentMeta);

	return api.deployments.getDeploymentUploadUrl(payload);
}

/**
 *
 * @param {Object} deploymentMeta
 * @param {String} deploymentMeta.deploymentName
 * @param {String} deploymentMeta.band
 * @param {String} deploymentMeta.iosCfBundleId
 * @param {String} deploymentMeta.androidVersionCode
 * @param {Object=} deploymentMeta.pullRequestMeta
 * @param {String} deploymentMeta.version
 * @param {String[]} deploymentMeta.changelog
 * @param {Boolean} deploymentMeta.isHotfix
 * @param {String} deploymentMeta.serverTag
 * @param {Boolean=} deploymentMeta.deployAsAwsLambdaFunction
 * @param {Object} options
 * @param {String|null} options.sourcePath
 * @param {Boolean} options.overrideExistingDeployment
 */
async function createDeployment(deploymentMeta, {sourcePath, overrideExistingDeployment}) {
	let createDeploymentPayload = payloadFactory.getCreateDeploymentPayload(deploymentMeta);

	let gitTag = await api.deployments.getDeploymentTagName({deployment: createDeploymentPayload});

	try {
		try {
			execScript(`git tag ${gitTag} --delete && git push origin ${gitTag} --delete`, {silent: true});
		} catch (err) {
			// no op
		}
		execScript(`git tag ${gitTag} && git push origin ${gitTag}`, {silent: true});
	} catch (err) {
		throw new Error(`git tag and push failed for tag='${gitTag}'`);
	}

	// we send it as form-data
	let a = {
		name: deploymentMeta.deploymentName,
		deploymentFile: fs.createReadStream(sourcePath),
		band: deploymentMeta.band,
		version: deploymentMeta.version,
		serverTag: deploymentMeta.serverTag,
		pullRequestMeta: deploymentMeta.pullRequestMeta ? JSON.stringify(deploymentMeta.pullRequestMeta) : undefined,
		isHotfix: deploymentMeta.isHotfix ? 'true' : 'false',
		iosCfBundleId: deploymentMeta.iosCfBundleId,
		androidVersionCode: deploymentMeta.androidVersionCode,
		deployAsAwsLambdaFunction: deploymentMeta.deployAsAwsLambdaFunction ? 'true' : 'false',
		overrideExistingDeployment: overrideExistingDeployment
	};

	for (let prop in a) {
		if (a[prop] === undefined) {
			delete a[prop];
		}
	}

	return api.deployments.createDeployment(a);
}