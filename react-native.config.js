module.exports = {
  dependencies: {
    // react-native-in-app-updates is Android-only (Google Play In-App Update API).
    // Disable iOS autolinking to prevent a broken pod from being added to the iOS build.
    'react-native-in-app-updates': {
      platforms: {
        ios: null,
      },
    },
  },
};
