import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AssistentChip } from '../../src/components/AssistentChip';

// IntersectionObserver isn't in jsdom; the chip uses it to detect when
// [data-hero-cta] is on-screen (non-landing routes only — `/` never mounts
// the chip so the luxury hero fold owns attention).

interface MockedObserver {
  callback: IntersectionObserverCallback;
  targets: Element[];
  trigger: (isIntersecting: boolean) => void;
}

let observers: MockedObserver[] = [];

class MockIO implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds = [0];
  private targets: Element[] = [];
  private cb: IntersectionObserverCallback;

  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb;
    observers.push({
      callback: cb,
      targets: this.targets,
      trigger: (isIntersecting: boolean) => {
        const entries = this.targets.map((target) => ({
          isIntersecting,
          target,
          boundingClientRect: {} as DOMRectReadOnly,
          intersectionRatio: isIntersecting ? 1 : 0,
          intersectionRect: {} as DOMRectReadOnly,
          rootBounds: null,
          time: Date.now(),
        }));
        cb(entries, this as unknown as IntersectionObserver);
      },
    });
  }
  observe(t: Element) {
    this.targets.push(t);
  }
  unobserve() {
    /* noop */
  }
  disconnect() {
    this.targets.length = 0;
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

beforeEach(() => {
  observers = [];
  (globalThis as unknown as { IntersectionObserver: typeof MockIO }).IntersectionObserver = MockIO;
});

/** Non-landing surface where the floating Assistent is allowed to mount. */
const CHIP_ROUTE = '/governance';

function renderChip({
  path = CHIP_ROUTE,
  withHero = false,
}: {
  path?: string;
  withHero?: boolean;
} = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      {withHero && (
        <form data-hero-cta>
          <button type="button">Run Scan</button>
        </form>
      )}
      <AssistentChip />
    </MemoryRouter>,
  );
}

describe('<AssistentChip>', () => {
  it('does not mount on `/` (luxury hero fold owns attention)', () => {
    const { queryByLabelText } = renderChip({ path: '/', withHero: true });
    expect(queryByLabelText('Assistent öffnen')).toBeNull();
  });

  it('does not mount on `/` even without a hero CTA marker', () => {
    const { queryByLabelText } = renderChip({ path: '/', withHero: false });
    expect(queryByLabelText('Assistent öffnen')).toBeNull();
  });

  it('renders visible on non-landing routes when no [data-hero-cta] is present', () => {
    const { getByLabelText } = renderChip({ withHero: false });
    const btn = getByLabelText('Assistent öffnen');
    expect(btn).toBeInTheDocument();
    expect(btn.className).toMatch(/opacity-100/);
    expect(btn.className).not.toMatch(/pointer-events-none/);
  });

  it('fades when [data-hero-cta] is in the viewport on a non-landing route', () => {
    const { getByLabelText } = renderChip({ withHero: true });
    const btn = getByLabelText('Assistent öffnen');

    // Initially the observer hasn't fired — chip is "default visible".
    expect(btn.className).toMatch(/opacity-100/);

    act(() => {
      observers.forEach((o) => o.trigger(true));
    });
    expect(btn.className).toMatch(/opacity-0/);
    expect(btn.className).toMatch(/pointer-events-none/);
    expect(btn).toHaveAttribute('aria-hidden', 'true');
    expect(btn).toHaveAttribute('tabindex', '-1');
  });

  it('reveals again when [data-hero-cta] leaves the viewport on a non-landing route', () => {
    const { getByLabelText } = renderChip({ withHero: true });
    const btn = getByLabelText('Assistent öffnen');

    act(() => {
      observers.forEach((o) => o.trigger(true));
    });
    expect(btn.className).toMatch(/opacity-0/);

    act(() => {
      observers.forEach((o) => o.trigger(false));
    });
    expect(btn.className).toMatch(/opacity-100/);
    expect(btn).not.toHaveAttribute('aria-hidden');
    expect(btn).toHaveAttribute('tabindex', '0');
  });

  it('hides entirely on auth-gated routes', () => {
    const { queryByLabelText } = renderChip({ path: '/dashboard' });
    expect(queryByLabelText('Assistent öffnen')).toBeNull();
  });

  it('hides on /governance/* subroutes but shows on /governance', () => {
    const onSub = renderChip({ path: '/governance/admin' });
    expect(onSub.queryByLabelText('Assistent öffnen')).toBeNull();
    onSub.unmount();

    const onRoot = renderChip({ path: '/governance' });
    expect(onRoot.queryByLabelText('Assistent öffnen')).not.toBeNull();
  });

  it('mounts the public AnonWidget hidden by default; click reveals it', () => {
    const { getByLabelText, getByRole } = renderChip({ withHero: false });
    const dialog = getByRole('dialog', { hidden: true });
    expect(dialog).toHaveAttribute('aria-hidden', 'true');

    act(() => {
      getByLabelText('Assistent öffnen').click();
    });

    expect(dialog).toHaveAttribute('aria-hidden', 'false');
    expect(dialog).toHaveAttribute(
      'aria-label',
      expect.stringMatching(/Compliance|Assistent/i) as unknown as string,
    );
  });

  it('closes the widget via the WidgetHeader close button', () => {
    const { getByLabelText, getByRole } = renderChip({ withHero: false });
    act(() => {
      getByLabelText('Assistent öffnen').click();
    });

    const dialog = getByRole('dialog', { hidden: true });
    expect(dialog).toHaveAttribute('aria-hidden', 'false');

    act(() => {
      getByLabelText('Schliessen').click();
    });
    expect(dialog).toHaveAttribute('aria-hidden', 'true');
  });
});
