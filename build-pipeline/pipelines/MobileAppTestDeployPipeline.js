const TestDeployPipeline = require('./TestDeployPipeline');
const logger = require('../../lib/logger');

class MobileAppTestDeployPipeline extends TestDeployPipeline {
	async npmInstall() {
		logger.info('skipping npm install for mobile app');
	}
}

module.exports = MobileAppTestDeployPipeline;