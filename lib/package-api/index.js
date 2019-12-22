const config = require('../../config').package;
const Swagger = require('swagger-client');
const apiURL =  config.apiUrl;

var auth = 'Basic ' + Buffer.from(`${config.user.username}:${config.user.password}`).toString('base64');

var authorizations = {
	basicAuth: new Swagger.ApiKeyAuthorization("Authorization", auth, "header")
};
var api = null;

module.exports.initialize = () => {
	return new Swagger({
		url: apiURL,
		usePromise: true,
		useJQuery: false,
		authorizations: authorizations,
		scheme: apiURL.startsWith('https') ? 'https' : 'http',
		responseInterceptor: {
			apply: function (responseObj) {
				if(responseObj.url === apiURL) {
					return responseObj;
				}

				if (responseObj.errObj) {
					try {
						var data;

						if(responseObj.data) {
							data = JSON.parse(responseObj.data);
						} else if(responseObj.errObj.response && responseObj.errObj.response.body) {
							data = JSON.parse(responseObj.errObj.response.body.toString());
						}

						//wrap promise rejection result in an Error so that bluebird does not complain
						var err = new Error();

						var errData = {
							message: data.message,
							code: data.errorCode || data.code,
							statusCode: responseObj.status,
							errors: data.errors || [],
							data: data.data,
							raw: responseObj
						};

						for(var prop in errData) {
							err[prop] = errData[prop];
						}

						return err;
					} catch (err) {
						for(var prop in responseObj) {
							err[prop] = responseObj[prop];
						}
						return err;
					}
				}

				if(responseObj.obj) {
					return responseObj.obj.data;
				} else if(responseObj.data) {
					return responseObj.data;
				}

				return responseObj;
			}
		}
	}).then(client => {
		api = Object.assign(module.exports, client);
		return api;
	});
};

module.exports.getInstance = () => {
	if(!api) {
		throw new Error('api not yet initialized');
	}

	return api;
};
