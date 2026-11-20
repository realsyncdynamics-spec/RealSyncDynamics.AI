import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SyncMascotOptions } from '../../src/components/visual/sync-mascot/syncMascotScene';

// three/WebGL läuft nicht in jsdom: die Szene wird durch eine Attrappe ersetzt.
const scene = vi.hoisted(() => ({
  options: null as SyncMascotOptions | null,
  wave: vi.fn(() => true),
  dispose: vi.fn(),
}));

vi.mock('../../src/components/visual/sync-mascot/syncMascotScene', () => ({
  mountSyncMascot: (_canvas: HTMLCanvasElement, options: SyncMascotOptions) => {
    scene.options = options;
    return { wave: scene.wave, dispose: scene.dispose };
  },
}));

import SyncMascot from '../../src/pages/SyncMascot';

async function renderMounted() {
  const view = render(<SyncMascot />);
  await waitFor(() => expect(scene.options).not.toBeNull());
  return view;
}

describe('SyncMascot (/sync)', () => {
  beforeEach(() => {
    scene.options = null;
    scene.wave.mockClear();
    scene.dispose.mockClear();
  });

  it('zeigt Überschrift, Texte und einen anfangs deaktivierten Button', async () => {
    await renderMounted();
    expect(screen.getByRole('heading', { level: 1, name: 'SYNC' })).toBeInTheDocument();
    expect(screen.getByText('RealSyncDynamics.AI')).toBeInTheDocument();
    expect(screen.getByText('Das 3D-Maskottchen von RealSyncDynamics.')).toBeInTheDocument();
    expect(screen.getByText('Ziehen zum Drehen · Scrollen zum Zoomen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Winken lassen' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('3D-Modell lädt …');
    expect(scene.options?.src).toBe('/models/sync-mascot.glb');
  });

  it('aktiviert den Button nach dem Laden, sperrt ihn während des Winkens und gibt ihn danach frei', async () => {
    await renderMounted();
    const button = screen.getByRole('button', { name: 'Winken lassen' });
    const status = screen.getByRole('status');

    act(() => scene.options!.onLoad());
    expect(button).toBeEnabled();
    expect(status).toBeEmptyDOMElement();

    fireEvent.click(button);
    expect(scene.wave).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    expect(status).toHaveTextContent('SYNC winkt.');

    act(() => scene.options!.onWaveFinished());
    expect(button).toBeEnabled();
    expect(status).toBeEmptyDOMElement();
  });

  it('meldet einen Ladefehler und lässt den Button deaktiviert', async () => {
    await renderMounted();
    act(() => scene.options!.onError());
    expect(screen.getByRole('status')).toHaveTextContent('3D-Modell konnte nicht geladen werden.');
    expect(screen.getByRole('button', { name: 'Winken lassen' })).toBeDisabled();
  });

  it('räumt die Szene beim Unmount auf', async () => {
    const view = await renderMounted();
    view.unmount();
    expect(scene.dispose).toHaveBeenCalledTimes(1);
  });
});
