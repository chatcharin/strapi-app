const defaultOrigins = ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:8080','https://ai.cnxpos.com'];
const origins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const allowedOrigins = origins.length > 0 ? origins : defaultOrigins;

module.exports = [
  'strapi::logger',
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'frame-ancestors': ['self', ...allowedOrigins],
        },
      },
    },
  },
  {
    name: 'strapi::cors',
    config: {
      origin: allowedOrigins,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization', 'Origin', 'Accept', 'Access-Control-Allow-Origin', 'X-Workspace-Id', 'X-Line-Retry-Key'],
      credentials: true,
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  {
    name: 'strapi::body',
    config: {
      includeUnparsed: true,
    },
  },
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
