'use strict';

const { getService } = require('../utils/getService');
const { isValidContentTypeRoute } = require('../utils/isValidContentTypeRoute');


const strapiFlatten = (data) => {
	const isObject = (data) =>
	  Object.prototype.toString.call(data) === "[object Object]";
	const isArray = (data) =>
	  Object.prototype.toString.call(data) === "[object Array]";
  
	const flatten = (data) => {
	  if (!data.attributes) return data;
  
	  return {
		id: data.id,
		...data.attributes,
	  };
	};
  
	if (isArray(data)) {
	  return data.map((item) => strapiFlatten(item));
	}
  
	if (isObject(data)) {
	  if (isArray(data.data)) {
		data = [...data.data];
	  } else if (isObject(data.data)) {
		data = flatten({ ...data.data });
	  } else if (data.data === null) {
		data = null;
	  } else {
		data = flatten(data);
	  }
  
	  for (const key in data) {
		data[key] = strapiFlatten(data[key]);
	  }
  
	  return data;
	}
  
	return data;
  };

const io = async (strapi, ctx, next) => {
	const settingsService = getService({ name: 'settingsService' });
	const { contentTypes } = await settingsService.get();
	await next();

	const { body, state } = ctx;

	// ensure body exists, occurs on non existent route
	if (!body) {
		return;
	}

	const { route } = state;
	if (!route || !route.handler) {
		return;
	}

	let model;
	if (ctx.params && ctx.params.model) {
		// partial model is in params for admin calls
		model = `${ctx.params.model}.${route.handler.split('.').pop()}`;

		// account for components with relations
		if (!/api::|plugin::/.test(model)) {
			model = `api::${model}`;
		}
	} else if (route.info.apiName) {
		// full model is in handler for default content api calls
		model = route.handler;

		// account for custom routes which do not have the prefix and apiName in handler
		if (!/api::/.test(model)) {
			model = `api::${route.info.apiName}.${model}`;
		}
	}

	if (!model) {
		return;
	}

	// ensure we are only emitting events for allowed content types as specified in the settings.
	if (!isValidContentTypeRoute({ contentTypes, route, model })) {
		return;
	}

	console.log(`Emitting ${model} event`);

	strapi.$io.emit(model, strapiFlatten(ctx.body));
};

module.exports = ({ strapi }) => {
	strapi.server.use((ctx, next) => io(strapi, ctx, next));
};
