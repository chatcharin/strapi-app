'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::chat-widget-setting.chat-widget-setting', ({ strapi }) => {
  const ensureWorkspacePopulate = (ctx) => {
    if (!ctx.query) ctx.query = {};

    // If caller explicitly set populate, keep it. Otherwise, populate workspace by default.
    if (ctx.query.populate === undefined) {
      ctx.query.populate = { workspace: true };
      return;
    }

    // populate can be string, array, or object. Normalize and ensure workspace is included.
    if (typeof ctx.query.populate === 'string') {
      if (!ctx.query.populate.split(',').map((s) => s.trim()).includes('workspace')) {
        ctx.query.populate = `${ctx.query.populate},workspace`;
      }
      return;
    }

    if (Array.isArray(ctx.query.populate)) {
      if (!ctx.query.populate.includes('workspace')) {
        ctx.query.populate = [...ctx.query.populate, 'workspace'];
      }
      return;
    }

    if (typeof ctx.query.populate === 'object' && ctx.query.populate !== null) {
      if (ctx.query.populate.workspace === undefined) {
        ctx.query.populate.workspace = true;
      }
    }
  };

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
    async find(ctx) {
      ensureWorkspacePopulate(ctx);
      return await super.find(ctx);
    },

    async findOne(ctx) {
      ensureWorkspacePopulate(ctx);
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
