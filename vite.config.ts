import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
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
    // Scan the whole app up front. Without this, Vite can discover a lazy
    // dependency after the first modules have already been served, re-optimize
    // deps mid-load, and leave React imports bound to different dep hashes.
    entries: ['index.html', 'src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}'],
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
    react(),
    mode === "development" && componentTagger({ jsxSource: false }),
  ].filter(Boolean),
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      "@": path.resolve(__dirname, "./src"),
      react: path.resolve(__dirname, "./node_modules/react"),
      "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
      "react-dom/client": path.resolve(__dirname, "./node_modules/react-dom/client.js"),
      "react/jsx-runtime": path.resolve(__dirname, "./node_modules/react/jsx-runtime.js"),
      "react/jsx-dev-runtime": path.resolve(__dirname, "./node_modules/react/jsx-dev-runtime.js"),
    },
  },
}));
