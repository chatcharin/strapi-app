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
      method: 'GET',
      path: '/workspaces/by-document/:docId',
      handler: 'workspace.findByDocument',
      config: {
        auth: {
          strategies: ['users-permissions'],
        },
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/workspaces/:id/contact',
      handler: 'workspace.contact',
      config: {
        auth: {
          strategies: ['users-permissions'],
        },
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/workspaces/:id/select',
      handler: 'workspace.setSelectedWorkspace',
      config: {
        auth: {
          strategies: ['users-permissions'],
        },
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/workspaces/:id/change-owner',
      handler: 'workspace.changeOwner',
      config: {
        auth: {
          strategies: ['users-permissions'],
        },
        policies: [],
      },
    },
  ],
});
