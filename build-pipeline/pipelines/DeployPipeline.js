const {getPackageJSON, getManifest, getPackageJSONLocation} = require('../../utils/manifest');
const {normalizeVersion, saveCIChangelogInfo, getDeploymentMeta} = require('../../utils/deployment');
const {isPullRequest, getPullRequestMeta} = require('../../utils/ci');
const packageServer = require('../../lib/deploy');
const DeploymentService = require('../../services/deployments');
const logger = require('../../lib/logger');
const semver = require('semver');
const tempfile = require('tempfile');
const shell = require('shelljs');
const {execScript, requiredParam: rp} = require('../../utils');
const {DeploymentBand} = require('../../domain');
const archiver = require('archiver');
const fs = require('fs');
const BUMP_SEQUENCES = [
	'version', 'iosCfBundleId', 'androidVersionCode'
];

const path = require('path');
const {ZipService} = require('../services/ZipService');

class DeployPipeline {
	/**
	 * @param {Object} options
	 * @param {String} options.band
	 * @param {Boolean=} options.overrideExistingDeployment
	 */
	constructor(options = rp('options')) {
		this.band = options.band;
		this.manifest = getManifest();
		this.isHotfix = process.argv.indexOf('--hotfix') > -1;
		this.overrideExistingDeployment = options.overrideExistingDeployment

		if (this.band === DeploymentBand.QA && !isPullRequest) {
			throw new Error(`qa band deployments can only be created with pull requests`);
		}

		if (isPullRequest && this.band !== DeploymentBand.QA) {
			throw new Error(`pull requests can only be created with QA band`);
		}
	}

	run() {
		return this.runDeployment({manifest: this.manifest, band: this.band});
	}

	/**
	 *
	 * @param {Object} manifest
	 * @param {String} manifest.packageLocation
	 * @param {String[]} manifest.include
	 * @param {String[]} manifest.exclude
	 * @param {String[]} manifest.includeHiddenFilesAndFolders
	 * @param {String} band - indicates the deployment band
	 *
	 */
	async runDeployment({manifest, band}) {
		const isHotfix = this.isHotfix;

		//I'm not using yargs or ronin because this command is also called manually from somewhere else
		var serverTag = process.argv.filter(arg => {
			return arg.startsWith('--server-tag');
		}).map(arg => {
			return arg.split('=')[1];
		})[0];

		if (isHotfix && band !== 'release') {
			throw new Error('hotfix can only be made from release band, use --band');
		} else if (isHotfix && !serverTag) {
			throw new Error('hotfix requires a server-tag, use --server-tag');
		}

		if (!manifest.packageLocation.endsWith('package.json')) {
			manifest.packageLocation = path.join(manifest.packageLocation, 'package.json');
		}

		var packageLocation = path.join(process.cwd(), manifest.packageLocation);
		var tempZipPath = null;

		try {
			let packageJson = getPackageJSON();
			let version = normalizeVersion(packageJson.version, band);

			if (!version) {
				throw new Error(`package.json does not contain 'version'`);
			}

			var gitIgnoreFiles = [];

			try {
				gitIgnoreFiles = fs.readFileSync(path.join(process.cwd(), '.gitignore'), 'utf8').split(/\n/g);
				gitIgnoreFiles = gitIgnoreFiles.filter(fileName => {
					return !!fileName && !fileName.startsWith('#') && fileName !== 'node_modules' && fileName.indexOf('node_modules') === -1;
				});
			} catch (err) {
			}

			manifest.exclude = manifest.exclude.concat(gitIgnoreFiles);

			let rootPackageLocation = path.join(process.cwd(), 'package.json');

			let rootPackageJson = rootPackageLocation === packageLocation ? packageJson : require(rootPackageLocation);

			let projectName = rootPackageJson.name;

			let deploymentMeta = await getDeploymentMeta();

			for (let bumpedSequence in deploymentMeta) {
				if (!BUMP_SEQUENCES.includes(bumpedSequence)) {
					continue;
				}
				logger.info(`${bumpedSequence} was bumped to ${deploymentMeta[bumpedSequence]}`);
			}


			deploymentMeta.deploymentName = projectName;
			deploymentMeta.band = band;
			deploymentMeta.isHotfix = isHotfix;
			deploymentMeta.serverTag = serverTag;

			if (manifest.deployAsAwsLambdaFunction) {
				deploymentMeta.deployAsAwsLambdaFunction = true;
			}

			if (!isHotfix) {
				await packageServer.validateDeployment(deploymentMeta, {overrideExistingDeployment: this.overrideExistingDeployment});
			}

			tempZipPath = await this.zipUpDeployment(manifest, packageJson, projectName, version);
			let createDeployOptions = {
				sourcePath: tempZipPath,
				overrideExistingDeployment: this.overrideExistingDeployment
			};

			let {gitTag} = await DeploymentService.createDeployment(deploymentMeta, createDeployOptions);
			let {fullChangelog} = getChangelog({band});

			saveCIChangelogInfo(deploymentMeta, fullChangelog);
		} catch (e) {
			console.log(e);
			logger.error(`Could not create deployment: ${e.message}`);
			process.exit(1);
		} finally {
			try {
				if (tempZipPath && tempZipPath.length > 0) {
					shell.rm(tempZipPath)
				}
			} catch (e) {
				// no catch deleting temp file
			}
		}
	}

