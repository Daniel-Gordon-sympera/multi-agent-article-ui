import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "coverage",
      "test-results",
      "playwright-report",
      "node_modules",
      "public/mockServiceWorker.js",
      "src/routeTree.gen.ts",
      "src/api/*.gen.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "jsx-a11y": jsxA11y,
    },
    rules: {
      ...reactHooks.configs["recommended-latest"].rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true, allowExportNames: ["Route"] },
      ],
      // React Compiler is not used in this project; this rule only matters under the compiler.
      "react-hooks/incompatible-library": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    files: ["scripts/**/*.{js,mjs}"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ["src/mocks/**/*.ts", "e2e/**/*.ts", "scripts/**/*.{js,mjs,ts}"],
    rules: {
      "no-console": "off",
    },
  },
  {
    // Shared building blocks deliberately co-locate variants, hooks and helpers with components;
    // route files keep their page component local so TanStack's automatic code splitting works.
    files: [
      "src/components/**/*.tsx",
      "src/app/**/*.tsx",
      "src/test/**/*.tsx",
      "src/routes/**/*.tsx",
    ],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
);
