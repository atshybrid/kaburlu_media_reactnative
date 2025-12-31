module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Expo Router plugin no longer needed with babel-preset-expo (SDK 50+)
      [
        'module-resolver',
        {
          root: ['.'],
          alias: { '@': './' },
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        },
      ],
      // Keep worklets plugin last
      'react-native-worklets/plugin',
    ],
  };
};
