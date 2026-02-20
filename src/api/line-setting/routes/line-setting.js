'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::line-setting.line-setting', {
  routes: [
    {
      method: 'POST',
      path: '/line-settings/:id/refresh-avatar',
      handler: 'line-setting.refreshAvatar',
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
