'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/line/callback/:settingId',
      handler: 'line.callback',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/line/push',
      handler: 'line.push',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
