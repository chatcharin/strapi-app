'use strict';

module.exports = {
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
};
