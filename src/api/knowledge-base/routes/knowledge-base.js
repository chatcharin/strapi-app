'use strict';

/**
 * knowledge-base router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::knowledge-base.knowledge-base', {
  config: {
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
