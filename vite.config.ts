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
                                          // Keep React family in ONE chunk. Splitting them (or circular
                                          // vendor chunks that race with React init) causes:
                                          // Cannot set properties of undefined (setting 'Activity')
                                          // on React 19.2 SharedInternals.
                                          if (
                                            id.includes('/node_modules/react/') ||
                                            id.includes('/node_modules/react-dom/') ||
                                            id.includes('/node_modules/scheduler/') ||
                                            id.includes('/node_modules/react-router/') ||
                                            id.includes('/node_modules/react-router-dom/')
                                          ) {
                                                  return 'vendor-react';
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
                                          // recharts + three were circular (vendor-recharts <-> vendor-three).
                                          // One viz chunk avoids the init race that broke Activity.
                                          if (
                                            id.includes('node_modules/recharts') ||
                                            id.includes('node_modules/three') ||
                                            id.includes('node_modules/@react-three/') ||
                                            id.includes('node_modules/postprocessing')
                                          ) {
                                                  return 'vendor-viz';
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
