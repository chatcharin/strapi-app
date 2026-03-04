'use strict';

const { createCoreService } = require('@strapi/strapi').factories;
const nodemailer = require('nodemailer');

module.exports = createCoreService('api::email-setting.email-setting', ({ strapi }) => ({
  async resolveWorkspaceId(workspaceId) {
    if (!workspaceId) return null;
    if (typeof workspaceId === 'number') return workspaceId;

    const raw = String(workspaceId);
    if (raw.trim() === '') return null;

    // numeric string
    if (!Number.isNaN(Number(raw))) return Number(raw);

    const entity = await strapi.db.query('api::workspace.workspace').findOne({
      where: { documentId: raw },
      select: ['id'],
    });

    return entity ? entity.id : null;
  },

  async getActiveSettings(workspaceId) {
    const workspaceIntId = await this.resolveWorkspaceId(workspaceId);
    if (!workspaceIntId) return null;

    const entity = await strapi.db.query('api::email-setting.email-setting').findOne({
      where: {
        isActive: true,
        workspace: workspaceIntId,
      },
      orderBy: { id: 'desc' },
    });

    return entity || null;
  },

  async sendEmail(payload) {
    const { to, subject, html, from, replyTo, workspaceId } = payload || {};

    if (!to) throw new Error('Email "to" is required');
    if (!subject) throw new Error('Email "subject" is required');
    if (!html) throw new Error('Email "html" is required');

    const settings = await this.getActiveSettings(workspaceId);

    const smtpHost = (settings && settings.smtpHost) || process.env.SMTP_HOST;
    const smtpPort = (settings && settings.smtpPort) || (process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined);
    const smtpSecure =
      (settings && typeof settings.smtpSecure === 'boolean' ? settings.smtpSecure : undefined) ??
      (process.env.SMTP_SECURE ? String(process.env.SMTP_SECURE).toLowerCase() === 'true' : undefined);
    const smtpUser = (settings && settings.smtpUser) || process.env.SMTP_USER;
    const smtpPass = (settings && settings.smtpPass) || process.env.SMTP_PASS;

    const defaultFrom = (settings && settings.emailFrom) || process.env.EMAIL_FROM;
    const defaultReplyTo = (settings && settings.emailReplyTo) || process.env.EMAIL_REPLY_TO || defaultFrom;

    if (!smtpHost) throw new Error('SMTP host is not configured');
    if (!smtpPort) throw new Error('SMTP port is not configured');

    const transport = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: Boolean(smtpSecure),
      auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
    });

    return transport.sendMail({
      to,
      subject,
      html,
      from: from || defaultFrom || undefined,
      replyTo: replyTo || defaultReplyTo || undefined,
    });
  },
}));
