'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/meta/callback/:settingId',
      handler: 'meta.callback',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/meta/callback/:settingId',
      handler: 'meta.callback',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/meta/push',
      handler: 'meta.push',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
