import type { FileRecord } from './types';
import { findSecretLeak, normalizeProjectPath } from './path-guard';

const ENTRIES = ['src/main.tsx', 'src/main.jsx', 'src/main.js', 'src/index.tsx', 'src/index.jsx', 'src/index.js', 'index.tsx', 'index.jsx'];
const APPS = ['src/App.tsx', 'src/App.jsx', 'App.tsx', 'App.jsx'];

export function sandpackProject(files: readonly Pick<FileRecord, 'path' | 'content'>[]) {
  const source: Record<string, string> = {};
  for (const file of files) {
    const path = normalizeProjectPath(file.path);
    // Only project source is shared, never package scripts, env, or builder context.
    if (path && !/(^|\/)\./.test(path) && !/(^|\/)dist\//.test(path) &&
        /\.(tsx?|jsx?|css|svg)$/.test(path) && !/\.config\.[^.]+$/.test(path)) {
      if (findSecretLeak(file.content)) return null;
      source[`/${path}`] = file.content;
    }
  }
  let entry = ENTRIES.find((path) => source[`/${path}`] !== undefined);
  if (!entry) {
    const app = APPS.find((path) => source[`/${path}`] !== undefined);
    if (!app) return null;
    entry = '__preview_entry.tsx';
    source[`/${entry}`] = `import { createRoot } from 'react-dom/client';
import App from './${app}';
createRoot(document.getElementById('root')!).render(<App />);`;
  }
  const html = files.find((f) => f.path === 'index.html')?.content ??
    '<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div></body></html>';
  if (findSecretLeak(html)) return null;
  // Sandpack injects the entry bundle; a Vite module tag must not load twice.
  source['/public/index.html'] = html.replace(/<script\b[^>]*\btype=["']module["'][^>]*>[\s\S]*?<\/script>/gi, '');
  source['/package.json'] = JSON.stringify({
    name: 'builder-preview',
    private: true,
    main: `/${entry}`,
    dependencies: { react: '19.0.0', 'react-dom': '19.0.0' },
  });
  return { files: source, entry: `/${entry}` };
}
