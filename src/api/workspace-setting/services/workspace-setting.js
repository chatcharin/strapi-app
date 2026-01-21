'use strict';

/**
 * workspace-setting service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::workspace-setting.workspace-setting');
