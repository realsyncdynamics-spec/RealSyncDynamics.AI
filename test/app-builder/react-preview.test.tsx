import { describe, expect, it, vi, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { builderSystemPrompt, BUILDER_REACT_SYSTEM_PROMPT, BUILDER_SYSTEM_PROMPT } from '../../src/features/app-builder/bolt/system-prompt';
import { sandpackProject } from '../../src/features/app-builder/bolt/sandpack-project';

const rec = (path: string, content: string) => ({ path, content, sha256: 'a'.repeat(64), updatedAt: '', revision: 1 });
const app = [rec('src/App.tsx', 'export default function App(){return <h1>Demo</h1>}')];

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.doUnmock('../../src/features/app-builder/SandpackReactPreview');
  vi.doUnmock('@codesandbox/sandpack-react');
  vi.resetModules();
  vi.useRealTimers();
});

describe('React prompt mode', () => {
  it.each(['Baue eine App', 'Build a dashboard', 'Erstelle ein SaaS'])('handles explicit requests: %s', (prompt) => {
    expect(builderSystemPrompt(prompt, [], true)).toBe(BUILDER_REACT_SYSTEM_PROMPT);
    expect(builderSystemPrompt(prompt, [], false)).toBe(BUILDER_SYSTEM_PROMPT);
  });

  it.each(['Landingpage für eine SaaS App', 'Ein Hero, kein Dashboard', 'Launch-Seite ohne App', 'Make a page, not a dashboard', 'Eine Website'])('preserves landing flow: %s', (prompt) => {
    expect(builderSystemPrompt(prompt, [], true)).toBe(BUILDER_SYSTEM_PROMPT);
  });

  it('keeps React mode for follow-up edits to React source', () => {
    expect(builderSystemPrompt('Ändere die Farbe', app, true)).toBe(BUILDER_REACT_SYSTEM_PROMPT);
  });
});

describe('Sandpack source adapter', () => {
  it('adapts Vite entry and HTML without executing package scripts or installing arbitrary dependencies', () => {
    const project = sandpackProject([
      ...app,
      rec('src/main.tsx', "import App from './App';"),
      rec('index.html', '<div id="root"></div><script type="module" src="/src/main.tsx"></script>'),
      rec('package.json', '{"scripts":{"start":"do-not-run"},"dependencies":{"unknown":"*"}}'),
      rec('.env', 'private-value'),
      rec('vite.config.ts', 'do-not-run'),
      rec('../private.ts', 'do-not-share'),
    ])!;
    expect(project.entry).toBe('/src/main.tsx');
    expect(project.files['/public/index.html']).toBe('<div id="root"></div>');
    expect(JSON.parse(project.files['/package.json'])).toEqual({
      name: 'builder-preview', private: true, main: '/src/main.tsx',
      dependencies: { react: '19.0.0', 'react-dom': '19.0.0' },
    });
    expect(Object.keys(project.files)).not.toContain('/.env');
    expect(Object.keys(project.files)).not.toContain('/vite.config.ts');
    expect(Object.keys(project.files)).not.toContain('/../private.ts');
  });

  it('creates a preview-only bootstrap for App-only JSX and rejects unsupported structures', () => {
    expect(sandpackProject(app)?.files['/__preview_entry.tsx']).toContain("import App from './src/App.tsx'");
    expect(sandpackProject([rec('other.tsx', 'export const X = <div/>')])).toBeNull();
  });

  it('does not share sources that match the existing secret guard', () => {
    expect(sandpackProject([rec('src/App.tsx', 'const service_role = "private";')])).toBeNull();
  });
});

