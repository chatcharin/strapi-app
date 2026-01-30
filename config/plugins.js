module.exports = ({ env }) => ({
  email: {
    config: {
      provider: '@strapi/provider-email-nodemailer',
      providerOptions: {
        host: env('SMTP_HOST', 'smtp.gmail.com'),
        port: env.int('SMTP_PORT', 587),
        secure: env.bool('SMTP_SECURE', false),
        auth: {
          user: env('SMTP_USER'),
          pass: env('SMTP_PASS'),
        },
        logger: true,
        debug: true,
      },
      settings: {
        defaultFrom: env('EMAIL_FROM'),
        defaultReplyTo: env('EMAIL_REPLY_TO', env('EMAIL_FROM')),
      },
    },
  },
});
