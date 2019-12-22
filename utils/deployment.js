const path = require('path');
const semver = require('semver');
const shell = require('shelljs');
const lockFile = require('lockfile');
const {execScript, paramRequired} = require('./index');
const {getPackageJSON, getPackageJSONLocation, getDeploymentName, getManifest, isMobileAppBuild} = require('./manifest');
const packageServer = require('../lib/deploy');
const logger = require('../lib/logger');
const {saveFile, readFile, DEPLOYMENT_LOCK_DIR} = require('../config');
const appBuildUtils = require('../utils/application-build');
const {isPullRequest, getPullRequestMeta} = require('../utils/ci');

let acquiredLocks = {};

exports.normalizeVersion = normalizeVersion;
exports.denormalizeVersion =  denormalizeVersion;
exports.doVersionBump = doVersionBump;
exports.pushChanges = pushChanges;
exports.acquireLock = acquireLock;
exports.cleanupAcquiredLocks = cleanupAcquiredLocks;
exports.getCustomDeploy = getCustomDeploy;
exports.saveCIChangelogInfo = saveCIChangelogInfo;
exports.getCIChangeLogInfo = getCIChangeLogInfo;
exports.getDeploymentMeta = getDeploymentMeta;

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

function denormalizeVersion(version) {
	return semver.valid(semver.coerce(version).version);
}

async function doVersionBump(band = paramRequired('band'), gitCommit = true) {
	checkDetachedHead();

	let packageJSON = getPackageJSON();
	let packageLocation = getPackageJSONLocation();
	let versionSeed = normalizeVersion(packageJSON.version, band);

	if(!versionSeed) {
		throw new Error('package.json does not contain a version');
	}

	let deploymentName = getDeploymentName();

	let {
		iosCfBundleId: iosCfBundleIdSeed,
		androidVersionCode: androidVersionCodeSeed
	} = await appBuildUtils.getVersionNumbers();

	let versionIncrementPayload = {
		deploymentName,
		band,
		versionSeed,
		iosCfBundleIdSeed,
		androidVersionCodeSeed,
	};

	if (isPullRequest) {
		versionIncrementPayload.pullRequestMeta = getPullRequestMeta();
	}

	let {version, iosCfBundleId, androidVersionCode} = await packageServer.getVersionIncrement(versionIncrementPayload);

	if (semver.lt(version, versionSeed)) {
		throw new Error(`can not bump to a version below ${versionSeed}`);
	}

	version = normalizeVersion(version, band);

	if(!gitCommit) {
		return {
			version
		};
	}

	let denormalizedVersion = denormalizeVersion(version);
	let commitNeeded = false;

	console.log('versionSeed', versionSeed);
	console.log('version', version);

	if(versionSeed !== version) {
		shell.pushd(path.dirname(packageLocation));

		execScript(`npm version ${denormalizedVersion} --no-git-tag-version --allow-same-version && git add package.json`);
		commitNeeded = true;

		shell.popd();
	}

	if(isMobileAppBuild && versionSeed !== version || iosCfBundleId !== iosCfBundleIdSeed || androidVersionCode !== androidVersionCodeSeed) {
		appBuildUtils.writeConfigXml({
			version: denormalizedVersion,
			'ios-CFBundleVersion': iosCfBundleId,
			'android-versionCode': androidVersionCode
		});
		execScript(`git add client/config.xml`);
		commitNeeded = true;
	}

	console.log('commit needed', commitNeeded);

	if (commitNeeded) {
		execScript(`git commit -m "[ci skip] - automatic version bump" --no-verify`);
	}

	console.log('increments')
	console.log(version,
		iosCfBundleIdSeed,
		androidVersionCode)


	return {
		version,
		iosCfBundleIdSeed,
		androidVersionCode
	};
}

async function getDeploymentMeta() {
	let packageJSON = getPackageJSON();
	let appVersionNumbers = await appBuildUtils.getVersionNumbers();

	let meta = {
		version: packageJSON.version,
		...appVersionNumbers
	};

	if(isPullRequest) {
		meta.pullRequestMeta = getPullRequestMeta();
	}

	return meta;
}

function pushChanges() {
	execScript(`git push --set-upstream origin ${getBranchName()} --no-verify`);
}

function getBranchName() {
	return execScript('git rev-parse --abbrev-ref HEAD', {silent: true}).stdout.trim();
}

function checkDetachedHead() {
	let branchName = getBranchName();

	if(branchName === 'HEAD') {
		throw new Error('branch is in a detached head, create a local branch to match your remote');
	}
}

async function acquireLock() {
	let isPackage = false;

	try {
		isPackage = !!require(path.join(process.cwd(), 'package.json'));
	} catch(err) {
	}

	if(!isPackage) {
		return;
	}

	const manifestTests = getManifest().test || [];
	const deploymentName = getDeploymentName();
	const dependencies = manifestTests.reduce((dependencies, test) => {
		if(test.dependencies && test.dependencies.length) {
			dependencies = dependencies.concat(test.dependencies.map(d => d.name));
		}
		return dependencies;
	}, [deploymentName]);

	var lockError;

	return Promise.all(dependencies.map(dependency => {
		logger.info(`trying to acquire lock for "${dependency}"`);
		return _acquireLock(dependency).then(() => {
			logger.info(`lock was acquired for "${dependency}"`);
		}).catch(err => {
			lockError = err;
		});
	})).then(() => {
		if(lockError) {
			throw lockError;//gives us the chance that all promises settle before throwing an error
		}
		logger.info(`global lock was aquired`.green);
	});
}

async function _acquireLock(lockName) {
	let lockPath = lockName.startsWith(DEPLOYMENT_LOCK_DIR) ? lockName : path.join(DEPLOYMENT_LOCK_DIR, lockName);

	return new Promise((resolve, reject) => {
		lockFile.lock(lockPath, (err) => {
			if(err) {
				return setTimeout(() => {
					_acquireLock(lockName).then(resolve);
				}, 100);
			}

			acquiredLocks[lockName] = true;
			resolve();

		});
	});
}

function cleanupAcquiredLocks() {
	for(let prop in acquiredLocks) {
		lockFile.unlockSync(prop);
		logger.info(`lock on "${prop}" was removed`);
	}

	acquiredLocks = {};
}

function getCustomDeploy(projectName) {
	let customDeployPath = path.join(__dirname, `../custom-deploys/${projectName}`);
	let CustomDeploy = null;

	try {
		CustomDeploy = require(customDeployPath);
	} catch (err) {
		return null;
	}
	return CustomDeploy;
}

/**
 *
 * @param {Object} deploymentMeta
 * @param {String} deploymentMeta.deploymentName
 * @param {String} deploymentMeta.band
 * @param {String} deploymentMeta.version
 * @param {Array} changelog
 */
function saveCIChangelogInfo(deploymentMeta, changelog) {
	let fileName = path.join('ci', 'changelog', `${deploymentMeta.deploymentName}-${deploymentMeta.band}`) + '.json';

	return saveFile(fileName, {changelog, deploymentMeta});
}

/**
 *
 * @param {String} deploymentName
 * @param {String} band
 */
function getCIChangeLogInfo(deploymentName, band) {
	let fileName = path.join('ci', 'changelog', `${deploymentName}-${band}`) + '.json';

	return readFile(fileName);
}