const {DeploymentBand} = require('../../domain');
const api = require('../package-api').getInstance();
const request = require('request');
const fs = require('fs');
const path = require('path');
const {execScript, isExistingPath, normalizeVersion} = require('../../utils');
const logger = require('../logger');
const shell = require('shelljs');
const {isPullRequest, getPullRequestMeta} = require('../../utils/ci');
const errcode = require('err-code');
const tempfile = require('tempfile');
const config = require('../../config');
const progress = require('progress-stream');

const ErrorCode = {
	VERSION_INSTALLED: 'version_installed',
	DEPLOYMENT_NOT_FOUND: 'deployment_not_found'
};

module.exports = {
	validateDeployment: validateDeployment,
	canCreateDeployment: canCreateDeployment,
	downloadDeployment: downloadDeployment,
	getDeployment: getDeployment,
	getDeploymentByIssueNumber: getDeploymentByIssueNumber,
	updateDeployment: updateDeployment,
	getDeploymentVersions: getDeploymentVersions,
	getLastDeployment: getLastDeployment,
	client: (queryString) => require('./client').connect(queryString),
	getVersionIncrement: getVersionIncrement,
	promoteDeployment: promoteDeployment,
	getProjectIssue: getProjectIssue,
	emitMessage: emitMessage,
	isExistingProject: isExistingProject,
	getProjectConfiguration: getProjectConfiguration
};

async function validateDeployment({deploymentName, version, band}) {
	let {canCreate, message} = await canCreateDeployment({deploymentName, version, band});

	if (!canCreate) {
		throw new Error(message);
	}
}

/**
 *
 * @param {Object} deploymentMeta
 * @param {String} deploymentMeta.deploymentName
 * @param {String} deploymentMeta.band
 * @param {String} deploymentMeta.version
 * @param {String=} deploymentMeta.iosCfBundleId
 * @param {String=} deploymentMeta.androidVersionCode
 * @param {Object} options
 * @param {Boolean} options.overrideExistingDeployment
 */
async function validateDeployment_old(deploymentMeta, {overrideExistingDeployment} = {overrideExistingDeployment: false}) {
	if (isPullRequest) {
		return;
	}

	try {
		let doc = await api.deployments.getDeployment(deploymentMeta);


		if (doc && !overrideExistingDeployment) {
			throw new Error(`deployment already exists: ${deploymentMeta.deploymentName}@${deploymentMeta.version} band=${deploymentMeta.band}`);
		}
	} catch (err) {
		if (err.statusCode !== 404) {
			throw err;
		}
	}
}

/**
 * @param {Object} deployment
 * @param {String} deployment.deploymentName
 * @param {String} deployment.version
 * @param {String} deployment.band
 */
async function canCreateDeployment({deploymentName, version, band}) {
	return api.deployments.canCreateDeployment({
		name: deploymentName,
		version,
		band
	});
}

function getProjectIssue(projectName, issueNumber) {
	return api.jira.getProjectIssue({
		projectName,
		issueNumber
	})
}

/**
 *
 * @param {Object} deploymentMeta
 * @param {String} deploymentMeta.deploymentName
 * @param {String} deploymentMeta.band
 * @param {String} deploymentMeta.version
 */
function getDeployment(deploymentMeta) {
	return api.deployments.getDeployment(deploymentMeta).catch(err => {
		if (err.statusCode === 404) {
			err.message = `deployment not found for ${deploymentMeta.deploymentName}@${deploymentMeta.version}`;
			throw err;
		}
		throw err;
	});
}

/**
 *
 * @param {String} deploymentId
 * @param {Object} deployment
 */
function updateDeployment(deploymentId, deployment) {
	return api.deployments.updateDeployment({
		deploymentId,
		deployment
	})
}

/**
 *
 * @param {String} deploymentName
 * @param {String} taskKey
 * @returns {Promise<Deployment|null>}
 */
async function getDeploymentByIssueNumber(deploymentName, issueNumber) {
	try {

		let deployment = await api.deployments.getDeploymentByIssueNumber({
			deploymentName,
			issueNumber
		});
		return deployment;
	} catch (err) {
		if (err.statusCode !== 404) {
			throw err;
		}
		return null;
	}
}

/**
 *
 * @param {Object} deployment
 * @param {String} deployment.deploymentName
 * @param {String} deployment.band
 * @param {String} deployment.version
 * @param {String?} deployment.deploymentId
 * @param {Object} downloadOpt
 */
async function downloadDeployment(deployment, {cwd, unlinkIfExists} = {}) {
	cwd = cwd || process.cwd();

	let {deploymentName, version, band} = deployment;

	let tmpPath = await downloadDeploymentFile(deployment);
	let fileName = await api.deployments.getDeploymentName(deployment);
	version = normalizeVersion(version, band);


	var expandPath = path.join(cwd, fileName);

	var pathExists = await isExistingPath(expandPath);

	if (pathExists) {
		if (unlinkIfExists) {
			logger.info(`unlinking ${expandPath}`);
			shell.rm('-rf', expandPath);
		} else {
			let errDetails = {
				deploymentName, installationPath: expandPath
			};
			throw errcode(new Error(`${fileName} already installed in ${expandPath}`), ErrorCode.VERSION_INSTALLED, errDetails);
		}
	}

	logger.info(`downloading ${deploymentName}@${version} band@${band}`);

	try {
		logger.debug(`expanding ${deploymentName} to ${expandPath} `);
		execScript(`unzip -o ${tmpPath} -d ${expandPath}`);

		console.log(`deployment was installed at path '${expandPath}'`);
		console.log(`unlinking ${tmpPath}`);
		execScript(`rm -rf ${tmpPath}`);

		return {
			deploymentName,
			installationPath: expandPath
		}
	} catch (err) {
		throw err;
	} finally {
		try {
			shell.rm('-rf', tmpPath);
		} catch (err) {
			//no err handling when removing tmp
		}
	}
}

