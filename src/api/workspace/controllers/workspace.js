'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::workspace.workspace', ({ strapi }) => ({
  async updateOwner(ctx) {
    const { id } = ctx.params;
    const { full_name, email, phone, organization } = ctx.request.body || {};

    if (!id) return ctx.badRequest('Workspace id is required');
    if (!email) return ctx.badRequest('Owner email is required');

    const data = {
      owner_full_name: full_name ?? null,
      owner_email: email,
      owner_phone: phone ?? null,
      owner_organization: organization ?? null,
    };

    try {
      const updated = await strapi.entityService.update('api::workspace.workspace', id, {
        data,
      });

      return ctx.send({ message: 'Owner updated', workspace: updated });
    } catch (error) {
      strapi.log.error('Failed to update workspace owner', error);
      return ctx.badRequest('Failed to update owner');
    }
  },

  async findByDocument(ctx) {
    const { docId } = ctx.params;

    if (!docId) return ctx.badRequest('docId is required');

    try {
      const docs = await strapi.entityService.findMany('api::document.document', {
        filters: { docId },
        populate: ['workspace'],
        limit: 1,
      });

      if (docs.length === 0 || !docs[0].workspace) {
        return ctx.notFound('Workspace not found for this document');
      }

      return ctx.send({ workspace: docs[0].workspace });
    } catch (error) {
      strapi.log.error('Failed to find workspace by document', error);
      return ctx.badRequest('Failed to find workspace');
    }
  },
}));
