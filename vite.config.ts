import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const appRuntimeVersion = String(Date.now());

const versionedAppEntryPlugin = () => ({
  name: 'teachmate-versioned-app-entry',
  enforce: 'post' as const,
  transformIndexHtml(html: string) {
    return html.replace(/\/src\/main\.tsx(?:\?[^"']*)?/g, `/src/main.tsx?v=${appRuntimeVersion}`);
  },
});

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
    // Do not let Vite discover/optimize dependencies while the preview is
    // already loading. A mid-load optimizer pass can leave react-dom and app
    // modules bound to different React chunks, which surfaces as
    // "dispatcher.useState is null" in the first hook.
    noDiscovery: true,
    // Keep runtime dependencies in one deterministic optimizer pass.
    include: [
      '@hookform/resolvers',
      '@mediapipe/tasks-vision',
      '@radix-ui/react-accordion',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-aspect-ratio',
      '@radix-ui/react-avatar',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-collapsible',
      '@radix-ui/react-context-menu',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-hover-card',
      '@radix-ui/react-label',
      '@radix-ui/react-menubar',
      '@radix-ui/react-navigation-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-progress',
      '@radix-ui/react-radio-group',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-select',
      '@radix-ui/react-separator',
      '@radix-ui/react-slider',
      '@radix-ui/react-slot',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
      '@radix-ui/react-toggle',
      '@radix-ui/react-toggle-group',
      '@radix-ui/react-tooltip',
      '@supabase/supabase-js',
      '@tanstack/react-query',
      'class-variance-authority',
      'clsx',
      'cmdk',
      'date-fns',
      'docx',
      'dompurify',
      'embla-carousel-react',
      'exceljs',
      'framer-motion',
      'html2canvas',
      'input-otp',
      'jspdf',
      'jszip',
      'lucide-react',
      'mammoth',
      'next-themes',
      'onnxruntime-web',
      'pptxgenjs',
      'prismjs',
      'prismjs/components/prism-bash.js',
      'prismjs/components/prism-batch.js',
      'prismjs/components/prism-c.js',
      'prismjs/components/prism-cpp.js',
      'prismjs/components/prism-csharp.js',
      'prismjs/components/prism-dart.js',
      'prismjs/components/prism-go.js',
      'prismjs/components/prism-graphql.js',
      'prismjs/components/prism-ini.js',
      'prismjs/components/prism-java.js',
      'prismjs/components/prism-json.js',
      'prismjs/components/prism-jsx.js',
      'prismjs/components/prism-kotlin.js',
      'prismjs/components/prism-latex.js',
      'prismjs/components/prism-less.js',
      'prismjs/components/prism-lua.js',
      'prismjs/components/prism-markdown.js',
      'prismjs/components/prism-markup-templating.js',
      'prismjs/components/prism-perl.js',
      'prismjs/components/prism-php.js',
      'prismjs/components/prism-powershell.js',
      'prismjs/components/prism-python.js',
      'prismjs/components/prism-r.js',
      'prismjs/components/prism-ruby.js',
      'prismjs/components/prism-rust.js',
      'prismjs/components/prism-sass.js',
      'prismjs/components/prism-scala.js',
      'prismjs/components/prism-scss.js',
      'prismjs/components/prism-sql.js',
      'prismjs/components/prism-swift.js',
      'prismjs/components/prism-toml.js',
      'prismjs/components/prism-tsx.js',
      'prismjs/components/prism-typescript.js',
      'prismjs/components/prism-yaml.js',
      'prismjs/components/prism-zig.js',
      'qrcode.react',
      'react',
      'react-day-picker',
      'react-dom',
      'react-dom/client',
      'react-hook-form',
      'react-resizable-panels',
      'react-router-dom',
      'react/jsx-dev-runtime',
      'react/jsx-runtime',
      'recharts',
      'sonner',
      'tailwind-merge',
      'vaul',
      'zod',
      'zustand',
      'zustand/middleware',
    ],
    needsInterop: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
    // Match build target so dep pre-bundling does not down-level to ES5
    // (avoids shipping legacy polyfills/transforms in vendor code).
    esbuildOptions: {
      target: 'es2020',
    },
  },
  plugins: [
    versionedAppEntryPlugin(),
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
