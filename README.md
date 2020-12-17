# hermes commandline utility

Enables performing hermes related tasks from the commandline.

## Installation
The hermes-cli is hosted on the hermes package server and shall be installed with npm globally:
```
sudo npm install -g git+ssh://git@github.com:hermesMobile/hermes-cli.git#3.0.10 --unsafe-perm
```

## Usage
hermes COMMAND [OPTIONS]

## Available commands:
The utility consists of several commands, for help type:

```
hermes COMMAND OPTION -h
```

To print the version, type:
```
hermes -v
```

In order to add more detailed logs, any command can be called with the --verbose flag

```
hermes deploy create ... --verbose
```

### config get
Usage: hermes config get `<configuration property or path>`

Prints the value of a config property. The specified property can be a
property or a dot-separated path

### config list
Usage: hermes config list

Prints all available configuration properties

### deploy create

Usage: hermes deploy create --band=$band

band indicates a deployment band, for instance: deploy, release and so on

The contents of the current folder, excluding git-related files and folders,
is compressed into and archive, the repository is tagged with the specified
version the archive is uploaded the the deployment bucket via the package
server.

The name of the deployment file will be the name of the current folder plus
the specified version, with the .zip file extension, for example project-dsm-
bid-integrator-web-1.0.6.zip.

Example

```
>cd ~/src/project-dsm-bid-integrator-web
>hermes deply create -v 1.0.6
Done uploading deployment project-dsm-bid-integrator-web-1.0.6.zip
```

### test deploy

Usage: hermes test deploy --band=$band --custom-deploy=false

- custom-deploy is only required when we have custom logic (like in the launchbase deployment). Send false in order to bypass the custom deployment
- If a custom deployment is called (like in launchbase), it could be that extra arguments need to be passed

### Promoting a deployment to development band

Usage: hermes deploy promote $deploymentInfo $serverTag
Example:
```
hermes deploy promote launchbase@5.1.123 p5
```

#### deploying on a pull request basis

By default, the hermes cli also creates a new package on a pull request basis. In order to not do this and only run the build + test phase of the job, simply pass the "--pr-skip-deploy" flag to the command. Note, this will only work in a CI environment when a pull request is detected

```
hermes test deploy --band=develop --pr-skip-deploy --verbose
```

### test e2e

- Performs an end to end test for the current project


Usage: hermes test e2e --config-path=$path-to-config-file --schema-path=$schema-path --reporting-dir=$path-to-reporting-dir --spec-dir=$spec-dir

--config-path - path to configuration file
--schema-path - path to config schema file
--reporting-dir - directory where test reports will be written
--spec-dir - directory where test specification are located

#### Config (minimum required)

For a full list of desired compatibilities, visit https://www.browserstack.com/automate/nightwatch#configure-capabilities

##### Browser stack
```
{
	"baseUrl": "https://integration-lbd5.hermes.com",
	"username": "XXXX", //integration test user
	"password": "XXXX", //integration test user password
	"userInteractionTimeout": 100, // timeout between calls in ms
	"browserStackUsername": "XXX", // browser stack username
	"browserStackKey": "XXX", // browser stack key
	"desiredCapabilities": [
		{
			"browser": "Chrome", // ["Chrome", "IE", "Edge", "Firefox", "Safari", "Opera"]
			"browser_version": "62.0", // browser version
			"os": "OS X", // ["Windows", "OS X"]
			"os_version": "Sierra" // visit https://www.browserstack.com/automate/nightwatch#configure-capabilities
		}
	]
}
```

#### Running on a selenium standalone (remote) server
```
{
	"baseUrl": "https://integration-lbd5.hermes.com",
	"username": "XXXX",
	"password": "XXXX",
	"userInteractionTimeout": 10,
	"selenium": {
		"host": "127.0.0.1",
		"port": 4444
	},
	"desiredCapabilities": [
		{
			"browser": "Chrome", // ["Chrome", "IE", "Edge", "Firefox", "Safari", "Opera"]
			"browser_version": "62.0", // browser version
		}
	]
}
```

#### Running locally with the default bundled in selenium server
```
{
	"baseUrl": "https://integration-lbd5.hermes.com",
	"username": "XXXX",
	"password": "XXXX",
	"userInteractionTimeout": 10,
	"selenium": {
		"host": "127.0.0.1",
		"port": 4444
	},
	"desiredCapabilities": [
		{
			"browser": "Chrome",
			"browser_version": "62.0",
			"os": "OS X",
			"os_version": "Mojave"
		}
	]
}
```

#### Running with

#### Extend client (nightwatch) commands
Client (nightwatch) commands can be extended (existing ones and also adding new ones)
In order to add/augment nightwatch commands, create a folder named "commands" in the same folder where your spec folder is located. Create one new file for each augmented/new command

A command sample which would augment "waitForElementPresent" would look like this. If an existing command is overriden, it can still be called by using "this.super".

```
module.exports = function (selector, timeout) {
	return this.super
		.waitForElementVisible(selector, timeout)
		.waitForElementNotVisible('[test-id="loader"]', timeout);
};
```

#### Running test with webdriver logs
In case of debugging a test, one can run the test with "--nw-verbose", this will ensure that nighwatch starts the seleniume webdriver in verbose mode

```
hermes test e2e --nw-verbose
```

#### Running a single test
```
hermes test e2e --verbose --only=${specName}
#hermes test e2e --verbose --only=loginSpec
```

folder structure
```
├── commands
│   └── waitForElementVisible.js
├── config-schema.json
├── config.json
├── reporting
│   └── index.html
├── spec
│   ├── createDeleteClient.js
│   └── doLogin.js
└── validate-config.js

```

### show version

Usage: hermes show version $deployment-name --band=$band

if band is not provided then versions across all bands will be checked

Example:
hermes show version launchbase #show highest version across all bands
hermes show version launchbase --band=release #show highest version for band=release

hermes show version launchbase@* #show all version of launchbase for all bands
hermes show version launchbase@* --band=release #show all version of launchbase for band=release

### install $deployment-name@$version

Install a deployment in the current working directory

- band is optional
- if no version is provided, latest version will be installed

Usage: hermes install $deployment-name@$version --band=$band


### show changelog (For CI only)

show latest CI changelog for a deployment

Usage: hermes ci changelog $deployment-name --band=$band

## Configuration

The configuration consists of the following:

### package

#### user

- username: string
- password: string

#### host

- protocol: string
- hostname: string
- port: integer

The default values can be seen using the command 'hermes config list'.

A configuration property can be overridden by adding a custom configuration file in the user's home folder:
```
 ~/.hermes-cli/config.json
```

Use the command 'hermes config list' and copy the part of the file to override by adding it to the custom configuration file. Only the properties specified will be overridden.

The properties 'url' and 'npmpackagebaseurl' are computed after the custom configuration file has been merged with the default one, and thus can't be overridden directly.
