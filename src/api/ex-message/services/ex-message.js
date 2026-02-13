'use strict';

/**
 * ex-message service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::ex-message.ex-message');
