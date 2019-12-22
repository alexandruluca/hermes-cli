const TestDeployPipeline = require('../pipelines/TestDeployPipeline');
const MobileAppTestDeployPipeline = require('../pipelines/MobileAppTestDeployPipeline');
const DeployPipeline = require('../pipelines/DeployPipeline');
const MobileAppDeployPipeline = require('../pipelines/MobileAppDeployPipeline');
const {isMobileApp} = require('../../utils/manifest');

class AbstractFactory {
    /**
	 * @param {Objects} options
	 * @param {String} options.band
	 * @param {Boolean=} options.dryRun
	 */
	static getTestDeployPipeline(options) {
		return TestDeployPipelineFactory.getInstance(options);
	}

    /**
	 * @param {Objects} options
	 * @param {String} options.band
	 */
	static getDeployPipeLine(options) {
		return DeployPipelineFactory.getInstance(options);
	}
}

class TestDeployPipelineFactory {
    /**
	 * @param {Objects} options
	 * @param {String} options.band
	 * @param {Boolean=} options.dryRun
	 */
	static getInstance(options) {
		options.deployPipeline = AbstractFactory.getDeployPipeLine(options);

		if(isMobileApp) {
			return new MobileAppTestDeployPipeline(options);
		}
		return new TestDeployPipeline(options);
	}
}

class DeployPipelineFactory {
    /**
	 * @param {Objects} options
	 * @param {String} options.band
	 */
	static getInstance(options) {
		if(isMobileApp) {
			return new MobileAppDeployPipeline(options);
		}
		return new DeployPipeline(options);
	}
}

module.exports = AbstractFactory;