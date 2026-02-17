'use strict';

const { getIO } = require('../../../socket');
const lineService = require('../services/line');

module.exports = {
  async callback(ctx) {
    const { settingId } = ctx.params;

    const setting = await strapi.db.query('api::line-setting.line-setting').findOne({
      where: { documentId: settingId },
    });

    if (!setting || !setting.isActive) {
      strapi.log.warn(
        `[LINE] Callback ignored for settingId=${settingId} (${!setting ? 'setting not found' : 'setting inactive'})`
      );
      ctx.status = 200;
      ctx.body = { ok: true };
      return;
    }

    const signature = ctx.request.headers['x-line-signature'];
    const rawBody = lineService.getRawBodyString(ctx);

    const isValid = lineService.validateLineSignature(rawBody, setting.channelSecret, signature);
    if (!isValid) {
      strapi.log.warn(`[LINE-RAW] Invalid signature for setting ${settingId}`);
      ctx.status = 200;
      ctx.body = { ok: true };
      return;
    }

    const body = ctx.request.body;
    const events = (body && body.events) || [];
    const io = getIO();

    strapi.log.info(`[LINE] Callback received settingId=${settingId} events=${events.length}`);

    for (const event of events) {
      try {
        if (!event || event.type !== 'message') continue;
        if (!event.message || event.message.type !== 'text') continue;

        // Deduplicate inbound webhook redelivery using webhookEventId
        if (event.webhookEventId) {
          const existingMessage = await strapi.db.query('api::ex-message.ex-message').findOne({
            where: { lineEventId: event.webhookEventId },
          });
          if (existingMessage) {
            strapi.log.info(`[LINE] Duplicate event detected, skipping: ${event.webhookEventId}`);
            continue;
          }
        }

        const lineUserId = event.source && event.source.userId;
        if (!lineUserId) continue;

        const lineVisitorKey = `line:${setting.documentId}:${lineUserId}`;
        const legacyLineVisitorKey = `line:${lineUserId}`;

        let visitorName = lineUserId;
        let visitorAvatar = null;
        let profileFetched = false;

        try {
          const profile = await lineService.lineFetch(`/v2/bot/profile/${encodeURIComponent(lineUserId)}`, {
            method: 'GET',
            accessToken: setting.channelAccessToken,
          });
          visitorName = profile.displayName || lineUserId;
          visitorAvatar = profile.pictureUrl || null;
          profileFetched = true;
        } catch (profileErr) {
          strapi.log.info(`[LINE-RAW] Could not fetch profile for ${lineUserId}: ${profileErr.message}`);
        }

        strapi.log.info(
          `[LINE] visitor resolve pre-chat settingId=${setting.documentId} workspaceId=${setting.workspaceId} lineUserId=${lineUserId} profileFetched=${profileFetched} name=${visitorName}`
        );

        let chat = await strapi.db.query('api::ex-chat.ex-chat').findOne({
          where: {
            workspaceId: setting.workspaceId,
            channel: 'line',
            lineSettingId: setting.documentId,
            status: { $in: ['open', 'pending'] },
            visitorId: { $in: [lineUserId, legacyLineVisitorKey, lineVisitorKey] },
          },
          orderBy: { updatedAt: 'desc' },
        });

        if (chat && !profileFetched) {
          visitorName = chat.visitorName || visitorName;
          visitorAvatar = chat.visitorAvatar || visitorAvatar;
        }

        if (!chat && !profileFetched) {
          visitorName = 'Unknown User (Profile Error)';
          visitorAvatar = null;
        }

        strapi.log.info(
          `[LINE] visitor resolved settingId=${setting.documentId} workspaceId=${setting.workspaceId} lineUserId=${lineUserId} chat=${chat ? chat.documentId : 'new'} name=${visitorName}`
        );

        if (!chat) {
          chat = await strapi.db.query('api::ex-chat.ex-chat').create({
            data: {
              workspaceId: setting.workspaceId,
              channel: 'line',
              visitorId: lineUserId,
              visitorName,
              visitorAvatar,
              status: 'open',
              unreadCount: 0,
              lineSettingId: setting.documentId,
              lineChannelId: setting.channelId || null,
              lineSettingName: setting.name || null,
              lineUserId,
              metadata: { lineSettingId: setting.documentId, lineUserId },
              publishedAt: new Date(),
            },
          });

          if (io && chat.workspaceId) {
            io.to(`ws:${chat.workspaceId}`).emit('conversation:new', chat);
          }
        } else if (profileFetched && (visitorName !== chat.visitorName || visitorAvatar !== chat.visitorAvatar)) {
          await strapi.db.query('api::ex-chat.ex-chat').update({
            where: { id: chat.id },
            data: { visitorName, visitorAvatar },
          });
        }

        if (chat && (!chat.lineSettingId || !chat.lineUserId || !chat.lineChannelId || !chat.lineSettingName)) {
          await strapi.db.query('api::ex-chat.ex-chat').update({
            where: { id: chat.id },
            data: {
              lineSettingId: chat.lineSettingId || setting.documentId,
              lineChannelId: chat.lineChannelId || setting.channelId || null,
              lineSettingName: chat.lineSettingName || setting.name || null,
              lineUserId: chat.lineUserId || lineUserId,
            },
          });
        }

        const message = await strapi.db.query('api::ex-message.ex-message').create({
          data: {
            chatId: chat.documentId,
            channel: 'line',
            content: event.message.text,
            contentType: 'text',
            senderRole: 'visitor',
            senderName: visitorName,
            senderAvatar: visitorAvatar,
            status: 'sent',
            publishedAt: new Date(),
            lineEventId: event.webhookEventId || null,
            metadata: event.webhookEventId ? { lineEventId: event.webhookEventId } : undefined,
          },
        });

        if (io) {
          io.to(`conv:${chat.documentId}`).emit('message:new', { ...message, conversationId: message.chatId });
        }

        const updatedChat = await strapi.db.query('api::ex-chat.ex-chat').update({
          where: { id: chat.id },
          data: {
            lastMessage: event.message.text.substring(0, 500),
            lastMessageAt: new Date(),
            unreadCount: (chat.unreadCount || 0) + 1,
          },
        });

        if (io && updatedChat.workspaceId) {
          io.to(`ws:${updatedChat.workspaceId}`).emit('conversation:updated', updatedChat);
        }

        strapi.log.info(`[LINE-RAW] Received message from ${lineUserId} in chat ${chat.documentId}`);
      } catch (eventErr) {
        strapi.log.error(`[LINE-RAW] Error processing event: ${eventErr.message}`);
      }
    }

    ctx.status = 200;
    ctx.body = { ok: true };
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
    if (chat.channel !== 'line') return ctx.badRequest('Chat is not a LINE channel');

    const deriveLineUserIdFromVisitorId = (visitorId) => {
      if (!visitorId || typeof visitorId !== 'string') return visitorId;
      if (!visitorId.startsWith('line:')) return visitorId;
      // Supported formats:
      // - line:<userId>
      // - line:<settingId>:<userId>
      const parts = visitorId.split(':');
      if (parts.length >= 3) return parts.slice(2).join(':');
      return parts.slice(1).join(':');
    };

    const lineUserId = chat.lineUserId || (chat.metadata && chat.metadata.lineUserId) || deriveLineUserIdFromVisitorId(chat.visitorId);

    if (!lineUserId) return ctx.badRequest('Missing LINE user id');

    const lineSettingId = chat.lineSettingId || (chat.metadata && chat.metadata.lineSettingId);
    let setting = null;

    if (lineSettingId) {
      setting = await strapi.db.query('api::line-setting.line-setting').findOne({
        where: { documentId: lineSettingId, isActive: true },
      });
    }

    if (!setting) {
      setting = await strapi.db.query('api::line-setting.line-setting').findOne({
        where: { workspaceId: chat.workspaceId, isActive: true },
      });
    }

    if (!setting) return ctx.badRequest('No active LINE setting found for this workspace');

    strapi.log.info(
      `[LINE] push request chatId=${chatId} workspaceId=${chat.workspaceId} lineSettingId=${setting.documentId} lineChannelId=${setting.channelId || ''} lineUserId=${lineUserId} contentLength=${String(
        content
      ).length} preview=${String(content).substring(0, 80)}`
    );

    try {
      await lineService.sendMessageToLine(lineUserId, content, setting.channelAccessToken);
    } catch (lineErr) {
      strapi.log.error(`[LINE-RAW] Push message error: ${lineErr.message}`);
      return ctx.badRequest(`LINE API error: ${lineErr.message}`);
    }

    const message = await strapi.db.query('api::ex-message.ex-message').create({
      data: {
        chatId: chat.documentId,
        channel: 'line',
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
        },
      });

      if (updatedChat.workspaceId) {
        io.to(`ws:${updatedChat.workspaceId}`).emit('conversation:updated', updatedChat);
      }
    }

    strapi.log.info(`[LINE-RAW] Reply sent to ${chat.visitorId} in chat ${chat.documentId}`);

    ctx.body = { data: message };
  },
};
