module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    // Reanimated 4.x mandates the react-native-worklets babel plugin.
    // Order matters : worklets plugin must be LAST.
    plugins: ['react-native-worklets/plugin'],
  };
};
