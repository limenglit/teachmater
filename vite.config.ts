import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  build: {
    target: ['es2020', 'chrome80', 'firefox78', 'safari14', 'edge88'],
    cssTarget: ['chrome80', 'firefox78', 'safari14', 'edge88'],
    rollupOptions: {
      output: {
        // Split heavy vendor libraries into separate chunks so the main bundle
        // stays small and routes that don't need a library don't pay for it.
        // This reduces "unused JavaScript" on the landing route and improves
        // browser cache hit-rate across deploys.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('react-dom')) return 'vendor-react-dom';
          if (id.includes('/react/') || id.includes('/react-router')) return 'vendor-react';
          if (id.includes('@supabase')) return 'vendor-supabase';
          if (id.includes('@radix-ui')) return 'vendor-radix';
          if (id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('@tanstack')) return 'vendor-query';
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
          if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('pptxgenjs') || id.includes('xlsx')) return 'vendor-export';
          if (id.includes('prismjs')) return 'vendor-prism';
        },
      },
    },
  },
  optimizeDeps: {
    // Match build target so dep pre-bundling does not down-level to ES5
    // (avoids shipping legacy polyfills/transforms in vendor code).
    esbuildOptions: {
      target: 'es2020',
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
