'use strict';

/**
 * document router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::document.document', {
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
