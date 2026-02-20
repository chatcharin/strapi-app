'use strict';

const crypto = require('crypto');

const GRAPH_API_VERSION = 'v24.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

const getLogger = () => {
  if (global.strapi && global.strapi.log) return global.strapi.log;
  // eslint-disable-next-line no-console
  return console;
};

const getRawBodyString = (ctx) => {
  const raw = ctx.request.body && ctx.request.body[Symbol.for('unparsedBody')];
  if (typeof raw === 'string') return raw;
  if (Buffer.isBuffer(raw)) return raw.toString('utf8');
  if (typeof ctx.request.body === 'string') return ctx.request.body;
  return JSON.stringify(ctx.request.body || {});
};

const verifyMetaSignature = (rawBody, appSecret, signatureHeader) => {
  if (!signatureHeader || typeof signatureHeader !== 'string') return false;
  if (!signatureHeader.startsWith('sha256=')) return false;

  const theirSigHex = signatureHeader.slice('sha256='.length);
  if (!theirSigHex) return false;

  const ourSigHex = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

  const a = Buffer.from(ourSigHex, 'hex');
  const b = Buffer.from(theirSigHex, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

const graphFetch = async (path, options = {}) => {
  const logger = getLogger();

  const { method = 'GET', accessToken, params, body } = options;

  const url = new URL(`${GRAPH_API_BASE}${path.startsWith('/') ? '' : '/'}${path}`);
  if (params && typeof params === 'object') {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  if (accessToken) {
    url.searchParams.set('access_token', accessToken);
  }

  logger.debug(`[META] graphFetch request method=${method} url=${url.pathname}`);

  const res = await fetch(url.toString(), {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await res.json().catch(() => null) : await res.text().catch(() => '');

  if (!res.ok) {
    const msg = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const err = new Error(msg || `${res.status} ${res.statusText}`);
    Object.assign(err, { status: res.status, payload });
    throw err;
  }

  return payload;
};

const extractEvents = (channel, body) => {
  if (channel === 'whatsapp') {
    const out = [];
    const entries = (body && body.entry) || [];

    for (const entry of entries) {
      const changes = (entry && entry.changes) || [];
      for (const change of changes) {
        if (!change || change.field !== 'messages') continue;
        const value = change.value || {};
        const contacts = value.contacts || [];
        const messages = value.messages || [];

        for (const msg of messages) {
          if (!msg || msg.type !== 'text') continue;
          const waId = msg.from;
          const name = (contacts.find((c) => c && c.wa_id === waId) || {}).profile?.name;

          out.push({
            senderId: waId,
            senderName: name || waId,
            messageText: msg.text && msg.text.body,
            messageId: msg.id || null,
          });
        }
      }
    }

    return out;
  }

  const out = [];
  const entries = (body && body.entry) || [];
  for (const entry of entries) {
    const messaging = (entry && entry.messaging) || [];
    for (const m of messaging) {
      if (!m || !m.message || m.message.is_echo) continue;
      if (!m.sender || !m.sender.id) continue;
      if (!m.message.text) continue;

      out.push({
        senderId: m.sender.id,
        senderName: null,
        messageText: m.message.text,
        messageId: (m.message && m.message.mid) || null,
      });
    }
  }
  return out;
};

const getProfile = async ({ channel, userId, setting }) => {
  if (!setting || !setting.accessToken) {
    return { name: userId, avatar: null, fetched: false };
  }

  if (channel === 'whatsapp') {
    return { name: userId, avatar: null, fetched: false };
  }

  try {
    const res = await graphFetch(`/${encodeURIComponent(userId)}`, {
      method: 'GET',
      accessToken: setting.accessToken,
      params: { fields: 'name,profile_pic' },
    });

    return {
      name: (res && (res.name || res.username)) || userId,
      avatar: (res && res.profile_pic) || null,
      fetched: true,
    };
  } catch (err) {
    const logger = getLogger();
    logger.info(`[META] Could not fetch profile for ${userId} channel=${channel}: ${err.message}`);
    return { name: userId, avatar: null, fetched: false };
  }
};

const sendMessage = async ({ channel, recipientId, content, setting }) => {
  const logger = getLogger();
  logger.info(
    `[META] sendMessage channel=${channel} recipientId=${recipientId} settingId=${setting.documentId} contentLength=${String(content).length} preview=${String(
      content
    ).substring(0, 80)}`
  );

  if (channel === 'whatsapp') {
    const phoneNumberId = setting.metadata && setting.metadata.phoneNumberId;
    if (!phoneNumberId) throw new Error('Missing metadata.phoneNumberId for WhatsApp');

    await graphFetch(`/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: 'POST',
      accessToken: setting.accessToken,
      body: {
        messaging_product: 'whatsapp',
        to: recipientId,
        type: 'text',
        text: { body: content },
      },
    });

    return;
  }

  await graphFetch('/me/messages', {
    method: 'POST',
    accessToken: setting.accessToken,
    body: {
      recipient: { id: recipientId },
      message: { text: content },
      messaging_type: 'RESPONSE',
    },
  });
};

const getSettingAvatar = async ({ channel, accountId, accessToken }) => {
  if (!accessToken || !accountId) return null;
  if (channel === 'whatsapp') return null;

  if (channel === 'instagram') {
    const res = await graphFetch(`/${encodeURIComponent(accountId)}`, {
      method: 'GET',
      accessToken,
      params: { fields: 'profile_picture_url,username' },
    });

    return (res && res.profile_picture_url) || null;
  }

  const res = await graphFetch(`/${encodeURIComponent(accountId)}`, {
    method: 'GET',
    accessToken,
    params: { fields: 'picture.type(square){url},name' },
  });

  const url = res && res.picture && res.picture.data && res.picture.data.url;
  return url || null;
};

module.exports = {
  GRAPH_API_VERSION,
  getRawBodyString,
  verifyMetaSignature,
  extractEvents,
  getProfile,
  getSettingAvatar,
  sendMessage,
};
