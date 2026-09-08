/**
 * Farbkarten der Vorlagenwahl. Ohne sie ist die 8K-Liste nur Text.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DesignTemplatePicker } from '../../src/features/siteos/DesignTemplatePicker';

describe('DesignTemplatePicker', () => {
  it('zeigt die 8K-Vorlagen als klickbare Farbkarten', () => {
    const onSelect = vi.fn();
    render(<DesignTemplatePicker selected="enterprise-8k" onSelect={onSelect} tone="dark" />);

    expect(screen.getByRole('button', { name: /Enterprise 8K/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cinematic Obsidian/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Editorial Trust/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Cinematic Obsidian/ }));
    expect(onSelect).toHaveBeenCalledWith('cinematic-obsidian');
  });
});