function emitMessage({title, body, type, subTitle}) {
	return api.communication.emitMessage({
		message: {
			title,
			body,
			type,
			subTitle
		}
	});
}

/**
 *
 * @param {Object} deployment
 * @param {String} deployment.deploymentName
 * @param {String} deployment.band
 * @param {String} deployment.version
 * @param {String?} deployment.deploymentId
 */
async function downloadDeploymentFile(deployment) {
	let {deploymentName, band, version, deploymentId} = deployment;
	let tmpPath = tempfile('.zip');

	console.log('downloading to', tmpPath);

	let uri = `${config.package.apiUrl}/deployments/${deploymentName}/download?`;
	uri += `version=${version}&band=${band}`;

	if (deploymentId) {
		uri += `&deploymentId=${deploymentId}`;
	}

	let auth = Buffer.from(config.package.user.username + ':' + config.package.user.password).toString('base64');

	console.log('uri', uri);
	console.log('Basic ' + auth);

	return new Promise((resolve, reject) => {
		const str = progress({time: 100});

		str.on('progress', function (progress) {
			logger.info(`Download stat: ${JSON.stringify(progress)}`);
		});

		let req = request({
			uri,
			method: 'GET',
			headers: {
				Authorization: 'Basic ' + auth,
				'Content-Type': 'application/json'
			}
		})
			.on('response', function (res) {
				if (res.statusCode === 200) {
					req
						.pipe(str)
						.pipe(fs.createWriteStream(tmpPath))
						.on('close', () => {
							logger.info(`finished downloading ${deploymentName} under ${tmpPath}`);
							resolve(tmpPath);
						});
				} else {
					reject(new Error(`download failed with ${res.statusCode}`));
				}
			})
			.on('error', (err) => {
				logger.error('Download failed with', err);
				reject(err);
			});
	});
}

/**
 *
 * @param {Object} deploymentMeta
 * @param {String} deploymentMeta.deploymentName
 * @param {String} deploymentMeta.version
 * @param {String} deploymentMeta.band
 */
function createDeployment(deploymentMeta) {
	deploymentMeta.name = deploymentMeta.deploymentName;
	delete deploymentMeta.deploymentName;

	for (let prop in deploymentMeta) {
		if (typeof deploymentMeta[prop] === 'undefined') {
			delete deploymentMeta[prop];
		}
	}

	if (isPullRequest) {
		deploymentMeta.pullRequestMeta = getPullRequestMeta();
	}

	return api.deployments.createDeployment({deployment: deploymentMeta}).catch(err => {
		console.log(err);
		throw err;
	})
}

/**
 *
 * @param {String} deploymentName
 * @param {String} band
 * @param {Object=} options
 * @param {String=} options.serverTag
 * @param {Boolean=} options.usePullRequestDeployments
 */
async function getDeploymentVersions(deploymentName, band, options = {}) {
	const allowedBands = [
		DeploymentBand.DEVELOP, DeploymentBand.PRODUCTION, DeploymentBand.RELEASE
	];

	if (!allowedBands.includes(band)) {
		throw new Error(`'${band}' is not an allowed band`);
	}
	var getAllVersions = deploymentName.endsWith('@*');

	if (getAllVersions) {
		deploymentName = deploymentName.substring(0, deploymentName.length - 2);
	}

	var query = {
		deploymentName,
		band,
		latest: !getAllVersions
	};

	Object.assign(query, options);

	return api.deployments.getDeploymentVersions(query).then(deployments => {
		if (!getAllVersions) {
			if (deployments.length === 0) {
				throw errcode(new Error(`no deployment found for '${deploymentName}'`), ErrorCode.DEPLOYMENT_NOT_FOUND);
			}

			var deployment = deployments[0];

			if (band && deployment.band !== band) {
				throw new Error(`expected deployment for band '${band}' but received for band='${deployment.band}'`);
			}
		}

		return deployments;
	});
}

/**
 *
 * @param {String} deploymentName
 * @param {String} band
 * @param {Object=} options
 * @param {String=} options.serverTag
 * @param {Boolean=} options.usePullRequestDeployments
 */
function getLastDeployment(deploymentName, band, options) {
	var delimiterIdx = deploymentName.indexOf('@');

	if (delimiterIdx > -1) {
		deploymentName = deploymentName.substring(0, delimiterIdx);
	}

	return getDeploymentVersions(deploymentName, band, options).then(versions => {
		return versions[0];
	});
}

/**
 * @param {Object} options
 * @param {String} options.deploymentName
 * @param {String} options.band
 * @param {String} options.versionSeed
 * @param {String=} options.iosCfBundleIdSeed
 * @param {String=} options.androidVersionCodeSeed
 * @param {Object} options.pullRequestMeta
 * @return {Promise<*>}
 */
async function getVersionIncrement(options) {
	let {deploymentName, band, ...payload} = options;

	return api.deployments.getVersionIncrement({
		deploymentName,
		band,
		payload
	});
}

/**
 *
 * @param {Object} deploymentMeta
 * @param {String} deploymentMeta.deploymentName
 * @param {String} deploymentMeta.version
 * @param {String} deploymentMeta.serverTag
 */
function promoteDeployment(deploymentInfo) {
	return api.deployments.promoteDeployment(deploymentInfo);
}

function isExistingProject(projectName) {
	return api.project.isExistingProject({projectName}).then(() => true).catch(err => false);
}

function getProjectConfiguration(serverTag, projectName) {
	return api.project.getProjectConfiguration({
		serverTag,
		projectName
	});
}