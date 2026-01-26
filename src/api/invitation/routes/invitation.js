'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::invitation.invitation', {
  routes: [
    {
      method: 'POST',
      path: '/invitations/create',
      handler: 'invitation.createInvitation',
      config: {
        auth: true,
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/invitations/accept',
      handler: 'invitation.acceptInvitation',
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
});
