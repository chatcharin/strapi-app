const { mergeConfig } = require('vite');

module.exports = (config) => {
  return mergeConfig(config, {
    server: {
      allowedHosts: ['moriah-postseason-connie.ngrok-free.dev', '.ngrok-free.dev'],
    },
  });
};
