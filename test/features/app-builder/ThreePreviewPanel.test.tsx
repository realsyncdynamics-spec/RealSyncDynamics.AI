import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const { mountMock, updateMock, disposeMock } = vi.hoisted(() => ({
  mountMock: vi.fn(),
  updateMock: vi.fn(),
  disposeMock: vi.fn(),
}));

vi.mock('@/src/features/app-builder/three-preview/viewer', () => ({
  mount: mountMock,
}));

import { ThreePreviewPanel } from '@/src/features/app-builder/three-preview/ThreePreviewPanel';

describe('ThreePreviewPanel (opt-in, client-only)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mountMock.mockReturnValue({ update: updateMock, dispose: disposeMock });
  });

  it('initialisiert die übernommene Three.js-Vorschau mit begrenzten Demo-Werten', () => {
    render(<ThreePreviewPanel />);
    expect(screen.getByTestId('builder-3d-preview-panel')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '3D-Objektvorschau' })).toBeInTheDocument();
    expect(mountMock).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      { shape: 'sphere', color: '#a78bfa', scale: 1, speed: 0.4 },
    );
  });

  it('ändert die Form über den vorhandenen Viewer-Handle, ohne neu zu mounten', () => {
    render(<ThreePreviewPanel />);
    fireEvent.change(screen.getByLabelText('Form'), { target: { value: 'torus' } });
    expect(updateMock).toHaveBeenLastCalledWith({
      shape: 'torus', color: '#a78bfa', scale: 1, speed: 0.4,
    });
    expect(mountMock).toHaveBeenCalledTimes(1);
  });

  it('übergibt nur ausgewählte sechsstellige Hex-Farben', () => {
    render(<ThreePreviewPanel />);
    fireEvent.change(screen.getByLabelText('Farbe'), { target: { value: '#12ab34' } });
    expect(updateMock).toHaveBeenLastCalledWith({
      shape: 'sphere', color: '#12ab34', scale: 1, speed: 0.4,
    });
  });

  it('kann Skalierung und Drehgeschwindigkeit einstellen', () => {
    render(<ThreePreviewPanel />);
    fireEvent.change(screen.getByLabelText('Größe'), { target: { value: '1.4' } });
    fireEvent.change(screen.getByLabelText('Drehgeschwindigkeit'), { target: { value: '0' } });
    expect(updateMock).toHaveBeenLastCalledWith({
      shape: 'sphere', color: '#a78bfa', scale: 1.4, speed: 0,
    });
  });

  it('entsorgt den WebGL-Handle beim Verlassen des Panels', () => {
    const view = render(<ThreePreviewPanel />);
    view.unmount();
    expect(disposeMock).toHaveBeenCalledTimes(1);
  });

  it('zeigt bei fehlendem WebGL eine ehrliche SVG-Ersatzansicht', () => {
    mountMock.mockReturnValue(null);
    render(<ThreePreviewPanel />);
    expect(screen.getByText(/SVG-Ersatzansicht/)).toBeInTheDocument();
    expect(disposeMock).not.toHaveBeenCalled();
  });

  it('schreibt nicht selbst in localStorage und bietet keine Freigabe-/Deploy-Aktion an', () => {
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem');
    try {
      render(<ThreePreviewPanel />);
      fireEvent.change(screen.getByLabelText('Form'), { target: { value: 'box' } });
      expect(storageSpy).not.toHaveBeenCalled();
      expect(screen.getByText(/veröffentlicht nichts/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /deploy|veröffentlichen|kaufen|speichern/i })).toBeNull();
    } finally {
      storageSpy.mockRestore();
    }
  });
});
