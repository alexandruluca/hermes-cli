const {execScript, requiredParam: rp} = require('../../utils');
const {getDeploymentName, getManifest} = require('../../utils/manifest');
const {doVersionBump, getCustomDeploy, pushChanges} = require('../../utils/deployment');
const {isPullRequest, getPullRequestMeta} = require('../../utils/ci');
const packageServer = require('../../lib/deploy');
const logger = require('../../lib/logger');
const path = require('path');
const fs = require('fs');
const jsonDiff = require('deep-diff')
const {DeploymentBand} = require('../../domain');

const PullRequestStatus = {
	BEHIND: 'behind',
	PENDING_BUILD: 'pending-build',
	FAILING_BUILD: 'failing-build',
	BUILD_COMPLETE: 'build-complete'
};

class TestDeployPipeline {
	/**
	 * @param {String} band
	 * @param {Boolean=} dryRun
	 * @param {DeployPipeline} deployPipeline
	 */
	constructor({band = rp('band'), deployPipeline = rp('deployPipeline'),
		dryRun = false, skipDeployOnPullRequest = false, skipTest = false}) {
		if (band === DeploymentBand.QA && !isPullRequest) {
			throw new Error(`'qa' band only accepts pull requests`);
		}

		this.band = band;
		this.hermesManifest = getManifest();
		this.packageJsonLocation = path.join(process.cwd(), this.hermesManifest.packageLocation || 'package.json');
		this.rootPackageLocation = path.join(process.cwd(), 'package.json');
		this.isDryRun = dryRun;
		this.deployPipeline = deployPipeline;
		this.skipTest = skipTest;
		/**
		 * Deployment is skipped if pull request and band !== 'qa' band
		 */
		this.skipDeploy = isPullRequest && (skipDeployOnPullRequest || band !== DeploymentBand.QA);
		this.deploymentName = getDeploymentName();
		this.pullRequestMeta = null;
		this.pullRequestDeployment = null;
		this.isPullRequestBehindStatus = false;
		this.buildError = null;

		this.preValidatePipeline();
	}

	preValidatePipeline() {
		this.validatePackageJson(this.rootPackageLocation);

		if (this.rootPackageLocation !== this.packageJsonLocation) {
			this.validatePackageJson(this.packageJsonLocation);
		}
	}

	/**
	 * @param {String} packageLocation
	 * Validate package.json
	 */
	validatePackageJson(packageLocation) {
		logger.info(`validating package.json located at '${packageLocation}'`);
		let packageJson = fs.readFileSync(packageLocation, 'utf8');
		packageJson = packageJson.replace(/^\s+|\s+$/g, '')
		let expectedPackageJson = JSON.stringify(JSON.parse(packageJson), null, '\t');

		if (packageJson !== expectedPackageJson) {
			throw new Error(`package.json located at '${packageLocation}' does not have required indentation set to '\\t'`)
		}
	}

	async run() {
		if (isPullRequest) {
			let {sourceBranch} = getPullRequestMeta();

			if (sourceBranch.startsWith('dependabot/')) {
				this.isDryRun = true;
			}
		}

		try {
			let projectDir = process.cwd();
			let packageJSON = require(path.join(projectDir, 'package.json'));
			let projectName = packageJSON.name;

			let customDeployPath = path.join(__dirname, `../../custom-deploys/${projectName}`);
			let CustomDeploy = getCustomDeploy(projectName);
			let customDeploy = CustomDeploy ? new CustomDeploy() : null;

			await this.setPullRequestDeploymentMeta();

			if (isPullRequest) {
				this.skipDeploy = this.skipDeploy || this.isPullRequestBehindStatus;
			}

			execScript('git tag -l | xargs git tag -d && git fetch -t', {silent: true});

			await this.validateDeployment();

			var scripts = packageJSON.scripts || {};

			await this.runBuildSteps(scripts, customDeploy);
			if (CustomDeploy) {
				if (typeof CustomDeploy !== 'function') {
					throw new Error(`module.exports at path='${customDeployPath}' does not expose a constructor function`);
				}
				let deploy = new CustomDeploy();
				logger.info('using custom deploy');
				await deploy.run();
			}

			if (this.hermesManifest.bowerLocation) {
				var bowerJSONFolder = path.join(process.cwd(), this.hermesManifest.bowerLocation);
				execScript(`npx bower install`, {message: 'bower install', cwd: bowerJSONFolder});
			}

			await this.runTests(scripts, customDeploy);

			await this.createDeploy();
		} catch (err) {
			this.buildError = err;
			throw err;
		} finally {
			await this.finalize();
		}
	}

	async createDeploy() {
		if (this.skipDeploy) {
			if (this.isPullRequestBehindStatus) {
				logger.info(`skipping deployment state to pull request behind deployed, mergeable-state='behind'`)
			} else {
				logger.info(`pull request + 'pr-skip-deploy  detected, skipping deployment stage`);
			}

			return;
		}

		if (this.isDryRun) {
			return;
		}

		await this.deployPipeline.run();
		await this.getAndSetPullRequestDeployment();

		if (isPullRequest) {
			return;
		}

		pushChanges();
	}

	async finalize() {
		if (this.isDryRun) {
			return;
		}

		if (isPullRequest) {
			let pullRequestStatus = this.buildError ? PullRequestStatus.FAILING_BUILD : PullRequestStatus.BUILD_COMPLETE;
			logger.info(`setting pull-request status to '${pullRequestStatus}'`);

			if (this.buildError && !this.pullRequestDeployment) {
				logger.info(`skip updating deployment status, no pull-request deployment was created`);
				return;
			}

			await packageServer.updateDeployment(this.pullRequestDeployment.id, {pullRequestStatus});
		}
	}

