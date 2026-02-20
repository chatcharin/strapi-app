'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const metaService = require('../../meta/services/meta');

module.exports = createCoreController('api::meta-setting.meta-setting', ({ strapi }) => ({
  async refreshAvatar(ctx) {
    const { id } = ctx.params;
    if (!id) return ctx.badRequest('id is required');

    const setting = await strapi.db.query('api::meta-setting.meta-setting').findOne({
      where: { documentId: id },
    });

    if (!setting) return ctx.notFound('Meta setting not found');
    if (!setting.accessToken) return ctx.badRequest('Missing accessToken');
    if (!setting.accountId) return ctx.badRequest('Missing accountId');
    if (!setting.channel) return ctx.badRequest('Missing channel');

    try {
      const avatarUrl = await metaService.getSettingAvatar({
        channel: setting.channel,
        accountId: setting.accountId,
        accessToken: setting.accessToken,
      });

      if (!avatarUrl) return ctx.badRequest('Meta account has no avatar url');

      const updated = await strapi.db.query('api::meta-setting.meta-setting').update({
        where: { id: setting.id },
        data: { avatarUrl },
      });

      const sanitized = await this.sanitizeOutput(updated, ctx);
      return this.transformResponse(sanitized);
    } catch (err) {
      strapi.log.error(`[META-SETTING] refreshAvatar error: ${err.message}`);
      return ctx.badRequest(err.message || 'Failed to refresh avatar');
    }
  },
}));
