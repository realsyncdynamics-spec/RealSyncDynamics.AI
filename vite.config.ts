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
          define: {},
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
                                          if (id.includes('node_modules/recharts')) {
                                                  return 'vendor-recharts';
                                          }
                                          if (id.includes('node_modules/@supabase/supabase-js')) {
                                                  return 'vendor-supabase';
                                          }
                                          if (id.includes('node_modules/framer-motion')) {
                                                  return 'vendor-framer-motion';
                                          }
                                          if (id.includes('node_modules/motion/')) {
                                                  return 'vendor-motion';
                                          }
                                          if (
                                            id.includes('node_modules/three') ||
                                            id.includes('node_modules/@react-three/') ||
                                            id.includes('node_modules/postprocessing')
                                          ) {
                                                  return 'vendor-three';
                                          }
                                  },
                          },
                  },
          },
          server: {
            hmr: process.env.DISABLE_HMR !== 'true',
          },
    };
});
