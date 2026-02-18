'use strict';

module.exports = {
  async beforeCreate(event) {
    if (!event.params) event.params = {};
    if (!event.params.data) event.params.data = {};
    event.params.data.lastUpdate = new Date();
  },

  async beforeUpdate(event) {
    if (!event.params) event.params = {};
    if (!event.params.data) event.params.data = {};
    event.params.data.lastUpdate = new Date();
  },

  async afterCreate(event) {
    const { result } = event;
    const strapi = event.strapi || global.strapi;

    if (!strapi) return;
    if (!result || !result.id || !result.documentId) return;
    if (result.embedCode) return;

    const frontendUrl = process.env.WIDGET_FRONTEND_URL || process.env.FRONTEND_URL;
    const fallbackUrl = process.env.BASE_URL || process.env.STRAPI_URL || 'http://localhost:1337';
    const backendUrl = fallbackUrl.replace(/\/$/, '');
    const scriptBaseUrl = (frontendUrl || 'http://localhost:5173').replace(/\/$/, '');
    const widgetScriptUrl = `${scriptBaseUrl}/chat-widget.js`;
    const settingId = result.documentId;

    const embedCode = `<script src="${widgetScriptUrl}" data-chat-widget-setting-id="${settingId}" data-chat-widget-backend-url="${backendUrl}" async></script>`;

    await strapi.db.query('api::chat-widget-setting.chat-widget-setting').update({
      where: { id: result.id },
      data: { embedCode },
    });
  },
};
