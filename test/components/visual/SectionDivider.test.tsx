import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SectionDivider } from '../../../src/components/visual/SectionDivider';

describe('<SectionDivider>', () => {
  it('renders a label plate when label prop is provided', () => {
    render(<SectionDivider label="Pricing" />);
    expect(screen.getByText('Pricing')).toBeInTheDocument();
  });

  it('omits the label plate when no label is provided', () => {
    const { container } = render(<SectionDivider />);
    // The brass-shimmer line is always rendered; only the label-plate span is conditional.
    expect(container.querySelectorAll('span')).toHaveLength(0);
  });

  it('applies the requested spacing class', () => {
    const { container } = render(<SectionDivider spacing="sm" />);
    expect(container.firstChild).toHaveClass('py-8');
  });
});
