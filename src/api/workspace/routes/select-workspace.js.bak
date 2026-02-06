'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/workspaces/:id/select',
      handler: 'api::workspace.workspace.setSelectedWorkspace',
      config: {
        auth: {
          strategies: ['users-permissions'],
        },
        policies: [],
      },
    },
  ],
};
