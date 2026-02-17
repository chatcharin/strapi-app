'use strict';

const { Server } = require('socket.io');
const lineService = require('./api/line/services/line');

let io = null;

const isNumericId = (value) => {
  if (typeof value !== 'string' && typeof value !== 'number') return false;
  const str = String(value);
  return str.trim() !== '' && !Number.isNaN(Number(str));
};

const defaultOrigins = ['http://localhost:5173', 'http://localhost:3000'];
const origins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const allowedOrigins = origins.length > 0 ? origins : defaultOrigins;

const resolveChatIdToDocumentId = async (strapi, chatId) => {
  if (!chatId) return null;
  if (!isNumericId(chatId)) return chatId;

  const chat = await strapi.db.query('api::ex-chat.ex-chat').findOne({
    where: { id: Number(chatId) },
    select: ['documentId'],
  });

  return chat ? chat.documentId : null;
};

function initSocket(strapi) {
  const httpServer = strapi.server.httpServer;

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    strapi.log.info(`[Socket.IO] Client connected: ${socket.id}`);

    // --- Room management ---

    socket.on('workspace:join', ({ workspaceId }) => {
      if (!workspaceId) return;
      const room = `ws:${workspaceId}`;
      socket.join(room);
      strapi.log.info(`[Socket.IO] ${socket.id} joined ${room}`);
    });

    socket.on('workspace:leave', ({ workspaceId }) => {
      if (!workspaceId) return;
      const room = `ws:${workspaceId}`;
      socket.leave(room);
      strapi.log.info(`[Socket.IO] ${socket.id} left ${room}`);
    });

    socket.on('conversation:join', ({ chatId, conversationId }) => {
      const rawChatId = chatId || conversationId;
      if (!rawChatId) return;

      resolveChatIdToDocumentId(strapi, rawChatId)
        .then((chatDocumentId) => {
          if (!chatDocumentId) return;
          const room = `conv:${chatDocumentId}`;
          socket.join(room);
          strapi.log.info(`[Socket.IO] ${socket.id} joined ${room}`);
        })
        .catch((err) => {
          strapi.log.error(`[Socket.IO] conversation:join error: ${err.message}`);
        });
    });

    socket.on('conversation:leave', ({ chatId, conversationId }) => {
      const rawChatId = chatId || conversationId;
      if (!rawChatId) return;

      resolveChatIdToDocumentId(strapi, rawChatId)
        .then((chatDocumentId) => {
          if (!chatDocumentId) return;
          const room = `conv:${chatDocumentId}`;
          socket.leave(room);
          strapi.log.info(`[Socket.IO] ${socket.id} left ${room}`);
        })
        .catch((err) => {
          strapi.log.error(`[Socket.IO] conversation:leave error: ${err.message}`);
        });
    });

    // --- Message handling ---

    socket.on('message:send', async (payload) => {
      try {
        const { chatId, conversationId, channel, content, contentType, senderRole, senderName, senderAvatar, fileUrl } = payload || {};
        const rawChatId = chatId || conversationId;

        if (!rawChatId || !content) {
          socket.emit('message:error', { error: 'chatId (or conversationId) and content are required' });
          return;
        }

        const chatDocumentId = await resolveChatIdToDocumentId(strapi, rawChatId);
        if (!chatDocumentId) {
          socket.emit('message:error', { error: 'Invalid chatId' });
          return;
        }

        // Save message to DB
        const message = await strapi.db
          .query('api::ex-message.ex-message')
          .create({
            data: {
              chatId: chatDocumentId,
              channel: channel || 'widget',
              content,
              contentType: contentType || 'text',
              senderRole: senderRole || 'visitor',
              senderName: senderName || null,
              senderAvatar: senderAvatar || null,
              fileUrl: fileUrl || null,
              status: 'sent',
              publishedAt: new Date(),
            },
          });

        // Broadcast to chat room (include legacy alias conversationId)
        const messagePayload = {
          ...message,
          conversationId: message.chatId,
        };
        io.to(`conv:${chatDocumentId}`).emit('message:new', messagePayload);

        // Update chat lastMessage / lastMessageAt / unreadCount
        const chat = await strapi.db
          .query('api::ex-chat.ex-chat')
          .findOne({ where: { documentId: chatDocumentId } });

        if (chat) {
          const updateData = {
            lastMessage: content.substring(0, 500),
            lastMessageAt: new Date(),
          };

          // Increment unreadCount only for visitor messages
          if (senderRole === 'visitor') {
            updateData.unreadCount = (chat.unreadCount || 0) + 1;
          }

          const updatedChat = await strapi.db
            .query('api::ex-chat.ex-chat')
            .update({
              where: { id: chat.id },
              data: updateData,
            });

          // Broadcast conversation update to workspace room
          if (chat.workspaceId) {
            io.to(`ws:${chat.workspaceId}`).emit('conversation:updated', updatedChat);
          }

          // Auto-send LINE reply when agent sends message to a LINE chat
          if (senderRole === 'agent' && chat.channel === 'line') {
            try {
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

              if (setting && chat.visitorId) {
                await lineService.sendMessageToLine(chat.visitorId, content, setting.channelAccessToken);
                strapi.log.info(`[LINE] Auto-reply sent to ${chat.visitorId} in conv:${chatDocumentId}`);
              }
            } catch (lineErr) {
              strapi.log.error(`[LINE] Auto-reply error: ${lineErr.message}`);
            }
          }
        }

        strapi.log.info(`[Socket.IO] message:send from ${socket.id} in conv:${chatDocumentId}`);
      } catch (err) {
        strapi.log.error(`[Socket.IO] message:send error: ${err.message}`);
        socket.emit('message:error', { error: err.message });
      }
    });

    socket.on('disconnect', (reason) => {
      strapi.log.info(`[Socket.IO] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  strapi.log.info('[Socket.IO] Server initialized on Strapi HTTP server');
  return io;
}

function getIO() {
  return io;
}

module.exports = { initSocket, getIO };
