/**
 * Honest runtime matrix for srcDoc and the opt-in Sandpack preview.
 *
 * This is a document-sandbox, not a Bolt/Lovable/WebContainer runtime.
 * WebContainer stays disabled (COOP/COEP = production infrastructure).
 */

import type { FileRecord } from './types';
import { SANDPACK_PREVIEW_ENABLED } from './preview-flags';

export type RuntimeSupport = 'yes' | 'no' | 'partial';

export interface RuntimeCapability {
  id: string;
  label: string;
  support: RuntimeSupport;
  detail: string;
}

export function runtimeCapabilities(sandpackAvailable = SANDPACK_PREVIEW_ENABLED): readonly RuntimeCapability[] {
  return [
  {
    id: 'html-css',
    label: 'HTML + CSS',
    support: 'yes',
    detail: 'index.html plus locally inlined stylesheets render in the srcDoc iframe.',
  },
  {
    id: 'local-js',
    label: 'Local classic JavaScript',
    support: 'yes',
    detail: 'Relative <script src="app.js"> is inlined. Requires interactive isolation (script-src unsafe-inline).',
  },
  {
    id: 'multi-file',
    label: 'Multi-file projects',
    support: 'yes',
    detail: 'FileStore holds the tree; preview inlines local CSS/JS referenced from index.html.',
  },
  {
    id: 'esm-imports',
    label: 'ESM import / bundler',
    support: sandpackAvailable ? 'partial' : 'no',
    detail: sandpackAvailable
      ? 'Local React imports are bundled inside Sandpack only. No Vite plugins or Node runtime.'
      : 'No bundler, no import maps, CSP default-src none blocks module specifiers and http(s) imports.',
  },
  {
    id: 'react',
    label: 'React / JSX runtime',
    support: sandpackAvailable ? 'partial' : 'no',
    detail: sandpackAvailable
      ? 'Opt-in Sandpack iframe preview for simple React/JSX. Requires network and an allowed iframe; no Node, backend, or deploy.'
      : 'No CDN, no JSX transform, no node_modules. A React app is stored as source, not executed.',
  },
  {
    id: 'client-routing',
    label: 'Client-side history router',
    support: 'no',
    detail: 'srcDoc has no origin URL; History API and path-based routers cannot navigate.',
  },
  {
    id: 'external-assets',
    label: 'External / CDN assets',
    support: 'no',
    detail: "CSP default-src 'none' (img-src data: only). Remote scripts, fonts, APIs are blocked.",
  },
  {
    id: 'webcontainer',
    label: 'Node / npm / WebContainer',
    support: 'no',
    detail: 'WEBCONTAINER_BACKEND=disabled. Shell/start/build stay HOLD. No COOP/COEP.',
  },
  ];
}

export const RUNTIME_CAPABILITIES = runtimeCapabilities();

export function capabilityById(id: string): RuntimeCapability | undefined {
  return RUNTIME_CAPABILITIES.find((c) => c.id === id);
}

export interface ProjectRuntimeAssessment {
  capabilities: RuntimeCapability[];
  warnings: string[];
  executable: boolean;
  previewRuntime: 'srcdoc' | 'sandpack';
}

const REACT_MARK = /\bfrom\s+['"]react(?:\/[^'"]+)?['"]|\brequire\(\s*['"]react['"]|unpkg\.com\/react/i;
const ESM_MARK = /\bimport\s+(?:type\s+)?[\w*{]\s*from\s+['"][^./]|^\s*import\s+['"][^./]/m;
const ROUTER_MARK = /\b(createBrowserRouter|BrowserRouter|react-router-dom|history\.pushState)\b/;
const CDN_MARK = /<(script|link)[^>]+(https?:)?\/\//i;

export function hasReactProject(files: readonly Pick<FileRecord, 'path' | 'content'>[]): boolean {
  return files.some((f) =>
    /\.(jsx|tsx)$/i.test(f.path) || REACT_MARK.test(f.content) ||
    (f.path === 'package.json' && /"react"\s*:/.test(f.content)),
  );
}

export function assessProjectRuntime(
  files: FileRecord[],
  sandpackAvailable = SANDPACK_PREVIEW_ENABLED,
): ProjectRuntimeAssessment {
  const joined = files.map((f) => f.content).join('\n');
  const warnings: string[] = [];
  const react = hasReactProject(files);
  const useSandpack = sandpackAvailable && react;
  if (react && !useSandpack) {
    warnings.push('React/JSX erkannt — Quelltext wird gespeichert, aber in srcDoc nicht ausgeführt.');
  }
  if (ESM_MARK.test(joined) && !useSandpack) {
    warnings.push('ESM-Import ohne Bundler — unter der Preview-CSP nicht ladbar.');
  }
  if (ROUTER_MARK.test(joined)) {
    warnings.push(useSandpack
      ? 'History-Router: nur Vorschau, keine produktiven Routen oder Server-Rewrites.'
      : 'History-Router erkannt — srcDoc hat keine navigierbare Origin-URL.');
  }
  if (files.some((f) => CDN_MARK.test(f.content))) {
    warnings.push(useSandpack
      ? 'Externe Assets/CDN liegen außerhalb der kontrollierten React-Vorschau.'
      : 'Externe Assets/CDN — von default-src none blockiert.');
  }
  const hasHtml = files.some((f) => f.path.endsWith('.html'));
  return {
    capabilities: [...runtimeCapabilities(sandpackAvailable)],
    warnings,
    executable: useSandpack || (hasHtml && warnings.length === 0),
    previewRuntime: useSandpack ? 'sandpack' : 'srcdoc',
  };
}
