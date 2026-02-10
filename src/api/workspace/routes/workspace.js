'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::workspace.workspace', {
  routes: [
    {
      method: 'GET',
      path: '/workspaces/by-document/:docId',
      handler: 'workspace.findByDocument',
      info: {
        type: 'content-api',
      },
      config: {
        auth: true,
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/workspaces/:id/contact',
      handler: 'workspace.contact',
      info: {
        type: 'content-api',
      },
      config: {
        auth: true,
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/workspaces/:id/select',
      handler: 'workspace.setSelectedWorkspace',
      info: {
        type: 'content-api',
      },
      config: {
        auth: true,
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/workspaces/:id/change-owner',
      handler: 'workspace.changeOwner',
      info: {
        type: 'content-api',
      },
      config: {
        auth: true,
        policies: [],
      },
    },
  ],
});
