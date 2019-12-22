var fs = require('fs');
var path = require('path');
var handlebars = require('handlebars');

module.exports = {
	write : function(results, options, done) {
		var reportFilePath = path.join(options.output_folder, 'index.html');

		// read the html template
		fs.readFile(path.join(__dirname, 'html-reporter.hbs'), function(err, data) {
			if (err) {
				throw err;
			}

			var resultTemplate = data.toString();

			fs.readFile(path.join(__dirname, 'html-reporter-result-set.hbs'), function (err, data) {
				var resultSetTemplate = data.toString();

				// merge the template with the test results data
				var result = handlebars.compile(resultSetTemplate)({
					results   : results,
					options   : options,
					timestamp : new Date().toString()
				});

				if(!process.resultSet) {
					process.resultSet = [];
				}

				process.resultSet.push(result);

				var html = handlebars.compile(resultTemplate)({
					resultSet   : process.resultSet,
					browser   : options.filename_prefix.split('_').join(' ')
				});

				// write the html to a file
				fs.writeFile(reportFilePath, html, function(err) {
					if (err) {
						throw err;
					}
					done();
				});
			});
		});
	}
};