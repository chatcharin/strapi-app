'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/ex-chats/actions/assignment-actor-options',
      handler: 'ex-chat.assignmentActorOptions',
      info: {
        type: 'content-api',
      },
      config: {
        auth: false, // make public; secure later if needed
        policies: [],
      },
    },
  ],
};
