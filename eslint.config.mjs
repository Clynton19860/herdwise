import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // MapLibre's worker, copied here at build time by
    // scripts/copy-maplibre-worker.mjs because the library cannot locate its
    // own worker once bundled. It is minified vendor code we do not author, and
    // linting it produced a thousand warnings that buried our own.
    "public/maplibre/**",
  ]),
]);

export default eslintConfig;
