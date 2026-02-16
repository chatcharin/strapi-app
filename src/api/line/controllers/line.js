'use strict';

const crypto = require('crypto');
const { getIO } = require('../../../socket');

const getRawBodyString = (ctx) => {
  const raw = ctx.request.body && ctx.request.body[Symbol.for('unparsedBody')];
  if (typeof raw === 'string') return raw;
  if (Buffer.isBuffer(raw)) return raw.toString('utf8');
  if (typeof ctx.request.body === 'string') return ctx.request.body;
  return JSON.stringify(ctx.request.body || {});
};

const validateLineSignature = (rawBody, channelSecret, signatureHeader) => {
  if (!signatureHeader) return false;
  const hmac = crypto.createHmac('SHA256', channelSecret);
  hmac.update(rawBody);
  const digest = hmac.digest();
  const signatureBuffer = Buffer.from(signatureHeader, 'base64');
  if (digest.length !== signatureBuffer.length) return false;
  return crypto.timingSafeEqual(digest, signatureBuffer);
};

/**
 * @typedef {Object} LineFetchOptions
 * @property {string} [method='GET']
 * @property {string} [accessToken]
 * @property {string} [retryKey]
 * @property {any} [body]
 */

/**
 * @param {string} path
 * @param {LineFetchOptions} options
 * @returns {Promise<any>}
 */
const lineFetch = async (path, { method = 'GET', accessToken, retryKey, body } = {}) => {
  const res = await fetch(`https://api.line.me${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(retryKey ? { 'X-Line-Retry-Key': retryKey } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const msg = text || `${res.status} ${res.statusText}`;
    const err = /** @type {Error & { status?: number }} */ (new Error(msg));
    err.status = res.status;
    throw err;
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return res.json();
  return res.text();
};

module.exports = {
  async callback(ctx) {
    const { settingId } = ctx.params;

    const setting = await strapi.db.query('api::line-setting.line-setting').findOne({
      where: { documentId: settingId },
    });

    if (!setting || !setting.isActive) {
      ctx.status = 200;
      ctx.body = { ok: true };
      return;
    }

    const signature = ctx.request.headers['x-line-signature'];
    const rawBody = getRawBodyString(ctx);

    const isValid = validateLineSignature(rawBody, setting.channelSecret, signature);
    if (!isValid) {
      strapi.log.warn(`[LINE-RAW] Invalid signature for setting ${settingId}`);
      ctx.status = 200;
      ctx.body = { ok: true };
      return;
    }

    const body = ctx.request.body;
    const events = (body && body.events) || [];
    const io = getIO();

    for (const event of events) {
      try {
        if (!event || event.type !== 'message') continue;
        if (!event.message || event.message.type !== 'text') continue;

        // Deduplicate inbound webhook redelivery using webhookEventId
        if (event.webhookEventId) {
          const existingMessage = await strapi.db.query('api::ex-message.ex-message').findOne({
            where: { metadata: { lineEventId: event.webhookEventId } },
          });
          if (existingMessage) {
            strapi.log.info(`[LINE] Duplicate event detected, skipping: ${event.webhookEventId}`);
            continue;
          }
        }

        const lineUserId = event.source && event.source.userId;
        if (!lineUserId) continue;

        let visitorName = lineUserId;
        let visitorAvatar = null;

        try {
          const profile = await lineFetch(`/v2/bot/profile/${encodeURIComponent(lineUserId)}`, {
            method: 'GET',
            accessToken: setting.channelAccessToken,
          });
          visitorName = profile.displayName || lineUserId;
          visitorAvatar = profile.pictureUrl || null;
        } catch (profileErr) {
          strapi.log.warn(`[LINE-RAW] Could not fetch profile for ${lineUserId}: ${profileErr.message}`);
        }

        let chat = await strapi.db.query('api::ex-chat.ex-chat').findOne({
          where: {
            workspaceId: setting.workspaceId,
            channel: 'line',
            visitorId: lineUserId,
            status: { $in: ['open', 'pending'] },
          },
          orderBy: { updatedAt: 'desc' },
        });

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
              metadata: { lineSettingId: setting.documentId },
              publishedAt: new Date(),
            },
          });

          if (io && chat.workspaceId) {
            io.to(`ws:${chat.workspaceId}`).emit('conversation:new', chat);
          }
        } else if (visitorName !== chat.visitorName || visitorAvatar !== chat.visitorAvatar) {
          await strapi.db.query('api::ex-chat.ex-chat').update({
            where: { id: chat.id },
            data: { visitorName, visitorAvatar },
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

    const lineSettingId = chat.metadata && chat.metadata.lineSettingId;
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

    try {
      const retryKey = crypto.randomUUID();
      await lineFetch('/v2/bot/message/push', {
        method: 'POST',
        accessToken: setting.channelAccessToken,
        retryKey,
        body: {
          to: chat.visitorId,
          messages: [{ type: 'text', text: content }],
        },
      });
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
