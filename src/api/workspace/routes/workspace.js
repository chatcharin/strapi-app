'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::workspace.workspace', {
  config: {
    create: {},
    find: {},
    findOne: {},
    update: {},
    delete: {},
  },
  routes: [
    {
      method: 'PUT',
      path: '/workspaces/:id/owner',
      handler: 'workspace.updateOwner',
      config: {
        auth: true,
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/workspaces/by-document/:docId',
      handler: 'workspace.findByDocument',
      config: {
        auth: true,
        policies: [],
      },
    },
  ],
});
