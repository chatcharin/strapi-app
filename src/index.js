'use strict';

const { initSocket } = require('./socket');

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/*{ strapi }*/) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    const ensureRouteInfo = (route) => {
      if (!route || typeof route !== 'object') return;
      if (!route.info || typeof route.info !== 'object') {
        route.info = { type: 'content-api' };
        return;
      }
      if (typeof route.info.type !== 'string') {
        route.info.type = 'content-api';
      }
    };

    const normalizeRouteContainer = (container) => {
      if (!container) return;

      if (Array.isArray(container.routes)) {
        container.routes.forEach((r) => {
          if (r && typeof r === 'object' && Array.isArray(r.routes)) {
            r.routes.forEach(ensureRouteInfo);
          } else {
            ensureRouteInfo(r);
          }
        });
      }
    };

    Object.values(strapi.apis || {}).forEach((api) => {
      normalizeRouteContainer(api);
    });

    Object.values(strapi.plugins || {}).forEach((plugin) => {
      normalizeRouteContainer(plugin);
    });

    // Auto-grant public permissions for conversation & chat-message-social
    const publicRole = await strapi.db
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'public' } });

    if (publicRole) {
      const publicActions = [
        { api: 'api::ex-chat.ex-chat', actions: ['find', 'findOne', 'create'] },
        { api: 'api::ex-message.ex-message', actions: ['find', 'findOne', 'create'] },
        { api: 'api::line-setting.line-setting', actions: ['find', 'findOne', 'create', 'update', 'delete'] },
        { api: 'api::line.line', actions: ['webhook', 'reply'] },
      ];

      for (const { api, actions } of publicActions) {
        for (const action of actions) {
          const existing = await strapi.db
            .query('plugin::users-permissions.permission')
            .findOne({ where: { action: `${api}.${action}`, role: publicRole.id } });

          if (!existing) {
            await strapi.db
              .query('plugin::users-permissions.permission')
              .create({ data: { action: `${api}.${action}`, role: publicRole.id } });
          }
        }
      }
    }

    // Initialize Socket.IO — wait for httpServer to be ready
    const waitForServer = () => {
      return new Promise((resolve) => {
        const check = () => {
          if (strapi.server && strapi.server.httpServer) {
            resolve();
          } else {
            setTimeout(check, 100);
          }
        };
        check();
      });
    };

    await waitForServer();
    initSocket(strapi);
  },
};
