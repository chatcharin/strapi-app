'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::chat-widget-setting.chat-widget-setting', ({ strapi }) => {
  const resolveToDocumentId = async (value) => {
    if (!value) return null;

    const raw = String(value);
    const asInt = Number.parseInt(raw, 10);
    const isNumericId = Number.isFinite(asInt) && String(asInt) === raw;

    // If caller already provided a non-numeric value, assume it's a documentId.
    if (!isNumericId) return raw;

    // Caller provided numeric id: translate id -> documentId
    const entity = await strapi.entityService.findOne('api::chat-widget-setting.chat-widget-setting', asInt, {
      fields: ['documentId'],
    });

    return entity?.documentId || null;
  };

  return {
    async findOne(ctx) {
      const documentId = await resolveToDocumentId(ctx.params.id);
      if (!documentId) return ctx.notFound('Chat widget setting not found');
      ctx.params.id = String(documentId);
      return await super.findOne(ctx);
    },

    async update(ctx) {
      const documentId = await resolveToDocumentId(ctx.params.id);
      if (!documentId) return ctx.notFound('Chat widget setting not found');
      ctx.params.id = String(documentId);
      return await super.update(ctx);
    },

    async delete(ctx) {
      const documentId = await resolveToDocumentId(ctx.params.id);
      if (!documentId) return ctx.notFound('Chat widget setting not found');
      ctx.params.id = String(documentId);
      return await super.delete(ctx);
    },
  };
});
