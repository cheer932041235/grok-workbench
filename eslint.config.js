import js from "@eslint/js";
import ts from "typescript-eslint";
import svelte from "eslint-plugin-svelte";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs["flat/recommended"],
  prettier,
  ...svelte.configs["flat/prettier"],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        extraFileExtensions: [".svelte"],
      },
    },
    rules: {
      // Allow explicit any in a codebase that wraps dynamic CLI JSON
      "@typescript-eslint/no-explicit-any": "off",
      // Unused vars: allow _ prefix and args (common in callbacks)
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Allow empty functions (common in noop callbacks)
      "@typescript-eslint/no-empty-function": "off",
      // Svelte: allow @html (sanitized via DOMPurify)
      "svelte/no-at-html-tags": "off",
      // Disable noisy Svelte rules that don't catch real bugs:
      // - require-each-key: 47 violations, adding keys is a significant refactor
      // - no-navigation-without-resolve: not applicable to Tauri (no server routing)
      // - prefer-svelte-reactivity: false positives in reducer pattern (manually managed state)
      // - no-useless-children-snippet: cosmetic, not a bug source
      // - prefer-writable-derived: cosmetic refactor suggestion
      "svelte/require-each-key": "off",
      "svelte/no-navigation-without-resolve": "off",
      "svelte/prefer-svelte-reactivity": "off",
      "svelte/no-useless-children-snippet": "off",
      "svelte/prefer-writable-derived": "off",
      // Prevent direct static imports of @tauri-apps/api outside the transport layer.
      // Dynamic import() is allowed for desktop-only features with graceful fallback.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@tauri-apps/api/*"],
              message:
                "Use getTransport() from $lib/transport instead. Direct Tauri imports break browser (WS) mode. Dynamic import() is OK for desktop-only features.",
            },
          ],
        },
      ],
    },
  },
  // Allow @tauri-apps/api in the transport layer (the only place it belongs)
  {
    // Grok Workbench is a native ACP client; its entry point uses Tauri IPC directly.
    files: ["src/lib/transport/**", "src/grok/client.ts", "src/grok/TitleBar.svelte", "src/routes/+page.svelte"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    files: ["**/*.svelte", "**/*.svelte.ts"],
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
      },
    },
  },
  {
    ignores: [
      "build/",
      ".svelte-kit/",
      "src-tauri/",
      "node_modules/",
      "vite.config.ts",
      "vitest.config.ts",
      "svelte.config.js",
      "postcss.config.js",
      "tailwind.config.ts",
    ],
  },
);
