import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {execSync} from 'child_process';
import path from 'path';
import {defineConfig, loadEnv, type Plugin} from 'vite';

// Commit-SHA des Builds, egal auf welchem Deploy-Pfad gebaut wird:
// Cloudflare-Git-Integration setzt CF_PAGES_COMMIT_SHA, GitHub Actions GITHUB_SHA,
// lokal fällt es auf `git rev-parse` zurück.
function resolveBuildSha(): string {
    const fromEnv = process.env.CF_PAGES_COMMIT_SHA ?? process.env.GITHUB_SHA;
    if (fromEnv) return fromEnv;
    try {
        return execSync('git rev-parse HEAD', {encoding: 'utf8'}).trim();
    } catch {
        return 'unknown';
    }
}

// Stempelt den Commit ins ausgelieferte HTML (<meta name="rsd-build">), damit
// "welcher Stand ist live?" per curl beantwortbar ist. Der verify-live-Job in
// deploy-cloudflare-pages.yml pollt genau diesen Marker — nicht entfernen.
function buildStampPlugin(): Plugin {
    return {
        name: 'rsd-build-stamp',
        transformIndexHtml(html) {
            return html.replace('<head>', `<head>\n    <meta name="rsd-build" content="${resolveBuildSha()}" />`);
        },
    };
}

export default defineConfig(({mode}) => {
    const env = loadEnv(mode, '.', '');
    const base = env.VITE_BASE ?? '/';
    return {
          base,
          plugins: [react(), tailwindcss(), buildStampPlugin()],
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