describe('preview flag and user gating', () => {
  async function preview(enabled: string, files = app, isolation: 'interactive' | 'static' = 'interactive') {
    vi.stubEnv('VITE_APP_BUILDER_SANDPACK', enabled);
    const { BuilderPreview } = await import('../../src/features/app-builder/BuilderPreview');
    render(<BuilderPreview files={files} isolation={isolation} />);
  }

  it('keeps srcDoc when disabled, even for React', async () => {
    await preview('false');
    expect(screen.getByTitle('Governed preview')).toHaveAttribute('srcdoc');
    expect(screen.queryByText('React-Vorschau starten')).toBeNull();
  });

  describe('Sandpack startup lifecycle', () => {
    async function runtime() {
      vi.useFakeTimers();
      let listener: (message: { type: string }) => void = () => {};
      vi.doMock('@codesandbox/sandpack-react', () => ({
        SandpackProvider: ({ children }: { children: ReactNode }) => children,
        useSandpackClient: () => ({
          iframe: { current: null },
          sandpack: { status: 'running', error: null },
          // Like Sandpack, this hook supplies a new listen function every render.
          listen: (callback: typeof listener) => {
            listener = callback;
            return () => {};
          },
        }),
      }));
      const { default: Preview } = await import('../../src/features/app-builder/SandpackReactPreview');
      const unavailable = vi.fn();
      const view = render(<Preview files={app} onUnavailable={unavailable} />);
      return { Preview, unavailable, view, done: () => listener({ type: 'done' }) };
    }

    it('does not rearm the startup timeout after successful compilation and rerender', async () => {
      const { Preview, unavailable, view, done } = await runtime();
      act(done);
      view.rerender(<Preview files={[...app]} onUnavailable={unavailable} />);
      act(() => vi.advanceTimersByTime(31_000));
      expect(unavailable).not.toHaveBeenCalled();
    });

    it('does not extend the startup deadline when the provider rerenders', async () => {
      const { Preview, unavailable, view } = await runtime();
      act(() => vi.advanceTimersByTime(20_000));
      view.rerender(<Preview files={[...app]} onUnavailable={unavailable} />);
      act(() => vi.advanceTimersByTime(10_001));
      expect(unavailable).toHaveBeenCalledOnce();
    });
  });

  it('keeps landing projects on srcDoc with the flag enabled', async () => {
    await preview('true', [rec('index.html', '<h1>Landing</h1>')]);
    expect(screen.queryByText('React-Vorschau starten')).toBeNull();
    expect(screen.getByTitle('Governed preview')).toHaveAttribute('srcdoc');
  });

  it('requires explicit start and permits the srcDoc fallback without loading Sandpack', async () => {
    await preview('true');
    expect(screen.getByText('React-Vorschau starten')).toBeInTheDocument();
    expect(screen.queryByTitle('Sandpack React preview')).toBeNull();
    fireEvent.click(screen.getByText('srcDoc verwenden'));
    expect(screen.getByTitle('Governed preview')).toHaveAttribute('srcdoc');
    expect(screen.getByRole('status')).toHaveTextContent('React wird hier nicht ausgeführt');
  });

  it('respects the scripts-disabled setting for React', async () => {
    await preview('true', app, 'static');
    expect(screen.queryByText('React-Vorschau starten')).toBeNull();
    expect(screen.getByTitle('Governed preview')).not.toHaveAttribute('sandbox', expect.stringContaining('allow-scripts'));
  });

  it('loads the React preview only after explicit start and falls back on enforced CSP', async () => {
    vi.doMock('../../src/features/app-builder/SandpackReactPreview', () => ({
      default: () => <iframe title="Sandpack React preview" />,
    }));
    await preview('true');
    expect(screen.queryByTitle('Sandpack React preview')).toBeNull();
    fireEvent.click(screen.getByText('React-Vorschau starten'));
    expect(await screen.findByTitle('Sandpack React preview')).toBeInTheDocument();
    const violation = new Event('securitypolicyviolation');
    Object.defineProperties(violation, {
      disposition: { value: 'enforce' },
      effectiveDirective: { value: 'frame-src' },
      blockedURI: { value: 'https://2-19-8-sandpack.codesandbox.io/' },
    });
    fireEvent(document, violation);
    expect(screen.queryByTitle('Sandpack React preview')).toBeNull();
    expect(screen.getByTitle('Governed preview')).toHaveAttribute('srcdoc');
  });

  it('falls back if the preview runtime cannot start', async () => {
    let unavailable: () => void = () => {};
    vi.doMock('../../src/features/app-builder/SandpackReactPreview', () => ({
      default: ({ onUnavailable }: { onUnavailable: () => void }) => {
        unavailable = onUnavailable;
        return <button onClick={unavailable}>Simulate unavailable runtime</button>;
      },
    }));
    await preview('true');
    fireEvent.click(screen.getByText('React-Vorschau starten'));
    fireEvent.click(await screen.findByText('Simulate unavailable runtime'));
    expect(screen.getByTitle('Governed preview')).toHaveAttribute('srcdoc');
    expect(screen.getByRole('status')).toHaveTextContent('Sandpack nicht verfügbar');
  });
});
