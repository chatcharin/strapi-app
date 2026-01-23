'use strict';

/**
 * document controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::document.document', ({ strapi }) => ({
  async resolveDocumentId(id) {
    if (id === undefined || id === null) return id;

    const raw = String(id);
    const asInt = Number.parseInt(raw, 10);

    if (!Number.isFinite(asInt) || String(asInt) !== raw) {
      return raw;
    }

    const doc = await strapi.db.query('api::document.document').findOne({
      select: ['documentId'],
      where: { id: asInt },
    });

    return doc?.documentId;
  },

  async find(ctx) {
    const { filters } = ctx.query;

    // If filtering by knowledge_base with a string (documentId), convert it to integer ID
    if (filters?.knowledge_base && typeof filters.knowledge_base === 'string') {
      const documentId = filters.knowledge_base;

      // Find the knowledge-base by documentId
      const knowledgeBase = await strapi.entityService.findMany('api::knowledge-base.knowledge-base', {
        filters: {
          documentId: documentId
        },
        limit: 1
      });

      if (knowledgeBase && knowledgeBase.length > 0) {
        // Replace the documentId filter with the integer ID
        filters.knowledge_base = knowledgeBase[0].id;
      } else {
        // If knowledge-base not found, return empty result
        return { data: [], meta: {} };
      }
    }

    ctx.query.filters = filters;
    return await super.find(ctx);
  },

  async findOne(ctx) {
    const resolved = await this.resolveDocumentId(ctx.params.id);
    if (!resolved) {
      return ctx.notFound('Document not found');
    }
    ctx.params.id = resolved;
    return await super.findOne(ctx);
  },

  async update(ctx) {
    const resolved = await this.resolveDocumentId(ctx.params.id);
    if (!resolved) {
      return ctx.notFound('Document not found');
    }
    ctx.params.id = resolved;
    return await super.update(ctx);
  },

  async delete(ctx) {
    const resolved = await this.resolveDocumentId(ctx.params.id);
    if (!resolved) {
      return ctx.notFound('Document not found');
    }
    ctx.params.id = resolved;
    return await super.delete(ctx);
  },
}));
