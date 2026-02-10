'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::invitation.invitation', {
  routes: [
    {
      method: 'POST',
      path: '/invitations',
      handler: 'invitation.createInvitation',
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
      path: '/invitations/accept',
      handler: 'invitation.acceptInvitation',
      info: {
        type: 'content-api',
      },
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
});
