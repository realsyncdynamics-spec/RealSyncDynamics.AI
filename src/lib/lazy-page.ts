import { lazy, type ComponentType } from 'react';

/**
 * React.lazy mit named- oder default-export.
 *   lazyPage(() => import('./pages/AetherOSLanding'))
 *   lazyPage(() => import('./pages/Foo'), 'FooPage')
 */
export function lazyPage<T extends ComponentType<unknown>>(
  loader: () => Promise<{ default: T } | Record<string, T>>,
  exportName: string = 'default',
) {
  return lazy(async () => {
    const mod = await loader();
    if ('default' in mod && exportName === 'default') {
      return { default: (mod as { default: T }).default };
    }
    const named = (mod as Record<string, T>)[exportName];
    if (!named) throw new Error(`lazyPage: export "${exportName}" fehlt`);
    return { default: named };
  });
}
