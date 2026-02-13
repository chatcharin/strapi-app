'use strict';

/**
 * ex-chat service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::ex-chat.ex-chat');
