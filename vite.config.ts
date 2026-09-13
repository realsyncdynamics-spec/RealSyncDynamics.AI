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
                                          // to avoid breaking context providers.
                                          // Do NOT split react / react-dom / react-router — Context breaks.
                                          if (id.includes('node_modules/recharts')) {
                                                  return 'vendor-recharts';
                                          }
                                          if (id.includes('node_modules/@supabase/supabase-js')) {
                                                  return 'vendor-supabase';
                                          }
                                          if (
                                                  id.includes('node_modules/three') ||
                                                  id.includes('node_modules/@react-three/')
                                          ) {
                                                  return 'vendor-three';
                                          }
                                          if (
                                                  id.includes('node_modules/framer-motion') ||
                                                  id.includes('node_modules/motion/')
                                          ) {
                                                  return 'vendor-motion';
                                          }
                                          if (id.includes('node_modules/@react-pdf/')) {
                                                  return 'vendor-pdf';
                                          }
                                          if (id.includes('node_modules/@puckeditor/')) {
                                                  return 'vendor-puck';
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
