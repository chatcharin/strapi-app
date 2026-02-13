'use strict';

/**
 * ex-chat controller
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { getIO } = require('../../../socket');

const isNumericId = (value) => {
  if (typeof value !== 'string' && typeof value !== 'number') return false;
  const str = String(value);
  return str.trim() !== '' && !Number.isNaN(Number(str));
};

const resolveChatIdParamToDocumentId = async (strapi, idParam) => {
  if (!idParam) return null;
  if (!isNumericId(idParam)) return idParam;

  const entity = await strapi.db.query('api::ex-chat.ex-chat').findOne({
    where: { id: Number(idParam) },
    select: ['documentId'],
  });

  return entity ? entity.documentId : null;
};

module.exports = createCoreController('api::ex-chat.ex-chat', ({ strapi }) => ({
  async findOne(ctx) {
    const resolvedDocumentId = await resolveChatIdParamToDocumentId(strapi, ctx.params.id);
    if (!resolvedDocumentId) return ctx.notFound('Chat not found');

    ctx.params.id = String(resolvedDocumentId);
    return super.findOne(ctx);
  },

  async update(ctx) {
    const resolvedDocumentId = await resolveChatIdParamToDocumentId(strapi, ctx.params.id);
    if (!resolvedDocumentId) return ctx.notFound('Chat not found');

    ctx.params.id = String(resolvedDocumentId);
    return super.update(ctx);
  },

  async delete(ctx) {
    const resolvedDocumentId = await resolveChatIdParamToDocumentId(strapi, ctx.params.id);
    if (!resolvedDocumentId) return ctx.notFound('Chat not found');

    ctx.params.id = String(resolvedDocumentId);
    return super.delete(ctx);
  },

  async create(ctx) {
    const bodyData = (ctx.request && ctx.request.body && ctx.request.body.data) || null;

    if (bodyData && bodyData.workspaceId && bodyData.channel && bodyData.visitorId) {
      const existing = await strapi.db.query('api::ex-chat.ex-chat').findOne({
        where: {
          workspaceId: bodyData.workspaceId,
          channel: bodyData.channel,
          visitorId: bodyData.visitorId,
          status: {
            $in: ['open', 'pending'],
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      if (existing) {
        const sanitizedEntity = await this.sanitizeOutput(existing, ctx);
        return this.transformResponse(sanitizedEntity);
      }
    }

    const response = await super.create(ctx);

    const io = getIO();
    if (io && response.data) {
      const workspaceId = response.data.workspaceId || (response.data.attributes && response.data.attributes.workspaceId);
      if (workspaceId) {
        io.to(`ws:${workspaceId}`).emit('conversation:new', response.data);
      }
    }

    return response;
  },
}));
