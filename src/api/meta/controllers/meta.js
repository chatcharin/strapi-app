'use strict';

const metaService = require('../services/meta');
const { getIO } = require('../../../socket');

module.exports = {
  async callback(ctx) {
    const { settingId } = ctx.params;
    const mode = ctx.query['hub.mode'];
    const verifyToken = ctx.query['hub.verify_token'];
    const challenge = ctx.query['hub.challenge'];

    // GET: webhook verification
    if (ctx.method === 'GET') {
      const setting = await strapi.db.query('api::meta-setting.meta-setting').findOne({
        where: { documentId: settingId, isActive: true },
      });

      if (!setting) {
        ctx.status = 403;
        ctx.body = 'Setting not found';
        return;
      }

      if (mode === 'subscribe' && verifyToken === setting.verifyToken) {
        ctx.status = 200;
        ctx.body = challenge;
        return;
      }

      ctx.status = 403;
      ctx.body = 'Verification failed';
      return;
    }

    // POST: webhook payload
    const setting = await strapi.db.query('api::meta-setting.meta-setting').findOne({
      where: { documentId: settingId },
    });

    if (!setting || !setting.isActive) {
      strapi.log.warn(
        `[META] Webhook ignored for settingId=${settingId} (${!setting ? 'setting not found' : 'setting inactive'})`
      );
      ctx.status = 200;
      ctx.body = { ok: true };
      return;
    }

    const signature = ctx.request.headers['x-hub-signature-256'];
    const rawBody = metaService.getRawBodyString(ctx);

    const isValid = metaService.verifyMetaSignature(rawBody, setting.appSecret, signature);
    if (!isValid) {
      strapi.log.warn(`[META] Invalid signature for settingId=${settingId}`);
      ctx.status = 200;
      ctx.body = { ok: true };
      return;
    }

    const body = ctx.request.body;
    const events = metaService.extractEvents(setting.channel, body);
    const io = getIO();

    strapi.log.info(`[META] Webhook received settingId=${settingId} channel=${setting.channel} events=${events.length}`);

    for (const e of events) {
      try {
        if (!e || !e.senderId || !e.messageText) continue;

        const visitorId = e.senderId;

        let visitorName = visitorId;
        let visitorAvatar = null;

        if (setting.channel === 'whatsapp' && e.senderName) {
          visitorName = e.senderName;
        } else {
          const profile = await metaService.getProfile({ channel: setting.channel, userId: visitorId, setting });
          visitorName = profile.name;
          visitorAvatar = profile.avatar;
        }

        let chat = await strapi.db.query('api::ex-chat.ex-chat').findOne({
          where: {
            workspaceId: setting.workspaceId,
            channel: setting.channel,
            metaSettingId: setting.documentId,
            status: { $in: ['open', 'pending'] },
            visitorId,
          },
          orderBy: { updatedAt: 'desc' },
        });

        if (!chat) {
          chat = await strapi.db.query('api::ex-chat.ex-chat').create({
            data: {
              workspaceId: setting.workspaceId,
              channel: setting.channel,
              visitorId,
              visitorName,
              visitorAvatar,
              status: 'open',
              unreadCount: 0,
              metaSettingId: setting.documentId,
              metadata: { metaSettingId: setting.documentId, metaMessageId: e.messageId || null },
              publishedAt: new Date(),
            },
          });

          if (io && chat.workspaceId) {
            io.to(`ws:${chat.workspaceId}`).emit('conversation:new', chat);
          }
        }

        const message = await strapi.db.query('api::ex-message.ex-message').create({
          data: {
            chatId: chat.documentId,
            channel: setting.channel,
            content: e.messageText,
            contentType: 'text',
            senderRole: 'visitor',
            senderName: visitorName,
            senderAvatar: visitorAvatar,
            status: 'sent',
            publishedAt: new Date(),
            metadata: e.messageId ? { metaMessageId: e.messageId } : undefined,
          },
        });

        if (io) {
          const messagePayload = {
            ...message,
            conversationId: message.chatId,
          };

          io.to(`conv:${chat.documentId}`).emit('message:new', messagePayload);

          if (chat.workspaceId) {
            io.to(`ws:${chat.workspaceId}`).emit('message:new', messagePayload);
          }
        }

        const updatedChat = await strapi.db.query('api::ex-chat.ex-chat').update({
          where: { id: chat.id },
          data: {
            lastMessage: e.messageText.substring(0, 500),
            lastMessageAt: new Date(),
            lastInboundAt: new Date(),
            unreadCount: (chat.unreadCount || 0) + 1,
          },
        });

        if (io && updatedChat.workspaceId) {
          io.to(`ws:${updatedChat.workspaceId}`).emit('conversation:updated', updatedChat);
        }

        strapi.log.info(`[META] Received message from ${visitorId} in chat ${chat.documentId}`);
      } catch (err) {
        strapi.log.error(`[META] Error processing event: ${err.message}`);
      }
    }

    ctx.status = 200;
    ctx.body = { ok: true };
  },

  async webhook(ctx) {
    return this.callback(ctx);
  },

  async push(ctx) {
    const { chatId, content } = ctx.request.body || {};

    if (!chatId || !content) {
      return ctx.badRequest('chatId and content are required');
    }

    const chat = await strapi.db.query('api::ex-chat.ex-chat').findOne({
      where: { documentId: chatId },
    });

    if (!chat) return ctx.notFound('Chat not found');
    if (!['facebook', 'instagram', 'whatsapp'].includes(chat.channel)) {
      return ctx.badRequest('Chat is not a Meta channel');
    }

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

    if (!setting) return ctx.badRequest('No active channel-setting found for this chat');

    try {
      await metaService.sendMessage({
        channel: chat.channel,
        recipientId: chat.visitorId,
        content,
        setting,
      });
    } catch (err) {
      strapi.log.error(`[META] Push message error: ${err.message}`);
      return ctx.badRequest(`META API error: ${err.message}`);
    }

    const message = await strapi.db.query('api::ex-message.ex-message').create({
      data: {
        chatId: chat.documentId,
        channel: chat.channel,
        content,
        contentType: 'text',
        senderRole: 'agent',
        senderName: 'Agent',
        status: 'sent',
        publishedAt: new Date(),
      },
    });

    const io = getIO();
    if (io) {
      io.to(`conv:${chat.documentId}`).emit('message:new', { ...message, conversationId: message.chatId });

      const updatedChat = await strapi.db.query('api::ex-chat.ex-chat').update({
        where: { id: chat.id },
        data: {
          lastMessage: content.substring(0, 500),
          lastMessageAt: new Date(),
          lastOutboundAt: new Date(),
        },
      });

      if (updatedChat.workspaceId) {
        io.to(`ws:${updatedChat.workspaceId}`).emit('conversation:updated', updatedChat);
      }
    }

    strapi.log.info(`[META] Reply sent to ${chat.visitorId} in chat ${chat.documentId}`);

    ctx.body = { data: message };
  },
};
