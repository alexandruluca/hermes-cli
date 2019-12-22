const io = require('socket.io-client');
const apiUrl = require('../../config').package.url;
var socket;

exports.connect = function (queryStringObj) {
	let url = apiUrl;

	if(typeof queryStringObj === 'object') {
		let qsValues = Object.keys(queryStringObj).reduce((qsValues, key) => {
			qsValues.push(`${key}=${queryStringObj[key]}`)
			return qsValues;
		}, []);

		url += `?${qsValues.join('&')}`;
	}
	if(!socket) {
		socket = io(url);
	}

	return socket;
};

