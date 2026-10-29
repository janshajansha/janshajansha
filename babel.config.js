module.exports = function (api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./src'],
          alias: {
            '@': './src',
          },
        },
      ],

      // Reanimated 4.x moved its Babel plugin into react-native-worklets.
      // Using the old 'react-native-reanimated/plugin' path with Reanimated 4
      // breaks animations AND navigation transitions in production builds
      // (works in Expo Go dev mode, crashes in the release APK).
      // This MUST remain the LAST plugin in the list.
      'react-native-worklets/plugin',
    ],
  };
};