'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::email-verification.email-verification', {
  config: {
    create: {},
    find: {},
    findOne: {},
    update: {},
    delete: {},
  },
  routes: [
    {
      method: 'POST',
      path: '/email-verification/send-otp',
      handler: 'email-verification.sendOtp',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/email-verification/verify-otp',
      handler: 'email-verification.verifyOtp',
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
});
