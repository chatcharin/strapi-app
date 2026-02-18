'use strict';

const crypto = require('crypto');

function generateVerifyToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  async afterCreate(event) {
    const { result } = event;
    const strapi = event.strapi || global.strapi;

    if (!strapi) {
      // eslint-disable-next-line no-console
      console.warn('[META-SETTING] afterCreate skipped: strapi instance not available');
      return;
    }

    const baseUrl = process.env.BASE_URL || process.env.STRAPI_URL || 'http://localhost:1337';
    const webhookUrl = `${baseUrl}/api/meta/callback/${result.documentId}`;
    const verifyToken = result.verifyToken || generateVerifyToken();

    await strapi.db.query('api::meta-setting.meta-setting').update({
      where: { id: result.id },
      data: { webhookUrl, verifyToken },
    });

    strapi.log.info(`[META-SETTING] Auto-generated webhookUrl: ${webhookUrl}`);
    strapi.log.info(`[META-SETTING] Auto-generated verifyToken: ${verifyToken}`);
  },
};
