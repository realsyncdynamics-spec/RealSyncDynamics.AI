import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  // GitHub Pages serves project sites under <user>.github.io/<repo>/.
  // VITE_BASE lets us override at build-time (e.g. for Netlify which serves at root).
  const base = env.VITE_BASE ?? '/';
  return {
    base,
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // Manual chunks split the previously 1.5MB single-bundle into cacheable
      // vendor-chunks. Browser CDNs (GH-Pages Fastly) cache vendor-* across
      // deploys since they only change when dependencies change, while the
      // small app-chunk re-downloads each deploy.
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('react-router') || id.includes('@remix-run/router')) return 'vendor-router';
            if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('@stripe') || id.includes('stripe')) return 'vendor-stripe';
            if (id.includes('@sentry')) return 'vendor-sentry';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('three') || id.includes('@react-three')) return 'vendor-three';
            if (id.includes('@react-pdf') || id.includes('fontkit') || id.includes('pdfkit')) return 'vendor-pdf';
            if (id.includes('@google/genai')) return 'vendor-genai';
            if (
              id.includes('react-markdown') ||
              id.includes('/remark') ||
              id.includes('/rehype') ||
              id.includes('/micromark') ||
              id.includes('/unified') ||
              id.includes('/mdast') ||
              id.includes('/hast')
            ) {
              return 'vendor-markdown';
            }
            if (id.includes('node_modules/motion') || id.includes('node_modules/framer-motion')) return 'vendor-motion';
            if (id.includes('node_modules/ajv')) return 'vendor-ajv';
            if (id.includes('react-dom') || id.includes('scheduler') || id.includes('/react/')) return 'vendor-react';
            return 'vendor';
          },
        },
      },
      chunkSizeWarningLimit: 600,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
