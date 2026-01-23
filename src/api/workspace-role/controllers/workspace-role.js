'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::workspace-role.workspace-role', ({ strapi }) => ({
  async resolveDocumentId(id) {
    if (id === undefined || id === null) return id;

    const raw = String(id);
    const asInt = Number.parseInt(raw, 10);

    if (!Number.isFinite(asInt) || String(asInt) !== raw) {
      return raw;
    }

    const role = await strapi.db.query('api::workspace-role.workspace-role').findOne({
      select: ['documentId'],
      where: { id: asInt },
    });

    return role?.documentId;
  },

  async findOne(ctx) {
    const resolved = await this.resolveDocumentId(ctx.params.id);
    if (!resolved) {
      return ctx.notFound('Workspace role not found');
    }
    ctx.params.id = resolved;
    return await super.findOne(ctx);
  },

  async update(ctx) {
    const resolved = await this.resolveDocumentId(ctx.params.id);
    if (!resolved) {
      return ctx.notFound('Workspace role not found');
    }
    ctx.params.id = resolved;
    return await super.update(ctx);
  },

  async delete(ctx) {
    const resolved = await this.resolveDocumentId(ctx.params.id);
    if (!resolved) {
      return ctx.notFound('Workspace role not found');
    }
    ctx.params.id = resolved;
    return await super.delete(ctx);
  },
}));
