'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const emailTemplates = require('../services/email-templates');

module.exports = createCoreController('api::email-verification.email-verification', ({ strapi }) => ({
  async sendOtp(ctx) {
    const { email } = ctx.request.body;
    const workspaceIdFromBody = ctx.request.body && ctx.request.body.workspaceId;
    const workspaceIdFromHeader =
      (ctx.request && ctx.request.headers && (ctx.request.headers['x-workspace-id'] || ctx.request.headers['X-Workspace-Id'])) || null;
    const workspaceId = workspaceIdFromBody || workspaceIdFromHeader || null;

    if (!email) {
      return ctx.badRequest('Email is required');
    }

    try {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      const existing = await strapi.entityService.findMany('api::email-verification.email-verification', {
        filters: { email, consumed: false },
        limit: 1,
      });

      if (existing.length > 0) {
        await strapi.entityService.update('api::email-verification.email-verification', existing[0].id, {
          data: { otp, expiresAt, ...(workspaceId ? { workspace: workspaceId } : {}) },
        });
      } else {
        await strapi.entityService.create('api::email-verification.email-verification', {
          data: { email, otp, expiresAt, consumed: false, ...(workspaceId ? { workspace: workspaceId } : {}) },
        });
      }

      const emailService = strapi.service('api::email-setting.email-setting');
      const html = emailTemplates.getOtpTemplate(otp);

      if (emailService && emailService.sendEmail) {
        await emailService.sendEmail({
          to: email,
          subject: 'รหัสยืนยันอีเมลของคุณ',
          html,
          workspaceId,
        });
      } else {
        await strapi.plugin('email').service('email').send({
          to: email,
          subject: 'รหัสยืนยันอีเมลของคุณ',
          html,
        });
      }

      ctx.send({ message: 'OTP sent successfully' });
    } catch (error) {
      console.error('Failed to send OTP:', error);
      ctx.badRequest('Failed to send OTP');
    }
  },

  async verifyOtp(ctx) {
    const { email, otp } = ctx.request.body;

    if (!email || !otp) {
      return ctx.badRequest('Email and OTP are required');
    }

    try {
      const verification = await strapi.entityService.findMany('api::email-verification.email-verification', {
        filters: { email, otp, consumed: false },
        limit: 1,
      });

      if (verification.length === 0) {
        return ctx.badRequest('Invalid or expired OTP');
      }

      const record = verification[0];

      if (new Date(record.expiresAt) < new Date()) {
        return ctx.badRequest('OTP has expired');
      }

      await strapi.entityService.update('api::email-verification.email-verification', record.id, {
        data: { consumed: true },
      });

      ctx.send({ message: 'OTP verified successfully' });
    } catch (error) {
      ctx.badRequest('Failed to verify OTP');
    }
  },
}));
