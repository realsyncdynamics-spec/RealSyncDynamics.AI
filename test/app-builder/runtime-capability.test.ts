import { describe, expect, it } from 'vitest';
import { htmlFromFiles } from '../../src/features/app-builder/bolt/preview';
import {
  RUNTIME_CAPABILITIES,
  assessProjectRuntime,
  capabilityById,
} from '../../src/features/app-builder/bolt/runtime-capability';

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
    expect(capabilityById('react')?.support).toBe('no');
    expect(capabilityById('esm-imports')?.support).toBe('no');
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
    ]);
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
});
