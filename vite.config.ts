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
      // KEIN manuelles Chunk-Splitting (manualChunks). Das frühere Aufteilen von
      // node_modules in viele vendor-*-Chunks nach Paket hat Init-Zyklen ÜBER
      // Chunk-Grenzen erzeugt (z. B. React-Core in `vendor-react`, aber
      // @react-three/fiber-Code, der React beim Modul-Init anfasst, in
      // `vendor-three`). Der Minifier ordnet Bindings dann so um, dass entweder
      // ein TDZ-Fehler ("Cannot access 'X' before initialization") oder ein
      // "Cannot set properties of undefined" entsteht — React mountet nicht,
      // Production zeigt eine weiße Seite (nur der statische Footer aus
      // index.html). Mit dem dev-Server (unbundled ESM) bleibt das unsichtbar,
      // weshalb es nur die Production-/E2E-Builds traf.
      //
      // Rollups Default-Splitting ist zyklus- und Init-Order-sicher: gemeinsame
      // Dependencies landen in init-korrekt sortierten Shared-Chunks, und lazy
      // importierte Routen/Szenen (React.lazy, inkl. des three.js-lastigen
      // /aetheros + EarthScene/AiCoreScene) bekommen automatisch eigene
      // Async-Chunks. Deshalb hier bewusst keine output.manualChunks-Funktion.
      chunkSizeWarningLimit: 600,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
