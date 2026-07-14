import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { withPerformanceMonitoring, createMonitoredComponent } from '../../src/features/governance/withPerformanceMonitoring';

describe('withPerformanceMonitoring HOC', () => {
  // Mock component for testing
  const TestComponent = ({ message }: { message: string }) => (
    <div>{message}</div>
  );

  it('renders the wrapped component', () => {
    const MonitoredComponent = withPerformanceMonitoring(TestComponent, 'TestComponent');
    const { getByText } = render(<MonitoredComponent message="Hello" />);
    expect(getByText('Hello')).toBeDefined();
  });

  it('sets the correct display name', () => {
    const MonitoredComponent = withPerformanceMonitoring(TestComponent, 'TestComponent');
    expect(MonitoredComponent.displayName).toBe('withPerformanceMonitoring(TestComponent)');
  });

  it('accepts custom performance options', () => {
    const MonitoredComponent = withPerformanceMonitoring(TestComponent, 'TestComponent', {
      threshold: 1000,
      maxRenders: 20,
    });
    expect(MonitoredComponent).toBeDefined();
  });

  it('createMonitoredComponent creates a monitored component', () => {
    const MonitoredComponent = createMonitoredComponent(TestComponent, 'TestComponent', {
      threshold: 500,
      maxRenders: 10,
    });
    expect(MonitoredComponent.displayName).toBe('withPerformanceMonitoring(TestComponent)');
  });

  it('preserves component props', () => {
    const MonitoredComponent = withPerformanceMonitoring(TestComponent, 'TestComponent');
    const { getByText } = render(<MonitoredComponent message="Test Message" />);
    expect(getByText('Test Message')).toBeDefined();
  });
});
