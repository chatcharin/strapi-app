'use strict';

/**
 * ex-message controller
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { getIO } = require('../../../socket');
const metaService = require('../../meta/services/meta');

const isNumericId = (value) => {
  if (typeof value !== 'string' && typeof value !== 'number') return false;
  const str = String(value);
  return str.trim() !== '' && !Number.isNaN(Number(str));
};

const resolveMessageIdParamToDocumentId = async (strapi, idParam) => {
  if (!idParam) return null;
  if (!isNumericId(idParam)) return idParam;

  const entity = await strapi.db.query('api::ex-message.ex-message').findOne({
    where: { id: Number(idParam) },
    select: ['documentId'],
  });

  return entity ? entity.documentId : null;
};

const resolveChatIdToDocumentId = async (strapi, chatId) => {
  if (!chatId) return null;
  if (!isNumericId(chatId)) return chatId;

  const chat = await strapi.db.query('api::ex-chat.ex-chat').findOne({
    where: { id: Number(chatId) },
    select: ['documentId'],
  });

  return chat ? chat.documentId : null;
};

module.exports = createCoreController('api::ex-message.ex-message', ({ strapi }) => ({
  async findOne(ctx) {
    const resolvedDocumentId = await resolveMessageIdParamToDocumentId(strapi, ctx.params.id);
    if (!resolvedDocumentId) return ctx.notFound('Message not found');

    ctx.params.id = String(resolvedDocumentId);
    return super.findOne(ctx);
  },

  async update(ctx) {
    const resolvedDocumentId = await resolveMessageIdParamToDocumentId(strapi, ctx.params.id);
    if (!resolvedDocumentId) return ctx.notFound('Message not found');

    ctx.params.id = String(resolvedDocumentId);
    return super.update(ctx);
  },

  async delete(ctx) {
    const resolvedDocumentId = await resolveMessageIdParamToDocumentId(strapi, ctx.params.id);
    if (!resolvedDocumentId) return ctx.notFound('Message not found');

    ctx.params.id = String(resolvedDocumentId);
    return super.delete(ctx);
  },

  async create(ctx) {
    const bodyData = (ctx.request && ctx.request.body && ctx.request.body.data) || null;
    if (bodyData && bodyData.chatId) {
      const resolvedChatDocumentId = await resolveChatIdToDocumentId(strapi, bodyData.chatId);
      if (!resolvedChatDocumentId) {
        return ctx.badRequest('Invalid chatId');
      }
      bodyData.chatId = resolvedChatDocumentId;
      ctx.request.body.data = bodyData;
    }

    const response = await super.create(ctx);

    try {
      const data = response && response.data ? response.data : null;
      const attrs = data && data.attributes ? data.attributes : data;
      const senderRole = (attrs && attrs.senderRole) || 'visitor';
      const channel = attrs && attrs.channel;
      const content = (attrs && attrs.content) || '';
      const chatIdRaw = (attrs && attrs.chatId) || null;
      const chatDocumentId = await resolveChatIdToDocumentId(strapi, chatIdRaw);

      if (
        senderRole === 'agent' &&
        ['facebook', 'instagram', 'whatsapp'].includes(channel) &&
        chatDocumentId &&
        content
      ) {
        const chat = await strapi.db.query('api::ex-chat.ex-chat').findOne({
          where: { documentId: chatDocumentId },
        });

        if (chat && chat.visitorId) {
          const metaSettingId = chat.metaSettingId || (chat.metadata && chat.metadata.metaSettingId);
          let setting = null;

          if (metaSettingId) {
            setting = await strapi.db.query('api::meta-setting.meta-setting').findOne({
              where: { documentId: metaSettingId, isActive: true },
            });
          }

          if (!setting) {
            setting = await strapi.db.query('api::meta-setting.meta-setting').findOne({
              where: { workspaceId: chat.workspaceId, channel: chat.channel, isActive: true },
            });
          }

          if (setting) {
            await metaService.sendMessage({
              channel: chat.channel,
              recipientId: chat.visitorId,
              content,
              setting,
            });
            strapi.log.info(`[META] REST auto-reply sent to ${chat.visitorId} channel=${chat.channel} conv:${chatDocumentId}`);
          } else {
            strapi.log.warn(
              `[META] REST auto-reply skipped: no active meta-setting found (workspaceId=${chat.workspaceId} channel=${chat.channel} conv:${chatDocumentId})`
            );
          }
        }
      }
    } catch (metaErr) {
      try {
        const data = response && response.data ? response.data : null;
        if (data && data.documentId) {
          await strapi.db.query('api::ex-message.ex-message').update({
            where: { documentId: data.documentId },
            data: {
              status: 'failed',
              metadata: { ...(data.metadata || {}), metaSendError: metaErr.message },
            },
          });
        }
      } catch (_) {
        // ignore
      }

      strapi.log.error(`[META] REST auto-reply error: ${metaErr.message}`);
    }

    const io = getIO();
    if (io && response.data) {
      const chatIdRaw = response.data.chatId || (response.data.attributes && response.data.attributes.chatId);
      const chatDocumentId = await resolveChatIdToDocumentId(strapi, chatIdRaw);
      if (chatDocumentId) {
        io.to(`conv:${chatDocumentId}`).emit('message:new', response.data);

        const chat = await strapi.db.query('api::ex-chat.ex-chat').findOne({
          where: { documentId: chatDocumentId },
        });

        if (chat) {
          const content = response.data.content || (response.data.attributes && response.data.attributes.content) || '';
          const senderRole = response.data.senderRole || (response.data.attributes && response.data.attributes.senderRole) || 'visitor';

          const updateData = {
            lastMessage: content.substring(0, 500),
            lastMessageAt: new Date(),
          };

          if (senderRole === 'visitor') {
            updateData.unreadCount = (chat.unreadCount || 0) + 1;
          }

          const updatedChat = await strapi.db.query('api::ex-chat.ex-chat').update({
            where: { id: chat.id },
            data: updateData,
          });

          if (chat.workspaceId) {
            io.to(`ws:${chat.workspaceId}`).emit('conversation:updated', updatedChat);
          }
        }
      }
    }

    return response;
  },
}));
