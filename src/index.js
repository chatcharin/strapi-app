'use strict';

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
  bootstrap({ strapi }) {
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
  },
};