	async validateDeployment() {
		const band = this.band;
		if (this.isDryRun) {
			return;
		}

		let projectIssue = await this.checkoutBranch();

		if (isPullRequest) {
			let rootPackageLocation = this.rootPackageLocation;
			let prMeta = getPullRequestMeta();
			let packageJSON = fs.readFileSync(rootPackageLocation, 'utf8');
			packageJSON = JSON.parse(packageJSON);

			let prMetaDiff = jsonDiff(prMeta, packageJSON.pullRequestMeta || {});
			if (prMetaDiff) {
				let version = packageJSON.version;
				packageJSON.buildVersion = `${version}-${prMeta.pullId}/${prMeta.issueNumber}`;
				packageJSON.pullRequestMeta = prMeta;
				packageJSON.pullRequestMeta.issueLink = projectIssue.link;

				fs.writeFileSync(rootPackageLocation, JSON.stringify(packageJSON, null, '\t'));
			}

			return;
		}

		let doGitCommit = !this.skipDeploy;

		let versionIncrements = await doVersionBump(band, doGitCommit);
		logger.info('increments', JSON.stringify(versionIncrements));
		logger.info(`project was bumped to version '${versionIncrements.version}'`);

		let deploymentName = this.deploymentName;

		let deploymentMeta = {
			deploymentName,
			band,
			...versionIncrements
		};

		await packageServer.validateDeployment(deploymentMeta);
	}

	async setPullRequestDeploymentMeta() {
		if (!isPullRequest) {
			return;
		}

		this.pullRequestMeta = getPullRequestMeta();
		let deployment = await this.getAndSetPullRequestDeployment();

		if (!deployment) {
			return;
		}

		let initialPullRequestStatus = deployment.pullRequestMeta && deployment.pullRequestMeta.status;
		this.isPullRequestBehindStatus = initialPullRequestStatus === PullRequestStatus.BEHIND;

		let pullRequestStatus = PullRequestStatus.PENDING_BUILD;

		logger.info(`setting pull-request status to '${pullRequestStatus}'`);

		await packageServer.updateDeployment(deployment.id, {pullRequestStatus});
	}

	async getAndSetPullRequestDeployment() {
		if (!isPullRequest || this.pullRequestDeployment) {
			return this.pullRequestDeployment;
		}

		let issueNumber = this.pullRequestMeta.issueNumber;

		this.pullRequestDeployment = await packageServer.getDeploymentByIssueNumber(this.deploymentName, issueNumber);

		if (!this.pullRequestDeployment) {
			logger.info(`no existing deployment found for task key='${issueNumber}'`);
		}

		return this.pullRequestDeployment;
	}

	/**
	 * Checks out the current branch. Returns jira task information if identified
	 */
	async checkoutBranch() {
		let branchName = this.band;
		let projectIssue;

		if (isPullRequest) {
			let {sourceBranch, issueNumber} = this.pullRequestMeta;

			if (!['release', 'develop'].includes(issueNumber)) {
				projectIssue = await packageServer.getProjectIssue(this.deploymentName, issueNumber);

				if (!projectIssue) {
					throw new Error(`'${issueNumber}' is not a valid project issue`);
				}
			}

			branchName = sourceBranch;
		}

		logger.info(`checking out branch '${branchName}'`);

		execScript(`git checkout ${branchName} && git reset --hard origin/${branchName}`);

		logger.info(`'${branchName}' was successfully checked out`);

		return projectIssue;
	}

	/**
	 *
	 * @param {Object} scripts
	 * @param {TestDeploy} customDeploy
	 * @return {Promise<*>}
	 */
	async runBuildSteps(scripts, customDeploy) {
		if (scripts.setup) {
			execScript('npm run setup', {message: 'setting up project: npm run setup'});
		} else {
			this.npmInstall();
		}

		let buildScriptName = this.band === DeploymentBand.QA ? `ci-build-develop` : `ci-build-${this.band}`;
		let runnableScript;
		if (scripts[buildScriptName]) {
			runnableScript = buildScriptName;
		} else if (scripts['ci-build']) {
			runnableScript = 'ci-build';
		} else if (scripts.build) {
			runnableScript = 'build';
		}

		if (runnableScript) {
			execScript(`npm run ${runnableScript}`, {message: 'building the app'});
		}
	}

	npmInstall() {
		let packageJSONFolder = path.dirname(this.packageJsonLocation);
		logger.info(`npm install --no-save`);
		execScript('rm -rf package-lock.json');
		execScript('rm -rf node_modules');
		execScript('npm install --no-save', {silent: true, cwd: packageJSONFolder, message: 'npm install'});
	}

	/**
	 *
	 * @param {Object} scripts
	 * @param {TestDeploy} customDeploy
	 * @return {Promise<*>}
	 */
	async runTests(scripts, customDeploy) {
		let hermesManifest = this.hermesManifest;

		if (this.skipTest) {
			logger.info(`'skip-test' flag is set to 'true', skipping tests`);
			return;
		}
		var argList = process.argv.join(' ');

		if (customDeploy) {
			argList += ' ' + customDeploy.getTestArgList();
		}

		if (scripts.test) {
			execScript(`npm test ${argList}`);
		}

		if (Array.isArray(hermesManifest.test)) {
			let testSuites = hermesManifest.test.map(({strategy, cwd, dependencies}) => {
				let TestCmd = require(`../../commands/test/${strategy}`);
				let defaultConfig = customDeploy ? customDeploy.getConfig() : {};
				let testConfig = Object.assign(defaultConfig, {dependencies});

				testConfig.cwd = cwd;

				return new TestCmd().runCommand(testConfig);
			});

			return Promise.all(testSuites);
		}
	}

}

module.exports = TestDeployPipeline;