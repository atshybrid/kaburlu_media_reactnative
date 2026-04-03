const appJson = require('./app.json');

module.exports = () => {
  const disableOta = process.env.KABURLU_DISABLE_OTA === '1';
  const expoConfig = appJson.expo;

  if (!disableOta) {
    return expoConfig;
  }

  const updatedPlugins = (expoConfig.plugins || []).map((plugin) => {
    if (Array.isArray(plugin) && plugin[0] === 'expo-updates') {
      return ['expo-updates', { ...(plugin[1] || {}), checkAutomatically: 'NEVER' }];
    }
    return plugin;
  });

  return {
    ...expoConfig,
    plugins: updatedPlugins,
    updates: {
      ...(expoConfig.updates || {}),
      enabled: false,
      checkAutomatically: 'NEVER',
      fallbackToCacheTimeout: 0,
    },
  };
};