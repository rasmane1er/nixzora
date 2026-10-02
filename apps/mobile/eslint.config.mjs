import base from '@nixzora/eslint-config/base';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  ...base,
  { ignores: ['dist-web/**', '.expo/**', 'babel.config.js', 'metro.config.js'] },
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // Images and fonts are loaded with require() in React Native.
    files: ['**/*.ts', '**/*.tsx'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
];
