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
	let createdDeploymentMeta = await _createDeployment(deploymentMeta, overrideExistingDeployment);

	if (sourcePath === null) {
		return createdDeploymentMeta;
	}

	let {gitTag, projectName} = createdDeploymentMeta;

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

	return api.deployments.uploadDeploymentFile({
		projectName,
		gitTag,
		deployment: fs.createReadStream(sourcePath)
	});

	//return uploadDeployment(gitTag, sourcePath);

	return getDeploymentUploadUrl(deploymentMeta).then(({uploadUrl}) => {
		return s3Upload.upload(sourcePath, uploadUrl).then(() => {
			logger.debug(`used upload url: ${uploadUrl}`);
			logger.info(`done upload for "${deploymentMeta.deploymentName}"`);
			return _createDeployment(deploymentMeta, overrideExistingDeployment);
		});
	});
}

/**
 * @param {Object} deployment
 * @param {String} deployment.deploymentName
 * @param {String} deployment.band
 * @param {String} deployment.version
 * @param {String[]} deployment.changelog
 * @param {Boolean} deployment.isHotfix
 * @param {String} deployment.serverTag
 * @param {Boolean=} deployment.deployAsAwsLambdaFunction
 * @param {Boolean=} overrideExistingDeployment
 *
 * @param {*} deployment
 */
function _createDeployment(deployment, overrideExistingDeployment ) {
	deployment = payloadFactory.getCreateDeploymentPayload(deployment);

	return api.deployments.createDeployment({deployment, overrideExistingDeployment}).catch(err => {
		throw err;
	})
}