import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    server: {
      port: 8080,
      strictPort: true,
    },
    // react-window is a CommonJS module. Force-bundle it as ESM for SSR so
    // named exports (FixedSizeList) resolve correctly in the server module runner.
    optimizeDeps: {
      include: ["react-window"],
    },
    ssr: {
      noExternal: ["react-window"],
    },
  },
});

