'use strict';

const lineService = require('../../../line/services/line');

module.exports = {
  async afterCreate(event) {
    const { result, params } = event;
    const strapi = event.strapi || global.strapi;

    if (!strapi) {
      // eslint-disable-next-line no-console
      console.warn('[LINE-SETTING] afterCreate skipped: strapi instance not available');
      return;
    }

    const baseUrl = process.env.BASE_URL || process.env.STRAPI_URL || 'http://localhost:1337';
    const webhookUrl = `${baseUrl}/api/line/callback/${result.documentId}`;

    const updateData = { webhookUrl };

    try {
      const fresh = await strapi.db.query('api::line-setting.line-setting').findOne({
        where: { id: result.id },
        select: ['id', 'documentId', 'avatarUrl', 'channelAccessToken'],
      });

      const accessToken =
        (fresh && fresh.channelAccessToken) ||
        (result && result.channelAccessToken) ||
        (params && params.data && params.data.channelAccessToken);

      const hasAvatar = Boolean((fresh && fresh.avatarUrl) || (result && result.avatarUrl));

      if (!accessToken) {
        strapi.log.warn(`[LINE-SETTING] afterCreate avatar skipped: missing channelAccessToken (id=${result.id})`);
      } else if (hasAvatar) {
        strapi.log.info(
          `[LINE-SETTING] afterCreate avatar skipped: already has avatarUrl (documentId=${(fresh && fresh.documentId) || result.documentId})`
        );
      } else {
        strapi.log.info(
          `[LINE-SETTING] afterCreate fetching bot info for avatar (documentId=${(fresh && fresh.documentId) || result.documentId})`
        );

        const botInfo = await lineService.lineFetch('/v2/bot/info', {
          method: 'GET',
          accessToken,
        });

        if (botInfo && botInfo.pictureUrl) {
          updateData.avatarUrl = botInfo.pictureUrl;
          strapi.log.info(
            `[LINE-SETTING] afterCreate avatar resolved (documentId=${(fresh && fresh.documentId) || result.documentId})`
          );
        } else {
          strapi.log.warn(
            `[LINE-SETTING] afterCreate bot info has no pictureUrl (documentId=${(fresh && fresh.documentId) || result.documentId})`
          );
        }
      }
    } catch (err) {
      strapi.log.warn(`[LINE-SETTING] Could not fetch bot info for avatar: ${err.message}`);
    }

    await strapi.db.query('api::line-setting.line-setting').update({
      where: { id: result.id },
      data: updateData,
    });

    strapi.log.info(`[LINE-SETTING] Auto-generated webhookUrl: ${webhookUrl}`);
  },

  async afterUpdate(event) {
    const { result, params } = event;
    const strapi = event.strapi || global.strapi;
    if (!strapi) return;
    if (!result || !result.id) return;

    // Backfill avatarUrl when missing and access token exists.
    // Note: when updating via Admin UI, lifecycle `result` may not include sensitive fields
    // like channelAccessToken unless they were part of the update payload. Reload from DB.
    try {
      const fresh = await strapi.db.query('api::line-setting.line-setting').findOne({
        where: { id: result.id },
        select: ['id', 'documentId', 'avatarUrl', 'channelAccessToken'],
      });

      const accessToken =
        (fresh && fresh.channelAccessToken) ||
        (result && result.channelAccessToken) ||
        (params && params.data && params.data.channelAccessToken);

      const hasAvatar = Boolean((fresh && fresh.avatarUrl) || (result && result.avatarUrl));

      const docId = (fresh && fresh.documentId) || result.documentId || '';

      if (hasAvatar) {
        strapi.log.info(`[LINE-SETTING] afterUpdate avatar skipped: already has avatarUrl (documentId=${docId})`);
        return;
      }

      if (!accessToken) {
        strapi.log.warn(`[LINE-SETTING] afterUpdate avatar skipped: missing channelAccessToken (documentId=${docId})`);
        return;
      }

      strapi.log.info(`[LINE-SETTING] afterUpdate fetching bot info for avatar (documentId=${docId})`);

      if (!hasAvatar && accessToken) {
        const botInfo = await lineService.lineFetch('/v2/bot/info', {
          method: 'GET',
          accessToken,
        });

        if (botInfo && botInfo.pictureUrl) {
          await strapi.db.query('api::line-setting.line-setting').update({
            where: { id: (fresh && fresh.id) || result.id },
            data: { avatarUrl: botInfo.pictureUrl },
          });
          strapi.log.info(`[LINE-SETTING] afterUpdate avatar updated (documentId=${docId})`);
        } else {
          strapi.log.warn(`[LINE-SETTING] afterUpdate bot info has no pictureUrl (documentId=${docId})`);
        }
      }
    } catch (err) {
      strapi.log.warn(`[LINE-SETTING] Could not backfill avatar on update: ${err.message}`);
    }
  },
};
