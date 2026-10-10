import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  Button,
  ButtonLink,
  brandButtonClass,
  Card,
  StatusBadge,
  STATUS_LABELS,
  Input,
} from '../../../src/components/brand';

describe('brand Button', () => {
  it('renders a type=button with primary variant by default', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Los</Button>);
    const btn = screen.getByRole('button', { name: 'Los' });
    expect(btn).toHaveAttribute('type', 'button');
    expect(btn).toHaveAttribute('data-variant', 'primary');
    expect(btn.className).toContain('var(--brand-champ)');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('uses gold outline on light tone and no blue/cyan in any variant', () => {
    expect(brandButtonClass({ tone: 'light' })).toContain('border-[var(--brand-gold)]');
    for (const tone of ['dark', 'light'] as const) {
      for (const variant of ['primary', 'secondary', 'ghost'] as const) {
        const c = brandButtonClass({ tone, variant });
        expect(c).not.toMatch(/cyan|blue|#1e5aff|#00b8d4|brand-live/i);
      }
    }
  });

  it('ButtonLink keeps the target', () => {
    render(
      <MemoryRouter>
        <ButtonLink to="/audit?source=x" variant="secondary">Audit</ButtonLink>
      </MemoryRouter>,
    );
    const a = screen.getByRole('link', { name: 'Audit' });
    expect(a).toHaveAttribute('href', '/audit?source=x');
    expect(a).toHaveAttribute('data-variant', 'secondary');
  });

  it('respects disabled', () => {
    render(<Button disabled>Nein</Button>);
    expect(screen.getByRole('button', { name: 'Nein' })).toBeDisabled();
  });
});

describe('brand Card', () => {
  it('renders kicker, title and children with tone', () => {
    render(
      <Card tone="light" kicker="Modul" title="Titel">
        Inhalt
      </Card>,
    );
    expect(screen.getByText('Modul')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Titel' })).toBeInTheDocument();
    const card = screen.getByText('Inhalt');
    expect(card).toHaveAttribute('data-tone', 'light');
    expect(card.className).toContain('var(--brand-paper)');
  });
});

describe('brand StatusBadge', () => {
  it.each(['live', 'beta', 'in-arbeit', 'geplant'] as const)('renders %s with default label', (s) => {
    render(<StatusBadge status={s} />);
    const el = screen.getByText(STATUS_LABELS[s]);
    expect(el.closest('[data-status]')).toHaveAttribute('data-status', s);
  });

  it('only live uses the cyan live token', () => {
    const { container } = render(
      <>
        <StatusBadge status="live" />
        <StatusBadge status="beta" />
        <StatusBadge status="in-arbeit" />
        <StatusBadge status="geplant" />
      </>,
    );
    const badges = container.querySelectorAll('[data-status]');
    badges.forEach((b) => {
      const usesLive = b.className.includes('--brand-live');
      expect(usesLive).toBe(b.getAttribute('data-status') === 'live');
    });
  });

  it('accepts a custom label', () => {
    render(<StatusBadge status="beta" label="Vorschau" />);
    expect(screen.getByText('Vorschau')).toBeInTheDocument();
  });
});

describe('brand Input', () => {
  it('links label and hint', () => {
    render(<Input label="Domain" hint="ohne https" placeholder="example.de" />);
    const input = screen.getByLabelText('Domain');
    expect(input).toHaveAttribute('placeholder', 'example.de');
    expect(input.getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getByText('ohne https')).toHaveAttribute('id', input.getAttribute('aria-describedby')!);
  });
});

describe('brand-v4-tokens.css', () => {
  const css = readFileSync(join(__dirname, '../../../src/styles/brand-v4-tokens.css'), 'utf8');
  it.each([
    ['--brand-bg-1', '#050607'],
    ['--brand-champ', '#f2c98a'],
    ['--brand-champ-hi', '#fbe7bd'],
    ['--brand-paper', '#f3f2f2'],
    ['--brand-ink', '#201f1d'],
    ['--brand-gold', '#b68235'],
    ['--brand-live', '#22c3e6'],
    ['--brand-radius-md', '4px'],
  ])('defines %s = %s (matches landing v4)', (name, value) => {
    expect(css).toMatch(new RegExp(`${name}:\\s*${value};`));
  });

  it('values are present in the landing v4 source of truth', () => {
    const v4 = readFileSync(join(__dirname, '../../../src/styles/landing-v4-classical.css'), 'utf8');
    for (const hex of ['#f2c98a', '#fbe7bd', '#a67a3a', '#f3f2f2', '#201f1d', '#b68235', '#22c3e6']) {
      expect(v4).toContain(hex);
    }
  });

  it('is imported in main.tsx and not in index.css', () => {
    const main = readFileSync(join(__dirname, '../../../src/main.tsx'), 'utf8');
    const index = readFileSync(join(__dirname, '../../../src/index.css'), 'utf8');
    expect(main).toContain("./styles/brand-v4-tokens.css");
    expect(index).not.toContain('brand-v4-tokens');
  });
});
