'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::email-verification.email-verification', {
  routes: [
    {
      method: 'POST',
      path: '/email-verification/send-otp',
      handler: 'email-verification.sendOtp',
      info: {
        type: 'content-api',
      },
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/email-verification/verify-otp',
      handler: 'email-verification.verifyOtp',
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
