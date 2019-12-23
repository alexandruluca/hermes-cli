const isCI = require('is-ci');
const isPullRequest = true; //isCI && !!(process.env.ghprbPullId && process.env.ghprbTargetBranch);

exports.isPullRequest = isPullRequest;

exports.getPullRequestMeta = getPullRequestMeta;

function getPullRequestMeta() {
/* 	return {
		actualCommit: '27deac367550108f21f7f5abf66ce10512ad0950',
		actualCommitAuthor: 'luca.p.alexandru@gmail.com',
		actualCommitAuthorEmail: 'luca.p.alexandru@gmail.com',
		pullDescription: 'desc',
		pullId: '1',
		pullLink: 'https://github.com/alexandruluca/pull-request-test/pull/2',
		pullTitle: 'lambda test',
		sourceBranch: 'feature/1',
		issueNumber: '1',
		targetBranch: 'develop',
		sha1: 'sha1'
	} */

	let prInformation = {
		actualCommit: process.env.ghprbActualCommit,
		actualCommitAuthor: process.env.ghprbActualCommitAuthor,
		actualCommitAuthorEmail: process.env.ghprbActualCommitAuthorEmail,
		pullDescription: process.env.ghprbPullDescription,
		pullId: process.env.ghprbPullId,
		pullLink: process.env.ghprbPullLink,
		pullTitle: process.env.ghprbPullTitle,
		sourceBranch: process.env.ghprbSourceBranch,
		issueNumber: process.env.ghprbSourceBranch && process.env.ghprbSourceBranch.split('/').pop(),
		targetBranch: process.env.ghprbTargetBranch,
		sha1: process.env.sha1
	};

	for (let prop in prInformation) {
		if (typeof prInformation[prop] === 'undefined') {
			delete prInformation[prop];
		}
	}

	return prInformation;
}