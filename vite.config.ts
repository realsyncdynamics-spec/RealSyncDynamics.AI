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
                                          // Vendor libraries → separate chunks (stable cache)
                                          if (id.includes('node_modules')) {
                                                  if (id.includes('recharts')) return 'vendor-recharts';
                                                  if (id.includes('react') || id.includes('@react')) return 'vendor-react';
                                                  if (id.includes('supabase')) return 'vendor-supabase';
                                                  if (id.includes('lucide-react')) return 'vendor-lucide';
                                                  return 'vendor-shared';
                                          }
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
