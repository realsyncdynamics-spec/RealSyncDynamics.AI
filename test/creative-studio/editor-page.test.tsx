import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SocialDesignEditor } from '../../src/features/creative-studio/SocialDesignEditor';

vi.mock('../../src/features/creative-studio/EditorCanvas', () => ({
  EditorCanvas: () => <div data-testid="editor-canvas" />,
}));

describe('SocialDesignEditor', () => {
  it('zeigt das Demo-Brand-Kit, die Formate und deaktivierte Platzhalter', () => {
    render(<SocialDesignEditor />);

    expect(screen.getByRole('heading', { name: 'Social Design' })).toBeInTheDocument();
    expect(screen.getAllByText('Demo-Brand-Kit').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Instagram Feed 1080×1080/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('editor-canvas')).toBeInTheDocument();

    const publish = screen.getByRole('button', { name: /Veröffentlichen/ });
    const generate = screen.getByRole('button', { name: /Bild erzeugen/ });
    const plan = screen.getByRole('button', { name: /In den Plan/ });
    expect(publish).toBeDisabled();
    expect(generate).toBeDisabled();
    expect(plan).toBeDisabled();
    expect(screen.getAllByText('Demo').length).toBeGreaterThanOrEqual(3);

    fireEvent.click(screen.getByRole('button', { name: 'Ellipse' }));
    expect(screen.getAllByRole('button', { name: /Ellipse/ })).toHaveLength(2);
  });
});
