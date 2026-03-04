'use strict';

const metaService = require('../services/meta');
const { getIO } = require('../../../socket');

module.exports = {
  async callback(ctx) {
    const { settingId } = ctx.params;
    const mode = ctx.query['hub.mode'];
    const verifyToken = ctx.query['hub.verify_token'];
    const challenge = ctx.query['hub.challenge'];

    const debugEnabled = String(process.env.META_WEBHOOK_DEBUG || '').toLowerCase() === 'true';
    const reqId = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

    const safePreview = (v, max = 600) => {
      try {
        const s = typeof v === 'string' ? v : JSON.stringify(v);
        if (!s) return '';
        return s.length > max ? `${s.slice(0, max)}...` : s;
      } catch (e) {
        return '';
      }
    };

    const inferChannelFromBody = (body, fallback) => {
      if (body && typeof body.object === 'string') {
        const obj = body.object.toLowerCase();
        if (obj === 'instagram') return 'instagram';
        if (obj === 'page') return 'facebook';
        if (obj === 'whatsapp_business_account') return 'whatsapp';
      }
      return fallback;
    };

    const processEventsForSetting = async ({ setting, inferredChannel, events, io }) => {
      for (const e of events) {
        try {
          if (!e || !e.senderId || !e.messageText) continue;

          const visitorId = e.senderId;

          let visitorName = visitorId;
          let visitorAvatar = null;

          if (inferredChannel === 'whatsapp' && e.senderName) {
            visitorName = e.senderName;
          } else {
            const profile = await metaService.getProfile({ channel: inferredChannel, userId: visitorId, setting });
            visitorName = profile.name;
            visitorAvatar = profile.avatar;
          }

          let chat = await strapi.db.query('api::ex-chat.ex-chat').findOne({
            where: {
              workspaceId: setting.workspaceId,
              channel: inferredChannel,
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
                channel: inferredChannel,
                visitorId,
                visitorName,
                visitorAvatar,
                status: 'open',
                unreadCount: 0,
                metaSettingId: setting.documentId,
                metadata: {
                  metaSettingId: setting.documentId,
                  metaMessageId: e.messageId || null,
                  metaChannel: inferredChannel,
                },
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
              channel: inferredChannel,
              content: e.messageText,
              contentType: 'text',
              senderRole: 'visitor',
              senderName: visitorName,
              senderAvatar: visitorAvatar,
              status: 'sent',
              publishedAt: new Date(),
              metadata: e.messageId ? { metaMessageId: e.messageId, metaChannel: inferredChannel } : { metaChannel: inferredChannel },
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

          strapi.log.info(
            `[META] Received message from ${visitorId} in chat ${chat.documentId} channel=${inferredChannel} settingId=${setting.documentId}`
          );
        } catch (eventErr) {
          strapi.log.error(`[META] Error processing event: ${eventErr.message}`);
        }
      }
    };

    // GET: webhook verification
    if (ctx.method === 'GET') {
      strapi.log.info(
        `[META] Webhook GET received reqId=${reqId} settingId=${settingId || '-'} mode=${mode || '-'} verifyTokenProvided=${Boolean(
          verifyToken
        )}`
      );

      if (debugEnabled) {
        strapi.log.info(`[META] Webhook GET debug reqId=${reqId} query=${safePreview(ctx.query, 800)}`);
      }

      // New global webhook URL (no settingId): accept if verifyToken matches any active meta-setting
      if (!settingId) {
        const setting = await strapi.db.query('api::meta-setting.meta-setting').findOne({
          where: { isActive: true, verifyToken },
        });

        if (mode === 'subscribe' && setting) {
          ctx.status = 200;
          ctx.body = challenge;
          return;
        }

        ctx.status = 403;
        ctx.body = 'Verification failed';
        return;
      }

      // Legacy per-setting URL
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
    const body = ctx.request.body;
    const signature = ctx.request.headers['x-hub-signature-256'];
    const rawBody = metaService.getRawBodyString(ctx);
    const io = getIO();

    strapi.log.info(
      `[META] Webhook POST received reqId=${reqId} settingId=${settingId || '-'} signatureProvided=${Boolean(
        signature
      )} rawBodyLength=${rawBody ? rawBody.length : 0} object=${body && body.object ? String(body.object) : '-'}`
    );

    if (debugEnabled) {
      const entryIds = Array.isArray(body && body.entry) ? body.entry.map((e) => (e && e.id ? String(e.id) : null)).filter(Boolean) : [];
      strapi.log.info(`[META] Webhook POST debug reqId=${reqId} entryIds=${JSON.stringify(entryIds)}`);
      strapi.log.info(`[META] Webhook POST debug reqId=${reqId} headers.xHubSignature256=${safePreview(signature || '', 120)}`);
      strapi.log.info(`[META] Webhook POST debug reqId=${reqId} rawBodyPreview=${safePreview(rawBody || '', 800)}`);
      strapi.log.info(`[META] Webhook POST debug reqId=${reqId} bodyKeys=${safePreview(body && typeof body === 'object' ? Object.keys(body) : [], 300)}`);
    }

    // New global webhook URL (no settingId): route by entry.id -> meta-setting.accountId
    if (!settingId) {
      const inferredChannel = inferChannelFromBody(body, null);
      const entries = (body && body.entry) || [];

      if (!inferredChannel) {
        strapi.log.warn('[META] Global webhook ignored: could not infer channel from payload');
        ctx.status = 200;
        ctx.body = { ok: true };
        return;
      }

      if (!signature) {
        strapi.log.warn('[META] Global webhook ignored: missing x-hub-signature-256 header');
        ctx.status = 200;
        ctx.body = { ok: true };
        return;
      }

      strapi.log.info(
        `[META] Global webhook received reqId=${reqId} channel=${inferredChannel} entries=${entries.length}`
      );

      for (const entry of entries) {
        try {
          const accountId = entry && entry.id ? String(entry.id) : null;
          if (!accountId) continue;

          const setting = await strapi.db.query('api::meta-setting.meta-setting').findOne({
            where: { isActive: true, channel: inferredChannel, accountId },
          });

          if (!setting) {
            strapi.log.warn(
              `[META] Global webhook: no meta-setting found for channel=${inferredChannel} accountId=${accountId} (check meta-setting.channel + meta-setting.accountId)`
            );
            continue;
          }

          const isValid = metaService.verifyMetaSignature(rawBody, setting.appSecret, signature);
          if (!isValid) {
            strapi.log.warn(
              `[META] Global webhook invalid signature for channel=${inferredChannel} accountId=${accountId} settingId=${setting.documentId}`
            );
            continue;
          }

          const subBody = { ...body, entry: [entry] };
          const events = metaService.extractEvents(inferredChannel, subBody);

          strapi.log.info(
            `[META] Global webhook routed reqId=${reqId} channel=${inferredChannel} accountId=${accountId} settingId=${setting.documentId} workspaceId=${setting.workspaceId} events=${events.length}`
          );

          if (!events || events.length === 0) {
            const keys = body && typeof body === 'object' ? Object.keys(body) : [];
            strapi.log.warn(
              `[META] Global webhook: extracted 0 events for channel=${inferredChannel} accountId=${accountId}. bodyKeys=${JSON.stringify(keys)} (might be non-message event type)`
            );
          }

          await processEventsForSetting({ setting, inferredChannel, events, io });
        } catch (err) {
          strapi.log.error(`[META] Global webhook error: ${err.message}`);
        }
      }

      ctx.status = 200;
      ctx.body = { ok: true };
      return;
    }

    // Legacy per-setting URL
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

    const isValid = metaService.verifyMetaSignature(rawBody, setting.appSecret, signature);
    if (!isValid) {
      strapi.log.warn(`[META] Invalid signature for settingId=${settingId}`);
      ctx.status = 200;
      ctx.body = { ok: true };
      return;
    }

    const inferredChannel = inferChannelFromBody(body, setting.channel);
    const events = metaService.extractEvents(inferredChannel, body);

    strapi.log.info(
      `[META] Webhook received settingId=${settingId} channel=${setting.channel} inferredChannel=${inferredChannel} events=${events.length}`
    );

    await processEventsForSetting({ setting, inferredChannel, events, io });

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
