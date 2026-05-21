import { describe, it, expect, beforeEach } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AssistentChip } from '../../src/components/AssistentChip';

// IntersectionObserver isn't in jsdom; the chip uses it to detect when
// [data-hero-cta] is on-screen. Mock it with a controllable trigger.

interface MockedObserver {
  callback: IntersectionObserverCallback;
  targets:  Element[];
  trigger:  (isIntersecting: boolean) => void;
}

let observers: MockedObserver[] = [];

class MockIO implements IntersectionObserver {
  readonly root          = null;
  readonly rootMargin    = '';
  readonly thresholds    = [0];
  private  targets: Element[] = [];
  private  cb:      IntersectionObserverCallback;

  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb;
    observers.push({
      callback: cb,
      targets:  this.targets,
      trigger:  (isIntersecting: boolean) => {
        const entries = this.targets.map(target => ({
          isIntersecting,
          target,
          boundingClientRect: {} as DOMRectReadOnly,
          intersectionRatio:  isIntersecting ? 1 : 0,
          intersectionRect:   {} as DOMRectReadOnly,
          rootBounds:         null,
          time:               Date.now(),
        }));
        cb(entries, this as unknown as IntersectionObserver);
      },
    });
  }
  observe(t: Element) { this.targets.push(t); }
  unobserve()         { /* noop */ }
  disconnect()        { this.targets.length = 0; }
  takeRecords(): IntersectionObserverEntry[] { return []; }
}

beforeEach(() => {
  observers = [];
  (globalThis as unknown as { IntersectionObserver: typeof MockIO }).IntersectionObserver = MockIO;
});

function renderChipWithHero({ withHero }: { withHero: boolean }) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      {withHero && <form data-hero-cta><button>Run Scan</button></form>}
      <AssistentChip />
    </MemoryRouter>,
  );
}

describe('<AssistentChip>', () => {
  it('renders visible by default when no [data-hero-cta] is present', () => {
    const { getByLabelText } = renderChipWithHero({ withHero: false });
    const btn = getByLabelText('Assistent öffnen');
    expect(btn).toBeInTheDocument();
    expect(btn.className).toMatch(/opacity-100/);
    expect(btn.className).not.toMatch(/pointer-events-none/);
  });

  it('hides when [data-hero-cta] is in the viewport', () => {
    const { getByLabelText } = renderChipWithHero({ withHero: true });
    const btn = getByLabelText('Assistent öffnen');

    // Initially the observer hasn't fired — chip is "default visible".
    expect(btn.className).toMatch(/opacity-100/);

    // Simulate hero entering viewport.
    act(() => {
      observers.forEach(o => o.trigger(true));
    });
    expect(btn.className).toMatch(/opacity-0/);
    expect(btn.className).toMatch(/pointer-events-none/);
    expect(btn).toHaveAttribute('aria-hidden', 'true');
    expect(btn).toHaveAttribute('tabindex', '-1');
  });

  it('reveals again when [data-hero-cta] leaves the viewport', () => {
    const { getByLabelText } = renderChipWithHero({ withHero: true });
    const btn = getByLabelText('Assistent öffnen');

    act(() => { observers.forEach(o => o.trigger(true)); });
    expect(btn.className).toMatch(/opacity-0/);

    act(() => { observers.forEach(o => o.trigger(false)); });
    expect(btn.className).toMatch(/opacity-100/);
    expect(btn).not.toHaveAttribute('aria-hidden');
    expect(btn).toHaveAttribute('tabindex', '0');
  });

  it('hides entirely on auth-gated routes', () => {
    const { queryByLabelText } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AssistentChip />
      </MemoryRouter>,
    );
    expect(queryByLabelText('Assistent öffnen')).toBeNull();
  });

  it('hides on /governance/* subroutes but shows on /governance', () => {
    const onSub = render(
      <MemoryRouter initialEntries={['/governance/admin']}>
        <AssistentChip />
      </MemoryRouter>,
    );
    expect(onSub.queryByLabelText('Assistent öffnen')).toBeNull();
    onSub.unmount();

    const onRoot = render(
      <MemoryRouter initialEntries={['/governance']}>
        <AssistentChip />
      </MemoryRouter>,
    );
    expect(onRoot.queryByLabelText('Assistent öffnen')).not.toBeNull();
  });

  it('opens an initialisation sheet on click with an Audit-CTA', () => {
    const { getByLabelText, getByText, getByRole } = renderChipWithHero({ withHero: false });

    expect(() => getByRole('dialog')).toThrow();

    fireEvent.click(getByLabelText('Assistent öffnen'));

    const dialog = getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(getByText(/AI Runtime wird initialisiert/i)).toBeInTheDocument();
    const cta = getByText('Audit starten').closest('a');
    expect(cta).not.toBeNull();
    expect(cta?.getAttribute('href')).toContain('/audit');
  });

  it('closes the sheet on Escape', () => {
    const { getByLabelText, getByRole, queryByRole } = renderChipWithHero({ withHero: false });
    fireEvent.click(getByLabelText('Assistent öffnen'));
    expect(getByRole('dialog')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(queryByRole('dialog')).toBeNull();
  });
});
