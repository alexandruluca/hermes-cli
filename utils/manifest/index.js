const manifestSchema = require('./schema');
const Ajv = require('ajv');
const ajv = new Ajv();
const path = require('path');
const fs = require('fs');

const isMobileAppBuild = (function () {
	try {
		return fs.existsSync(path.join(process.cwd(), 'client/config.xml'))
	} catch (err) {
		return false;
	}
})();

const manifestDefaults = {
	packageLocation: "",
	include: [],
	exclude: [],
	includeHiddenFilesAndFolders: false,
	scripts: {}
};

exports.getManifest = getManifest;
exports.getPackageJSON = getPackageJSON;
exports.getPackageJSONLocation = getPackageJSONLocation;
exports.getDefaultManifest = getDefaultManifest;
exports.validateManifest = validateManifest;
exports.getDeploymentDetails = getDeploymentDetails;
exports.getDeploymentName = getDeploymentName;
exports.isMobileAppBuild = isMobileAppBuild;

function getDefaultManifest() {
	validateManifest(manifestDefaults);

	return manifestDefaults;
}

function validateManifest(manifest) {
	var valid = ajv.validate(manifestSchema, manifest);

	if(!valid) {
		throw new Error(ajv.errors.map(e => `'${e.dataPath}' ${e.message}`).join(', '));
	}
}

function getManifest(manifestLocation) {
	manifestLocation = manifestLocation || process.cwd();
	manifestLocation = path.join(manifestLocation, 'hermes-manifest.json');

	if(isMobileAppBuild) {
		console.log('using default manifest for mobile apps');
		return getDefaultManifest();
	}

	var manifest = JSON.parse(fs.readFileSync(manifestLocation));

	validateManifest(manifest);

	manifest = Object.assign(getDefaultManifest(), manifest);

	validateManifest(manifest);

	return manifest;
}


function getPackageJSON(manifestLocation) {
	manifestLocation = manifestLocation || process.cwd();

	var manifest = getManifest(manifestLocation);

	var packageLocation = path.join(manifestLocation, manifest.packageLocation);
	if(!packageLocation.endsWith('package.json')) {
		packageLocation = path.join(packageLocation, 'package.json');
	}

	return JSON.parse(fs.readFileSync(packageLocation));
}

function getPackageJSONLocation() {
	let manifest = getManifest();

	var packageLocation = path.join(process.cwd(), manifest.packageLocation);
	if(!packageLocation.endsWith('package.json')) {
		packageLocation = path.join(packageLocation, 'package.json');
	}

	return packageLocation;
}

function getDeploymentDetails(manifestLocation) {
	var packageJSON = getPackageJSON(manifestLocation);
	var rootPackageLocation = path.join(manifestLocation, 'package.json');

	var rootPackageJSON = JSON.parse(fs.readFileSync(rootPackageLocation));

	let deploymentDetails =  {
		name: rootPackageJSON.name,
		version: packageJSON.version,
	}

	if(rootPackageJSON.pullRequestMeta) {
		deploymentDetails.pullRequestMeta = rootPackageJSON.pullRequestMeta;
	}

	return deploymentDetails;
}

/**
 * Get deployment name. Note that we are using the root package.json in case we have multiple package.json files
 */
function getDeploymentName() {
	return require(path.join(process.cwd(), 'package.json')).name;
}