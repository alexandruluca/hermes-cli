const {DeploymentBand} = require('../../domain');
const api = require('../package-api').getInstance();
const request = require('request');
const progress = require('request-progress');
const fs = require('fs');
const path = require('path');
const {execScript, isExistingPath, normalizeVersion} = require('../../utils');
const logger = require('../logger');
const shell = require('shelljs');
const {isPullRequest, getPullRequestMeta} = require('../../utils/ci');
const errcode = require('err-code');
const tempfile = require('tempfile');

const ErrorCode = {
	VERSION_INSTALLED: 'version_installed',
	DEPLOYMENT_NOT_FOUND: 'deployment_not_found'
};

module.exports = {
	validateDeployment: validateDeployment,
	downloadDeployment: downloadDeployment,
	getDeploymentDownloadUrl: getDeploymentDownloadUrl,
	getDeployment: getDeployment,
	getDeploymentByIssueNumber: getDeploymentByIssueNumber,
	updateDeployment: updateDeployment,
	getDeploymentVersions: getDeploymentVersions,
	getLastDeployment: getLastDeployment,
	client: (queryString) => require('./client').connect(queryString),
	getVersionIncrement: getVersionIncrement,
	promoteDeployment: promoteDeployment,
	getProjectIssue: getProjectIssue
};

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
async function validateDeployment(deploymentMeta, {overrideExistingDeployment} = {overrideExistingDeployment: false}) {
	if(isPullRequest || deploymentMeta.band === DeploymentBand.RELEASE) {
		return;
	}

	try {
		let doc = await api.deployments.getDeployment(deploymentMeta);


		if(doc && !overrideExistingDeployment) {
			throw new Error(`deployment already exists: ${deploymentMeta.deploymentName}@${deploymentMeta.version} band=${deploymentMeta.band}`);
		}
	} catch(err) {
		if(err.statusCode !== 404) {
			throw err;
		}
	}
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
		if(err.statusCode === 404) {
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
async function downloadDeployment(deployment, {cwd, progress, unlinkIfExists} = {}) {
	cwd = cwd || process.cwd();

	let {deploymentName, version, band} = deployment;

	var {
		downloadUrl,
		fileName,
		version: serverVersion, band: serverBand
	} = await  getDeploymentDownloadUrl(deployment);

	if(serverVersion !== version) {
		throw new Error(`corrupt deployment, requested version=${version} but got version=${serverVersion}`);
	}

	if(serverBand !== band) {
		throw new Error(`corrupt deployment, requested band=${band} but got band=${serverBand}`);
	}

	version = normalizeVersion(version, band);

	let tmpPath = tempfile('.zip');

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
		await downloadDeploy(downloadUrl, tmpPath, progress);
		logger.debug(`expanding ${deploymentName} to ${expandPath} `);
		execScript(`unzip -o ${tmpPath} -d ${expandPath}`);

		console.log(`deployment was installed at path '${expandPath}'`);

		return {
			deploymentName,
			installationPath: expandPath
		}
	} catch(err) {
		throw err;
	} finally {
		try {
			shell.rm('-rf', tmpPath);
		} catch(err) {
			//no err handling when removing tmp
		}
	}
}

/**
 *
 * @param {String} downloadUrl
 * @param {String} destPath
 * @param {Object} progressOptions
 * @param {Object} progressOptions.func
 * @param {Object} progressOptions.opt
 * @param {Number=} progressOptions.opt.throttle
 */
function downloadDeploy(downloadUrl, destPath, progressOptions = {}) {
	return new Promise((resolve, reject) => {
		var req = progress(request(downloadUrl), progressOptions.opt);

		if(progressOptions && progressOptions.func) {
			req.on('progress', progressOptions.func);
		}

		req.on('response', function(res) {
			if(res.statusCode >= 200 && res.statusCode <= 300) {
				var writeStream = fs.createWriteStream(destPath);
				res.pipe(writeStream);

				writeStream.on('finish', function() {
					resolve();
				});

				writeStream.on('error', function(err) {
					reject(err);
				});
			} else {
				reject(new Error(`${res.statusCode}: download failed`));
			}
		});

		req.on('error', function (err) {
			console.log('reject');
			reject(err);
		})
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

	for(let prop in deploymentMeta) {
		if(typeof deploymentMeta[prop] === 'undefined') {
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
 * @param {Object} deploymentMeta
 * @param {String} deploymentMeta.deploymentName
 * @param {String} deploymentMeta.band
 * @param {String} deploymentMeta.version
 * @param {String?} deploymentMeta.deploymentId
 */
function getDeploymentDownloadUrl(deploymentMeta) {
	return api.deployments.getDeploymentDownloadUrl(deploymentMeta);
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

	if(getAllVersions) {
		deploymentName = deploymentName.substring(0, deploymentName.length - 2);
	}

	var query = {
		deploymentName,
		band,
		latest: !getAllVersions
	};

	Object.assign(query, options);

	return api.deployments.getDeploymentVersions(query).then(deployments => {
		if(!getAllVersions) {
			if(deployments.length === 0) {
				throw errcode(new Error(`no deployment found for '${deploymentName}'`), ErrorCode.DEPLOYMENT_NOT_FOUND);
			}

			var deployment = deployments[0];

			if(band && deployment.band !== band) {
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

	if(delimiterIdx > -1) {
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