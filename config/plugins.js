module.exports = () => ({
  documentation: {
    enabled: true,
    config: {
      openapi: {
        info: {
          version: '3.0.0',
          title: 'Documentation',
          description: 'API documentation',
        },
        servers: [
          {
            url: 'http://localhost:1337',
            description: 'Development server',
          },
        ],
      },
    },
  },
});
