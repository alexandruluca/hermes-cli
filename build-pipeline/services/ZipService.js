const BbPromise = require('bluebird');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fs = BbPromise.promisifyAll(require('fs'));
const childProcess = BbPromise.promisifyAll(require('child_process'));
const globby = require('globby');
const _ = require('lodash');

const excludeNodeDevDependenciesMemoized = _.memoize(excludeNodeDevDependencies);

class ZipService {
	/**
	 * @param {Object} opt
	 * @param {String[]=} opt.include
	 * @param {String[]=} opt.exclude
	 * @param {Object} opt.logger
	 * @param {String} opt.servicePath
	 */
	constructor({include, exclude, logger, servicePath}) {
		this.include = include || [];
		this.exclude = exclude || [];
		this.logger = logger || console;
		this.servicePath = servicePath;
	}

	async getExclusionGlob() {
		const params = await this.excludeDevDependencies({
			exclude: this.exclude,
			include: this.include
		});

		return params.exclude;
	}

	async excludeDevDependencies(params) {
		const servicePath = this.servicePath;

		let excludeDevDependencies = true;

		if (excludeDevDependencies) {
			this.logger.info('Excluding development dependencies...');

			const exAndInNode = await excludeNodeDevDependenciesMemoized(servicePath);
			params.exclude = _.union(params.exclude, exAndInNode.exclude); //eslint-disable-line
			params.include = _.union(params.include, exAndInNode.include); //eslint-disable-line
			return params;
		}

		return params;
	}

	getFileContentAndStat(filePath) {
		const fullPath = path.resolve(this.servicePath, filePath);

		return BbPromise.all([
			// Get file contents and stat in parallel
			this.getFileContent(fullPath),
			fs.statAsync(fullPath),
		]).then(
			result => ({
				data: result[0],
				stat: result[1],
				filePath,
			}),
			error => {
				throw new Error(`Cannot read file ${filePath} due to: ${error.message}`);
			}
		);
	}

	// Useful point of entry for e.g. transpilation plugins
	getFileContent(fullPath) {
		return fs.readFileAsync(fullPath);
	}

}

module.exports.ZipService = ZipService;

function excludeNodeDevDependencies(servicePath) {
	const exAndIn = {
		include: [],
		exclude: [],
	};

	// the files where we'll write the dependencies into
	const tmpDir = os.tmpdir();
	const randHash = crypto.randomBytes(8).toString('hex');
	const nodeDevDepFile = path.join(tmpDir, `node-dependencies-${randHash}-dev`);
	const nodeProdDepFile = path.join(tmpDir, `node-dependencies-${randHash}-prod`);

	try {
		const packageJsonFilePaths = globby.sync(
			[
				'**/package.json',
				// TODO add glob for node_modules filtering
			],
			{
				cwd: servicePath,
				dot: true,
				silent: true,
				follow: true,
				nosort: true,
			}
		);

		// filter out non node_modules file paths
		const packageJsonPaths = packageJsonFilePaths.filter(filePath => {
			const isNodeModulesDir = !!filePath.match(/node_modules/);
			return !isNodeModulesDir;
		});

		if (!packageJsonPaths.length) {
			return BbPromise.resolve(exAndIn);
		}

		// NOTE: using mapSeries here for a sequential computation (w/o race conditions)
		return (
			BbPromise.mapSeries(packageJsonPaths, packageJsonPath => {
				// the path where the package.json file lives
				const fullPath = path.join(servicePath, packageJsonPath);
				const dirWithPackageJson = fullPath.replace(path.join(path.sep, 'package.json'), '');

				// we added a catch which resolves so that npm commands with an exit code of 1
				// (e.g. if the package.json is invalid) won't crash the dev dependency exclusion process
				return BbPromise.map(['dev', 'prod'], env => {
					const depFile = env === 'dev' ? nodeDevDepFile : nodeProdDepFile;
					return childProcess
						.execAsync(
							`npm ls --${env}=true --parseable=true --long=false --silent --all >> ${depFile}`,
							{cwd: dirWithPackageJson}
						)
						.catch(() => BbPromise.resolve());
				});
			})
				// NOTE: using mapSeries here for a sequential computation (w/o race conditions)
				.then(() =>
					BbPromise.mapSeries(['dev', 'prod'], env => {
						const depFile = env === 'dev' ? nodeDevDepFile : nodeProdDepFile;
						return fs
							.readFileAsync(depFile)
							.then(fileContent => _.uniq(fileContent.toString('utf8').split('\n')).filter(Boolean))
							.catch(() => BbPromise.resolve());
					})
				)
				.then(devAndProDependencies => {
					const devDependencies = devAndProDependencies[0];
					const prodDependencies = devAndProDependencies[1];

					// NOTE: the order for _.difference is important
					const dependencies = _.difference(devDependencies, prodDependencies);
					const nodeModulesRegex = new RegExp(`${path.join('node_modules', path.sep)}.*`, 'g');

					if (dependencies.length) {
						return BbPromise.map(dependencies, item =>
							item.replace(path.join(servicePath, path.sep), '')
						)
							.filter(item => item.length > 0 && item.match(nodeModulesRegex))
							.reduce((globs, item) => {
								const packagePath = path.join(servicePath, item, 'package.json');
								return fs.readFileAsync(packagePath, 'utf-8').then(
									packageJsonFile => {
										const lastIndex = item.lastIndexOf(path.sep) + 1;
										const moduleName = item.substr(lastIndex);
										const modulePath = item.substr(0, lastIndex);

										const packageJson = JSON.parse(packageJsonFile);
										const bin = packageJson.bin;

										const baseGlobs = [path.join(item, '**')];

										// NOTE: pkg.bin can be object, string, or undefined
										if (typeof bin === 'object') {
											Object.keys(bin).forEach(executable => {
												baseGlobs.push(path.join(modulePath, '.bin', executable));
											});
											// only 1 executable with same name as lib
										} else if (typeof bin === 'string') {
											baseGlobs.push(path.join(modulePath, '.bin', moduleName));
										}

										return globs.concat(baseGlobs);
									},
									() => globs
								);
							}, [])
							.then(globs => {
								exAndIn.exclude = exAndIn.exclude.concat(globs);
								return exAndIn;
							});
					}

					return exAndIn;
				})
				.then(() => {
					// cleanup
					fs.unlinkSync(nodeDevDepFile);
					fs.unlinkSync(nodeProdDepFile);
					return exAndIn;
				})
				.catch(() => exAndIn)
		);
	} catch (e) {
		// fail silently
		return BbPromise.resolve(exAndIn);
	}
}