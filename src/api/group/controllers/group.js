'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::group.group', ({ strapi }) => ({
  async resolveGroupDocumentId(id) {
    if (id === undefined || id === null) return id;

    const raw = String(id);
    const asInt = Number.parseInt(raw, 10);

    // If it's not a plain integer, assume it's already a documentId
    if (!Number.isFinite(asInt) || String(asInt) !== raw) {
      return raw;
    }

    const group = await strapi.db.query('api::group.group').findOne({
      select: ['documentId'],
      where: { id: asInt },
    });

    return group?.documentId;
  },

  async findOne(ctx) {
    const resolved = await this.resolveGroupDocumentId(ctx.params.id);
    if (!resolved) {
      return ctx.notFound('Group not found');
    }
    ctx.params.id = resolved;
    return await super.findOne(ctx);
  },

  async update(ctx) {
    const resolved = await this.resolveGroupDocumentId(ctx.params.id);
    if (!resolved) {
      return ctx.notFound('Group not found');
    }
    ctx.params.id = resolved;
    return await super.update(ctx);
  },

  async delete(ctx) {
    const resolved = await this.resolveGroupDocumentId(ctx.params.id);
    if (!resolved) {
      return ctx.notFound('Group not found');
    }
    ctx.params.id = resolved;
    return await super.delete(ctx);
  },
}));
