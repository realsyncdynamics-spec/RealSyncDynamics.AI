/**
 * Extension build script
 * Compiles TypeScript and bundles for Chrome
 */

import esbuild from 'esbuild';
import path from 'path';
import fs from 'fs-extra';

const outdir = path.join(process.cwd(), 'extension/dist');

// Clean dist
await fs.remove(outdir);

const commonOptions: esbuild.BuildOptions = {
  bundle: false,
  target: 'ES2020',
  format: 'iife',
  define: {
    'process.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL),
    'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY),
  },
};

// Build popup script
await esbuild.build({
  ...commonOptions,
  entryPoints: ['extension/src/popup/index.ts'],
  outfile: path.join(outdir, 'popup/index.js'),
});

// Build background service worker
await esbuild.build({
  ...commonOptions,
  entryPoints: ['extension/src/background/index.ts'],
  outfile: path.join(outdir, 'background/index.js'),
});

// Build content script
await esbuild.build({
  ...commonOptions,
  entryPoints: ['extension/src/content/index.ts'],
  outfile: path.join(outdir, 'content/index.js'),
});

// Copy static files
await fs.copy('extension/manifest.json', path.join(outdir, 'manifest.json'));
await fs.copy('extension/src/popup/index.html', path.join(outdir, 'popup/index.html'));
await fs.copy('extension/public', path.join(outdir, 'public'));

console.log(`✓ Extension built to ${outdir}`);
