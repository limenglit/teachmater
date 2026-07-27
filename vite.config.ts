import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    headers: {
      // Vite's dep URLs include browser-hash query strings. In the Lovable
      // preview iframe, stale transformed source can otherwise keep importing
      // an older React dep URL while react-dom imports the freshly optimized
      // one, creating two React module instances and triggering
      // "dispatcher.useState is null" on the first hook.
      'Cache-Control': 'no-store, max-age=0, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
    hmr: {
      overlay: false,
    },
  },
  build: {
    target: ['es2020', 'chrome80', 'firefox78', 'safari14', 'edge88'],
    cssTarget: ['chrome80', 'firefox78', 'safari14', 'edge88'],
  },
  optimizeDeps: {
    // Keep the cold-start crawl focused on the real app entry. Scanning every
    // source file also picked up tests/docs and could force extra optimizer
    // passes while the preview was already loading.
    entries: ['index.html'],
    // Always pre-bundle the React core together so every dependency shares
    // one React instance (prevents "dispatcher is null" hook errors).
    include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
    // Match build target so dep pre-bundling does not down-level to ES5
    // (avoids shipping legacy polyfills/transforms in vendor code).
    esbuildOptions: {
      target: 'es2020',
    },
  },
  plugins: [
    react({ devTarget: 'es2020' }),
    mode === "development" && componentTagger({ jsxSource: false }),
  ].filter(Boolean),
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      { find: /^react$/, replacement: path.resolve(__dirname, "./node_modules/react/index.js") },
      { find: /^react-dom$/, replacement: path.resolve(__dirname, "./node_modules/react-dom/index.js") },
      { find: /^react-dom\/client$/, replacement: path.resolve(__dirname, "./node_modules/react-dom/client.js") },
      { find: /^react\/jsx-runtime$/, replacement: path.resolve(__dirname, "./node_modules/react/jsx-runtime.js") },
      { find: /^react\/jsx-dev-runtime$/, replacement: path.resolve(__dirname, "./node_modules/react/jsx-dev-runtime.js") },
    ],
  },
}));
