// Fake-Adapter für Tests und lokale Entwicklung (Spike).
//
// NICHT gegen einen echten Anbieter getestet. Dieser Adapter simuliert nur
// das Verhalten, das die Sitzungsverwaltung voraussetzt: eine Sandbox je
// Start, eigene Dateiablage, Vorschau-URL auf fremder Origin mit Token,
// idempotentes Stoppen. Er führt keinen Code aus.

import type { PreviewRuntime, RuntimeHandle, RuntimeStartInput, RuntimeStatus, SandboxFile } from './types.ts';

export interface FakeSandbox {
  sandboxId: string;
  token: string;
  status: RuntimeStatus;
  files: Map<string, string>;
  input: RuntimeStartInput;
}

export interface FakeRuntimeOptions {
  /** Künstliche Startdauer, um parallele Starts zu testen. */
  startDelayMs?: number;
  /** Start schlägt fehl (Anbieterfehler). */
  failStart?: boolean;
  /** Basis-Host der Vorschau. Standard: reservierte TLD `.invalid`. */
  previewBaseHost?: string;
}

export class FakePreviewRuntime implements PreviewRuntime {
  readonly provider = 'fake';
  readonly sandboxes = new Map<string, FakeSandbox>();
  readonly calls = { start: 0, stop: 0, writeFiles: 0, status: 0 };
  private readonly opts: FakeRuntimeOptions;

  constructor(opts: FakeRuntimeOptions = {}) {
    this.opts = opts;
  }

  async start(input: RuntimeStartInput): Promise<RuntimeHandle> {
    this.calls.start++;
    if (this.opts.startDelayMs) await new Promise((r) => setTimeout(r, this.opts.startDelayMs));
    if (this.opts.failStart) throw new Error('fake provider: start failed');
    const sandboxId = `fake-${input.sandboxKey.slice(0, 16)}`;
    const base = this.opts.previewBaseHost ?? 'preview.fake-sandbox.invalid';
    const previewUrl = `https://${input.devServer.port}-${sandboxId}.${base}/?token=${input.previewToken}`;
    this.sandboxes.set(sandboxId, {
      sandboxId,
      token: input.previewToken,
      status: 'running',
      files: new Map(input.files.map((f) => [f.path, f.content])),
      input,
    });
    return { provider: this.provider, sandboxId, previewUrl };
  }

  async writeFiles(handle: RuntimeHandle, files: SandboxFile[]): Promise<void> {
    this.calls.writeFiles++;
    const sb = this.sandboxes.get(handle.sandboxId);
    if (!sb || sb.status !== 'running') throw new Error('fake provider: sandbox not running');
    for (const f of files) sb.files.set(f.path, f.content);
  }

  async status(handle: RuntimeHandle): Promise<RuntimeStatus> {
    this.calls.status++;
    return this.sandboxes.get(handle.sandboxId)?.status ?? 'stopped';
  }

  async stop(handle: RuntimeHandle): Promise<void> {
    this.calls.stop++;
    const sb = this.sandboxes.get(handle.sandboxId);
    if (sb) sb.status = 'stopped';
  }

  previewUrl(handle: RuntimeHandle): string {
    return handle.previewUrl;
  }

  /** Simuliert einen Abruf der Vorschau-URL: nur laufende Sandbox + passendes Token. */
  serve(url: string): { status: 200 | 404; body: string } {
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      return { status: 404, body: '' };
    }
    const sb = [...this.sandboxes.values()].find((s) => u.hostname.includes(s.sandboxId));
    if (!sb || sb.status !== 'running' || u.searchParams.get('token') !== sb.token) {
      return { status: 404, body: '' };
    }
    return { status: 200, body: sb.files.get('index.html') ?? '' };
  }

  running(): FakeSandbox[] {
    return [...this.sandboxes.values()].filter((s) => s.status === 'running');
  }
}
