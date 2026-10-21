import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AiHomeView } from '../../../src/features/ai-home/AiHomeView';
import { ASSISTANT_PROMPT_EVENT } from '../../../src/components/governance-os/assistantPrompt';

describe('AI OS home', () => {
  it('provides the existing dashboard and tool routes', () => {
    render(<MemoryRouter><AiHomeView /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /Dashboard/i }).getAttribute('href')).toBe('/app/dashboard');
    expect(screen.getByRole('link', { name: /Websites/i }).getAttribute('href')).toBe('/app/websites');
    expect(screen.getByRole('link', { name: /Agenten/i }).getAttribute('href')).toBe('/app/agents');
    expect(screen.getByRole('link', { name: /Workflows/i }).getAttribute('href')).toBe('/app/workflows');
  });

  it('opens the assistant with a prefill without directly sending a request', () => {
    const handler = vi.fn();
    window.addEventListener(ASSISTANT_PROMPT_EVENT, handler);
    try {
      render(<MemoryRouter><AiHomeView /></MemoryRouter>);
      fireEvent.change(screen.getByRole('textbox', { name: 'Nachricht an RealSync AI' }), {
        target: { value: '  Prüfe die offenen Risiken  ' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Im Assistenten öffnen' }));
      expect(handler).toHaveBeenCalledTimes(1);
      expect((handler.mock.calls[0]?.[0] as CustomEvent).detail.prompt).toBe('Prüfe die offenen Risiken');
      expect((screen.getByRole('textbox', { name: 'Nachricht an RealSync AI' }) as HTMLTextAreaElement).value).toBe('');
    } finally {
      window.removeEventListener(ASSISTANT_PROMPT_EVENT, handler);
    }
  });
});
