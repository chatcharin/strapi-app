'use strict';

/**
 * knowledge-base controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::knowledge-base.knowledge-base', ({ strapi }) => ({
  async delete(ctx) {
    let { id } = ctx.params;

    // If id is a string (documentId), convert it to integer ID
    if (typeof id === 'string' && isNaN(parseInt(id))) {
      const knowledgeBase = await strapi.entityService.findMany('api::knowledge-base.knowledge-base', {
        filters: {
          documentId: id
        },
        limit: 1
      });

      if (!knowledgeBase || knowledgeBase.length === 0) {
        return ctx.notFound('Knowledge base not found');
      }

      id = knowledgeBase[0].id;
    }

    // First, delete all documents associated with this knowledge-base
    const documents = await strapi.entityService.findMany('api::document.document', {
      filters: {
        knowledge_base: id
      }
    });

    for (const document of documents) {
      await strapi.entityService.delete('api::document.document', document.id);
    }

    // Then delete the knowledge-base
    const result = await strapi.entityService.delete('api::knowledge-base.knowledge-base', id);

    return result;
  }
}));
