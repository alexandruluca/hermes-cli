exports.getJsonPointerValue = getJsonPointerValue;

function getJsonPointerValue(object, pointer) {
	let props = pointer.split('.');

	for(let i = 0; i < props.length; i++) {
		let prop = props[i];

		object = object[prop];

		if (!object || typeof object !== 'object') {
			return object;
		}
	}

	return object;
}