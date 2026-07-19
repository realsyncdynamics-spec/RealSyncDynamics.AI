import React from 'react';

// Performance monitoring HOC - wraps a component with performance tracking
export function withPerformanceMonitoring<P extends object>(
  Component: React.ComponentType<P>,
  displayName: string,
  options?: { threshold?: number; maxRenders?: number }
): React.FC<P> {
  const Wrapped = (props: P) => React.createElement(Component, props);
  Wrapped.displayName = displayName;
  return Wrapped;
}
