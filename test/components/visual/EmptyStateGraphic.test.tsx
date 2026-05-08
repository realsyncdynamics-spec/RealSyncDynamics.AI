import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { EmptyStateGraphic } from '../../../src/components/visual/EmptyStateGraphic';

describe('<EmptyStateGraphic>', () => {
  it('renders an svg at the default size', () => {
    const { container } = render(<EmptyStateGraphic />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('width', '96');
    expect(svg).toHaveAttribute('height', '96');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('respects a custom size prop', () => {
    const { container } = render(<EmptyStateGraphic size={48} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '48');
    expect(svg).toHaveAttribute('height', '48');
  });
});
