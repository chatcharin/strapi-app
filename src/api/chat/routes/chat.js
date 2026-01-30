'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::chat.chat', {
  config: {
    find: {
      policies: ['global::require-workspace-context'],
    },
    findOne: {
      policies: ['global::require-workspace-context'],
    },
    create: {
      policies: ['global::require-workspace-context'],
    },
    update: {
      policies: ['global::require-workspace-context'],
    },
    delete: {
      policies: ['global::require-workspace-context'],
    },
  },
});
