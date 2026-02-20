'use strict';

const crypto = require('crypto');
const metaService = require('../../../meta/services/meta');

function generateVerifyToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  async afterCreate(event) {
    const { result, params } = event;
    const strapi = event.strapi || global.strapi;

    if (!strapi) {
      // eslint-disable-next-line no-console
      console.warn('[META-SETTING] afterCreate skipped: strapi instance not available');
      return;
    }

    const baseUrl = process.env.BASE_URL || process.env.STRAPI_URL || 'http://localhost:1337';
    const webhookUrl = `${baseUrl}/api/meta/callback/${result.documentId}`;
    const verifyToken = result.verifyToken || generateVerifyToken();

    const updateData = { webhookUrl, verifyToken };

    try {
      const fresh = await strapi.db.query('api::meta-setting.meta-setting').findOne({
        where: { id: result.id },
        select: ['id', 'documentId', 'avatarUrl', 'accessToken', 'accountId', 'channel'],
      });

      const hasAvatar = Boolean((fresh && fresh.avatarUrl) || result.avatarUrl);
      const accessToken =
        (fresh && fresh.accessToken) ||
        (result && result.accessToken) ||
        (params && params.data && params.data.accessToken);

      const channel = (fresh && fresh.channel) || result.channel;
      const accountId = (fresh && fresh.accountId) || result.accountId;

      if (!hasAvatar && accessToken && channel && accountId) {
        const avatarUrl = await metaService.getSettingAvatar({ channel, accountId, accessToken });
        if (avatarUrl) updateData.avatarUrl = avatarUrl;
      }
    } catch (err) {
      strapi.log.warn(`[META-SETTING] Could not fetch setting avatar: ${err.message}`);
    }

    await strapi.db.query('api::meta-setting.meta-setting').update({
      where: { id: result.id },
      data: updateData,
    });

    strapi.log.info(`[META-SETTING] Auto-generated webhookUrl: ${webhookUrl}`);
    strapi.log.info(`[META-SETTING] Auto-generated verifyToken: ${verifyToken}`);
  },

  async afterUpdate(event) {
    const { result, params } = event;
    const strapi = event.strapi || global.strapi;
    if (!strapi) return;
    if (!result || !result.id) return;

    try {
      const fresh = await strapi.db.query('api::meta-setting.meta-setting').findOne({
        where: { id: result.id },
        select: ['id', 'documentId', 'avatarUrl', 'accessToken', 'accountId', 'channel'],
      });

      const hasAvatar = Boolean((fresh && fresh.avatarUrl) || result.avatarUrl);
      if (hasAvatar) return;

      const accessToken =
        (fresh && fresh.accessToken) ||
        (result && result.accessToken) ||
        (params && params.data && params.data.accessToken);

      const channel = (fresh && fresh.channel) || result.channel;
      const accountId = (fresh && fresh.accountId) || result.accountId;

      if (!accessToken || !channel || !accountId) return;

      const avatarUrl = await metaService.getSettingAvatar({ channel, accountId, accessToken });
      if (!avatarUrl) return;

      await strapi.db.query('api::meta-setting.meta-setting').update({
        where: { id: fresh.id },
        data: { avatarUrl },
      });
    } catch (err) {
      strapi.log.warn(`[META-SETTING] Could not backfill avatar on update: ${err.message}`);
    }
  },
};
