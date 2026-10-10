import { describe, expect, it } from 'vitest';
import { htmlFromFiles } from '../../src/features/app-builder/bolt/preview';
import {
  RUNTIME_CAPABILITIES,
  assessProjectRuntime,
  capabilityById,
  hasReactProject,
  runtimeCapabilities,
} from '../../src/features/app-builder/bolt/runtime-capability';
import { sandpackPreviewEnabled } from '../../src/features/app-builder/bolt/preview-flags';

const rec = (path: string, content: string) => ({
  path,
  content,
  sha256: 'a'.repeat(64),
  updatedAt: '',
  revision: 1,
});

describe('runtime capability matrix', () => {
  it('documents html/css/js as yes and react/esm/router/cdn/webcontainer as no', () => {
    expect(capabilityById('html-css')?.support).toBe('yes');
    expect(capabilityById('local-js')?.support).toBe('yes');
    expect(runtimeCapabilities(false).find((c) => c.id === 'react')?.support).toBe('no');
    expect(runtimeCapabilities(false).find((c) => c.id === 'esm-imports')?.support).toBe('no');
    expect(capabilityById('client-routing')?.support).toBe('no');
    expect(capabilityById('external-assets')?.support).toBe('no');
    expect(capabilityById('webcontainer')?.support).toBe('no');
    expect(RUNTIME_CAPABILITIES).toHaveLength(8);
  });

  it('runs a multi-file HTML/CSS/JS app in srcDoc by inlining local script', () => {
    const html = htmlFromFiles(
      [
        rec('index.html', '<!doctype html><html><head><link rel="stylesheet" href="styles.css"></head><body><h1 id="t"></h1><script src="app.js"></script></body></html>'),
        rec('styles.css', 'h1{color:red}'),
        rec('app.js', 'document.getElementById("t").textContent="ok";'),
      ],
      'interactive',
    );
    expect(html).toMatch(/<style>h1\{color:red\}<\/style>/);
    expect(html).toMatch(/<script>document\.getElementById\("t"\)\.textContent="ok";<\/script>/);
    expect(html).not.toMatch(/src="app.js"/);
  });

  it('does not execute React/ESM/CDN and reports warnings', () => {
    const assessment = assessProjectRuntime([
      rec('App.tsx', "import React from 'react'; export default function App(){return <div/>}"),
      rec('index.html', '<script src="https://unpkg.com/react@18/umd/react.development.js"></script>'),
    ], false);
    expect(assessment.executable).toBe(false);
    expect(assessment.warnings.length).toBeGreaterThan(0);
    expect(assessment.warnings.some((w) => /React/i.test(w))).toBe(true);
  });

  it('flags history routers', () => {
    const assessment = assessProjectRuntime([
      rec('app.js', 'window.history.pushState({}, "", "/kunden");'),
    ]);
    expect(assessment.warnings.some((w) => /History-Router/i.test(w))).toBe(true);
  });

  it('requires exactly true for the opt-in flag', () => {
    for (const value of [null, '', 'false', '1', 'TRUE', true]) {
      expect(sandpackPreviewEnabled(value)).toBe(false);
    }
    expect(sandpackPreviewEnabled('true')).toBe(true);
  });

  it('detects automatic JSX runtime without an explicit React import', () => {
    expect(hasReactProject([rec('src/App.tsx', 'export default () => <div />;')])).toBe(true);
    expect(hasReactProject([rec('src/App.jsx', 'export default () => <div />;')])).toBe(true);
    expect(hasReactProject([rec('package.json', '{"dependencies":{"react":"19.0.0"}}')])).toBe(true);
    expect(hasReactProject([rec('app.js', 'document.body.textContent = "ok";')])).toBe(false);
  });

  it('selects Sandpack only for React projects when enabled', () => {
    const files = [rec('src/App.tsx', 'export default () => <div />;')];
    expect(assessProjectRuntime(files, false).previewRuntime).toBe('srcdoc');
    expect(assessProjectRuntime(files, false).executable).toBe(false);
    expect(assessProjectRuntime(files, true).previewRuntime).toBe('sandpack');
    expect(assessProjectRuntime(files, true).executable).toBe(true);
    expect(assessProjectRuntime([rec('index.html', '<h1>Landing</h1>')], true).previewRuntime).toBe('srcdoc');
  });

  it('reports React/ESM as partial without enabling Node or WebContainer', () => {
    const capabilities = runtimeCapabilities(true);
    expect(capabilities.find((c) => c.id === 'react')?.support).toBe('partial');
    expect(capabilities.find((c) => c.id === 'esm-imports')?.support).toBe('partial');
    expect(capabilities.find((c) => c.id === 'webcontainer')?.support).toBe('no');
  });
});
