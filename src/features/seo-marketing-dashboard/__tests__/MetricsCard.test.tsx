import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricsCard } from '../MetricsCard';

describe('MetricsCard Component', () => {
  it('should render label and value', () => {
    render(
      <MetricsCard
        label="Customer Acquisition Cost"
        value={500}
        unit="€"
      />
    );

    expect(screen.getByText('Customer Acquisition Cost')).toBeInTheDocument();
    expect(screen.getByText('500.00')).toBeInTheDocument();
    expect(screen.getByText('€')).toBeInTheDocument();
  });

  it('should render with trend up', () => {
    render(
      <MetricsCard
        label="Revenue"
        value={10000}
        unit="€"
        trend={15}
      />
    );

    expect(screen.getByText('15.0%')).toBeInTheDocument();
  });

  it('should render with trend down', () => {
    render(
      <MetricsCard
        label="Churn Rate"
        value={5}
        unit="%"
        trend={-10}
      />
    );

    expect(screen.getByText('10.0%')).toBeInTheDocument();
  });

  it('should apply correct color class', () => {
    const { container } = render(
      <MetricsCard
        label="Test Metric"
        value={100}
        color="green"
      />
    );

    const card = container.querySelector('.bg-green-50');
    expect(card).toBeInTheDocument();
  });

  it('should format number values with 2 decimals', () => {
    render(
      <MetricsCard
        label="Conversion Rate"
        value={5.333}
        unit="%"
      />
    );

    expect(screen.getByText('5.33')).toBeInTheDocument();
  });

  it('should handle string values', () => {
    render(
      <MetricsCard
        label="Status"
        value="Active"
      />
    );

    expect(screen.getByText('Active')).toBeInTheDocument();
  });
});
