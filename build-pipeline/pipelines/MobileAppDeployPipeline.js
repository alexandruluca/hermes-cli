const DeployPipeline = require('./DeployPipeline');
const {getPackageJSON, getPackageJSONLocation, getDeploymentName, getManifest} = require('../../utils/manifest');
const {normalizeVersion, saveCIChangelogInfo} = require('../../utils/deployment');
const packageServer = require('../../lib/deploy');
const logger = require('../../lib/logger');
const semver = require('semver');
const tempfile = require('tempfile');
const shell = require('shelljs');
const {execScript, requiredParam: rp} = require('../../utils');

class MobileAppDeployPipeline extends DeployPipeline {
	zipUpDeployment() {
		logger.info('skipping zipping up deploy for mobile app');
		return null;
	}
}

module.exports = MobileAppDeployPipeline;