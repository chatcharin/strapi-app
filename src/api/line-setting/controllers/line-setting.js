'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const lineService = require('../../line/services/line');

module.exports = createCoreController('api::line-setting.line-setting', ({ strapi }) => ({
  async refreshAvatar(ctx) {
    const { id } = ctx.params;
    if (!id) return ctx.badRequest('id is required');

    const setting = await strapi.db.query('api::line-setting.line-setting').findOne({
      where: { documentId: id },
    });

    if (!setting) return ctx.notFound('LINE setting not found');
    if (!setting.channelAccessToken) return ctx.badRequest('Missing channelAccessToken');

    try {
      const botInfo = await lineService.lineFetch('/v2/bot/info', {
        method: 'GET',
        accessToken: setting.channelAccessToken,
      });

      const avatarUrl = botInfo && botInfo.pictureUrl ? botInfo.pictureUrl : null;
      if (!avatarUrl) return ctx.badRequest('LINE bot info has no pictureUrl');

      const updated = await strapi.db.query('api::line-setting.line-setting').update({
        where: { id: setting.id },
        data: { avatarUrl },
      });

      const sanitized = await this.sanitizeOutput(updated, ctx);
      return this.transformResponse(sanitized);
    } catch (err) {
      strapi.log.error(`[LINE-SETTING] refreshAvatar error: ${err.message}`);
      return ctx.badRequest(err.message || 'Failed to refresh avatar');
    }
  },
}));