	async zipUpDeployment(manifest, packageJson, projectName, version) {
		// upload using package server
		let filename = projectName + '-' + version + '.zip';
		let tempZipPath = tempfile('.zip');

		let includePaths = manifest.include;
		let manifestExcludePaths = manifest.exclude;

		const createArchive = new Promise(async (resolve, reject) => {
			let outputStream = fs.createWriteStream(tempZipPath);
			let archive = archiver('zip', {
				zlib: {level: 9} // Sets the compression level.
			});

			outputStream.on('close', function () {
				console.log(archive.pointer() + ' total bytes');
				console.log('archiver has been finalized and the output file descriptor has closed.');
				resolve();
			});

			archive.on('error', err => {
				logger.error(`archiving failed with ${err.message}`);
				reject(err);
			});

			let includeAll = includePaths.length === 0;
			includePaths.push('package.json');
			includePaths.push('hermes.json');
			includePaths.push('configuration/**');
			includePaths.push('module.json');
			includePaths.push('Module.js');

			let inclusionGlob = includeAll ? '**' : `{${includePaths.join(',')}}`;

			let excludePaths = await new ZipService({
				exclude: manifestExcludePaths,
				logger,
				servicePath: path.dirname(getPackageJSONLocation())
			}).getExclusionGlob();

			// logger.info(`inclusion pattern used: ${inclusionGlob}`);
			// logger.info(`exclusion pattern used: ${excludePaths.join(',')}`);

			archive.glob(inclusionGlob, {
				ignore: excludePaths
			})

			archive.pipe(outputStream);

			logger.info(`archiving deploy for ${filename}`);

			archive.finalize();
		});

		await createArchive;

		return tempZipPath;
	}
}

function getChangelog({band = rp('band')} = {}) {
	let tags = execScript('git tag', {silent: true}).stdout.split('\n').filter(t => !!t);

	tags.sort(semverCmp(band));
	let lastTag = tags.reverse().filter(tag => tag.endsWith(band)).shift();

	let cmdArgs = '$(git rev-parse HEAD)';//last commit

	if (lastTag) {
		cmdArgs = `${lastTag}..${cmdArgs}`;
	}

	let formats = [
		"%s",
		"%h%x09%an%x09%ad%x09%s" //https://git-scm.com/docs/pretty-formats
	];

	let [cleanChangelog, fullChangelog] = formats.map(f => execScript(`git log --pretty=format:"${f}" ${cmdArgs}`, {silent: true}).stdout.split('\n'));

	return {
		cleanChangelog,
		fullChangelog
	};
}

/**
 * Determines whether a string represent a file or a folder
 * If the last index of "." is -1 or 0, it would indicate a folder. -1 Indicates no trailing extension.
 * 0 would indicate a hidden folder (starting with .)
 * @param filename
 * @return {boolean}
 */
function isDir(filename) {
	var dotIdx = filename.lastIndexOf('.');

	return [-1, 0].includes(dotIdx);
}

/**
 *
 * @param {('develop'|'test')} band
 * @return {function(*, *)}
 */
function semverCmp(band) {
	return (versionA, versionB) => {
		if (!versionA.endsWith(band)) {
			return -1
		}

		if (versionA.endsWith(band) && !versionB.endsWith(band)) {
			return 1;
		}

		versionA = semver.valid(semver.coerce(versionA).version);
		versionB = semver.valid(semver.coerce(versionB).version);

		if (semver.gt(versionA, versionB)) {
			return 1;
		}
		if (semver.gt(versionB, versionA)) {
			return -1
		}
		return 0;
	};
}

module.exports = DeployPipeline;