import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // No blank lines in code — keep it visually compact.
    rules: {
      'no-multiple-empty-lines': ['error', { max: 0, maxEOF: 0, maxBOF: 0 }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Reference-only template files, not part of the app.
    'references/**',
  ]),
]);
export default eslintConfig;
