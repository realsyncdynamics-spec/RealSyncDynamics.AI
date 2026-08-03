import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
    const env = loadEnv(mode, '.', '');
    const base = env.VITE_BASE ?? '/';
    return {
          base,
          plugins: [react(), tailwindcss()],
          define: {
                  // Never inject secrets into bundle. Use Edge Functions instead.
          },
          resolve: {
                  alias: {
                            '@': path.resolve(__dirname, '.'),
                  },
          },
          build: {
                  chunkSizeWarningLimit: 600,
                  rollupOptions: {
                          output: {
                                  manualChunks(id) {
                                          // Split heavy vendor libs only; keep React & core together
                                          // to avoid breaking context providers
                                          if (id.includes('node_modules/recharts')) {
                                                  return 'vendor-recharts';
                                          }
                                          if (id.includes('node_modules/@supabase/supabase-js')) {
                                                  return 'vendor-supabase';
                                          }
                                          // Keep React, React Router, and app code together in main chunk
                                          // Context providers (src/core/) must stay in entry chunk
                                  },
                          },
                  },
          },
          server: {
                  // HMR is disabled in AI Studio via DISABLE_HMR env var.
            hmr: process.env.DISABLE_HMR !== 'true',
          },
    };
});
