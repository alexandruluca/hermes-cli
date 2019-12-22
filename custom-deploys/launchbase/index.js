const {execScript, pollServerAvailability} = require('../../utils');
const path = require('path');
const TestDeploy = require('../../lib/deploy/TestDeploy');
const {INIT_DATABASE_SCRIPT} = require('../../commands/scripts');

class launchbaseTestDeploy extends TestDeploy {
	getArgs() {
		return {
			/*'pm2-home': {
				required: true
			},
			'jobs-db': {
				required: true
			},
			'jobs-db-user': {
				required: true
			},
			'jobs-db-user-password': {
				required: true
			},
			'config-path': {
				required: true,
				isPath: true,
			},
			'service-report-dir': {
				required: true,
				isPath: true,
			},
			'integration-report-dir': {
				required: true,
				isPath: true,
			},
			'integration-test-config-path': {
				required: true,
				isPath: true
			}*/
		};
	}

	async runScript(args) {
		const {configPath, pm2Home} = this.getConfig();

		try {
			var launchbaseConfig = require(configPath);
		} catch (err) {
			throw new Error(`launchbase config not found at path='${configPath}'`);
		}

		this.flushDatabase();

		execScript(`PM2_HOME=${pm2Home} pm2 restart com.hermes.launchbase.api`);

		console.log('waiting for launchbase to become available');

		await pollServerAvailability(`http://localhost:${launchbaseConfig.port}/v1/core/ping`);

		console.log('launchbase is available');
	}

	/**
	 * Flush lb and service-jobs database. Is also used as a callable command
	 */
	flushDatabase() {
		this.flushlaunchbaseDatabase();
		this.flushServiceJobsDatabase();

	}

	flushlaunchbaseDatabase() {
		let {mongo: mongoConf} = this.getConfig();

		mongoConf.dumpFile = path.join(__dirname, 'dump/launchbase');

		return this.doDatabaseFlush(mongoConf);
	}

	flushServiceJobsDatabase() {
		const {serviceJobs} = this.getConfig();

		return this.doDatabaseFlush(serviceJobs.mongo);
	}

	/**
	 * @param {String} database
	 * @param {String} username
	 * @param {String} password
	 * @param {String} dumpFile
	 * @private
	 */
	doDatabaseFlush({database, username, password, dumpFile}) {
		let cmd = `${INIT_DATABASE_SCRIPT} -u ${username} -p ${password} -d ${database}`;

		if(dumpFile) {
			cmd += ` -f ${dumpFile}`;
		}
		return execScript(cmd);
	};
}

module.exports = launchbaseTestDeploy;