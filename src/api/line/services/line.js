'use strict';

const crypto = require('crypto');

const getLogger = () => {
  if (global.strapi && global.strapi.log) return global.strapi.log;
  // eslint-disable-next-line no-console
  return console;
};

/**
 * Get raw body string from request for signature validation
 */
const getRawBodyString = (ctx) => {
  const raw = ctx.request.body && ctx.request.body[Symbol.for('unparsedBody')];
  if (typeof raw === 'string') return raw;
  if (Buffer.isBuffer(raw)) return raw.toString('utf8');
  if (typeof ctx.request.body === 'string') return ctx.request.body;
  return JSON.stringify(ctx.request.body || {});
};

/**
 * Validate LINE webhook signature
 * @param {string} rawBody - Raw request body
 * @param {string} channelSecret - LINE channel secret
 * @param {string} signatureHeader - X-Line-Signature header value
 * @returns {boolean}
 */
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
 * Fetch LINE API
 * @param {string} path - API path (e.g., '/v2/bot/message/push')
 * @param {Object} options - Fetch options
 * @param {string} [options.method='GET'] - HTTP method
 * @param {string} options.accessToken - LINE channel access token
 * @param {string} [options.retryKey] - Retry key for idempotency
 * @param {any} [options.body] - Request body
 * @returns {Promise<any>}
 */
const lineFetch = async (path, options) => {
  const { method = 'GET', accessToken, retryKey, body } = options || {};

  const logger = getLogger();

  if (!accessToken) {
    throw new Error('accessToken is required');
  }

  logger.debug(
    `[LINE] lineFetch request method=${method} path=${path} retryKey=${retryKey || ''} hasBody=${Boolean(body)}`
  );

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

    logger.debug(
      `[LINE] lineFetch response status=${res.status} path=${path} retryKey=${retryKey || ''} error=${msg}`
    );

    const err = new Error(msg);
    Object.assign(err, { status: res.status });
    throw err;
  }

  logger.debug(`[LINE] lineFetch response status=${res.status} path=${path} retryKey=${retryKey || ''}`);

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return res.json();
  return res.text();
};

/**
 * Send message to LINE user
 * @param {string} visitorId - LINE user ID
 * @param {string} content - Message content
 * @param {string} channelAccessToken - LINE channel access token
 * @returns {Promise<void>}
 */
const sendMessageToLine = async (visitorId, content, channelAccessToken) => {
  const retryKey = crypto.randomUUID();

  const logger = getLogger();
  logger.info(
    `[LINE] sendMessageToLine to=${visitorId} retryKey=${retryKey} contentLength=${String(content).length} preview=${String(
      content
    ).substring(0, 80)}`
  );

  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${channelAccessToken}`,
      'Content-Type': 'application/json',
      'X-Line-Retry-Key': retryKey,
    },
    body: JSON.stringify({
      to: visitorId,
      messages: [{ type: 'text', text: content }],
    }),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    logger.error(
      `[LINE] sendMessageToLine failed to=${visitorId} retryKey=${retryKey} status=${res.status} error=${errorText}`
    );
    throw new Error(`LINE API error: ${res.status} ${errorText}`);
  }

  logger.info(`[LINE] sendMessageToLine success to=${visitorId} retryKey=${retryKey} status=${res.status}`);
};

module.exports = {
  getRawBodyString,
  validateLineSignature,
  lineFetch,
  sendMessageToLine,
};
