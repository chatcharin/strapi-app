'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/invitations',
      handler: 'invitation.createInvitation',
      config: {
        auth: {},
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/invitations/accept',
      handler: 'invitation.acceptInvitation',
      config: {
        auth: {},
        policies: [],
      },
    },
  ],
};
