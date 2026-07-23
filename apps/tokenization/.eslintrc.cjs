// Self-contained (root) config so this app can join `pnpm -r lint` using the
// eslint + @typescript-eslint already hoisted at the repo root. Deliberately not
// type-aware (no parserOptions.project) to keep it independent of the root
// tsconfig include set; the app's own `typecheck` script covers types.
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: { browser: true, es2022: true },
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
  ignorePatterns: ['dist/', 'node_modules/', 'vite.config.ts'],
};
