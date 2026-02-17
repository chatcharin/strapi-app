'use strict';

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

    await strapi.db.query('api::line-setting.line-setting').update({
      where: { id: result.id },
      data: { webhookUrl },
    });

    strapi.log.info(`[LINE-SETTING] Auto-generated webhookUrl: ${webhookUrl}`);
  },
};
