import base from '@nixzora/eslint-config/base';

export default [
  ...base,
  {
    rules: {
      // NestJS dependency injection reads constructor parameter types at runtime
      // (emitDecoratorMetadata). `import type` would erase them and break DI.
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
];
