const path = require('path');
const INIT_DATABASE_SCRIPT = path.join(__dirname, 'init-database.sh');
const DUMP_DATABASE_SCRIPT = path.join(__dirname, 'dump-database.sh');
const {execScript} = require('../../utils');

exports.INIT_DATABASE_SCRIPT = INIT_DATABASE_SCRIPT;
exports.DUMP_DATABASE_SCRIPT = DUMP_DATABASE_SCRIPT;
exports.gitTag = gitTag;

function gitTag(version) {
	return execScript(`git tag ${version} && git push origin ${version}`);
}