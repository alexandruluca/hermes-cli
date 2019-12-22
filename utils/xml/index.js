const parseString = require('xml2js').parseString;

exports.parseXml = function(xml) {
	return new Promise((resolve, reject) => {
		parseString(xml, function (err, result) {
			err ? reject(err) : resolve(result);
		});
	});
};