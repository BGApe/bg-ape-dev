/** @type {import('@babel/core').TransformOptions} */
module.exports = {
  presets: [
    // jsxImportSource: 'nativewind' wires the NativeWind className prop transformer.
    ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
  ],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./'],
        alias: {
          '@': './src',
        },
        extensions: ['.android.ts', '.android.tsx', '.ts', '.tsx', '.js', '.jsx', '.json'],
      },
    ],
    // react-native-reanimated/plugin must always be last.
    'react-native-reanimated/plugin',
  ],
};
