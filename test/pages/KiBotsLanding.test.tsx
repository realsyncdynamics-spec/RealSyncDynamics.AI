import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SyncMascotOptions } from '../../src/components/visual/sync-mascot/syncMascotScene';

// three/WebGL läuft nicht in jsdom: die Szene wird durch eine Attrappe ersetzt.
const scene = vi.hoisted(() => ({
  options: null as SyncMascotOptions | null,
  wave: vi.fn(() => true),
  dispose: vi.fn(),
  canRun3D: true,
}));

// jsdom kann kein WebGL rendern: Capability-Gate für bestehende 3D-Tests steuerbar.
vi.mock('../../src/components/landing/v3/HeroStage', () => ({ canRun3D: () => scene.canRun3D }));

vi.mock('../../src/components/visual/sync-mascot/syncMascotScene', () => ({
  mountSyncMascot: (_canvas: HTMLCanvasElement, options: SyncMascotOptions) => {
    scene.options = options;
    return { wave: scene.wave, dispose: scene.dispose };
  },
}));

import KiBotsLanding from '../../src/pages/products/KiBotsLanding';
import { DEMO_STEPS, KI_BOTS } from '../../src/components/landing/products/kiBotsContent';
import { STAGE_SCENES } from '../../src/components/landing/products/stageScenes';
import { IMPLEMENTATION_ITEMS } from '../../src/product/implementation-status';

async function renderPage() {
  const view = render(
    <MemoryRouter>
      <KiBotsLanding />
    </MemoryRouter>,
  );
  await waitFor(() => expect(scene.options).not.toBeNull());
  return view;
}

describe('KiBotsLanding (/ki-bots, Entwurf)', () => {
  beforeEach(() => {
    scene.options = null;
    scene.wave.mockClear();
    scene.dispose.mockClear();
    scene.canRun3D = true;
  });

  it('zeigt Kernbotschaft, Hauptaktion und lädt SYNC als 3D-Bühne', async () => {
    await renderPage();
    expect(screen.getByTestId('ki-bots-heading')).toHaveTextContent('Erreichbar bleiben.');
    expect(screen.getByTestId('ki-bots-primary')).toHaveTextContent(KI_BOTS.primaryCta);
    expect(screen.getByTestId('ki-bots-primary')).toHaveAttribute('href', '#ablauf');
    expect(scene.options?.src).toBe('/models/sync-mascot.glb');
  });

  it('inszeniert SYNC als Empfang mit Chat-Karte neben der Figur', async () => {
    await renderPage();
    const stage = screen.getByTestId('pl-stage');
    expect(stage).toHaveAttribute('data-variant', 'empfang');
    expect(within(stage).getByTestId('pl-stage-prop')).toHaveTextContent(DEMO_STEPS[0]!.text);
    expect(scene.options?.orbit).toEqual(STAGE_SCENES.empfang.orbit);
  });

  it('nimmt die Status-Badges aus der Registry statt fester Angaben', async () => {
    await renderPage();
    const label = (id: string) => {
      const s = IMPLEMENTATION_ITEMS.find((i) => i.id === id)?.status;
      return s === 'live' ? 'Live' : s === 'preview' ? 'Preview' : 'In Vorbereitung';
    };
    const status = screen.getByTestId('ki-bots-status');
    expect(status).toHaveTextContent(`Chat ${label('channel-bots')}`);
    expect(status).toHaveTextContent(`Telefon ${label('voice-telephony')}`);
  });

  it('spielt den simulierten Ablauf Schritt für Schritt ab und lässt SYNC beim Start winken', async () => {
    await renderPage();
    act(() => scene.options!.onLoad());
    const demo = screen.getByTestId('ki-bots-demo');
    const start = within(demo).getByRole('button', { name: 'Ablauf starten' });

    fireEvent.click(start);
    expect(scene.wave).toHaveBeenCalledTimes(1);
    expect(within(demo).getByText(DEMO_STEPS[0]!.text)).toBeInTheDocument();

    const next = within(demo).getByRole('button', { name: 'Nächster Schritt' });
    for (let i = 1; i < DEMO_STEPS.length; i++) fireEvent.click(next);
    expect(within(demo).getByText(DEMO_STEPS[DEMO_STEPS.length - 1]!.text)).toBeInTheDocument();
    expect(next).toBeDisabled();
    expect(scene.wave).toHaveBeenCalledTimes(1);

    fireEvent.click(within(demo).getByRole('button', { name: 'Von vorn' }));
    expect(within(demo).getByText('Noch keine Nachricht. Starten Sie den Ablauf.')).toBeInTheDocument();
  });

  it('bietet keine irreführenden Telefonie-Tarife an, solange Checkout nicht live ist', async () => {
    await renderPage();
    expect(screen.getByRole('heading', { name: 'Telefonie ist noch in Vorbereitung.' })).toBeInTheDocument();
    expect(screen.queryByTestId('ki-bots-plan-starter')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ki-bots-plan-growth')).not.toBeInTheDocument();
    expect(screen.getByTestId('ki-bots-status-note')).toHaveTextContent('erst angeboten');
    expect(screen.getByTestId('ki-bots-waitlist-pricing'))
      .toHaveAttribute('href', '/warteliste?interest=bots&source=ki-bots');
  });

  it('führt zu Warteliste und Chat-Assistent mit eigener Quelle', async () => {
    await renderPage();
    expect(screen.getByTestId('ki-bots-waitlist')).toHaveAttribute('href', '/warteliste?interest=bots&source=ki-bots');
    expect(screen.getByTestId('ki-bots-try')).toHaveAttribute('href', '/chatbot/start?source=ki-bots');
  });

  it('zeigt beim fehlenden 3D-Support ein SYNC-Standbild statt einer leeren Bühne', () => {
    scene.canRun3D = false;
    render(<MemoryRouter><KiBotsLanding /></MemoryRouter>);
    const stage = screen.getByTestId('pl-stage');
    expect(within(stage).getByRole('img', { name: /SYNC, petrolfarbener RealSync-Roboter/ }))
      .toHaveAttribute('src', '/landing-v3/sync-still.jpg');
    expect(scene.options).toBeNull();
  });

  it('räumt die Szene beim Unmount auf', async () => {
    const view = await renderPage();
    view.unmount();
    expect(scene.dispose).toHaveBeenCalledTimes(1);
  });
});
