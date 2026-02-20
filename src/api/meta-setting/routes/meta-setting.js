'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::meta-setting.meta-setting', {
  routes: [
    {
      method: 'POST',
      path: '/meta-settings/:id/refresh-avatar',
      handler: 'meta-setting.refreshAvatar',
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
