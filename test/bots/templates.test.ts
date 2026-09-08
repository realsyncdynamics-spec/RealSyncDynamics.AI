import { describe, it, expect } from 'vitest';
import { applyBotGoal, BOT_GOAL_TEMPLATES, botGoalById, knowledgeFromBotConfig } from '../../src/features/bots/templates';

describe('Bot-Zielvorlagen', () => {
  it('führt Telefon-Empfang als Leitprodukt', () => {
    const featured = BOT_GOAL_TEMPLATES.filter((t) => t.featured);
    expect(featured).toHaveLength(1);
    expect(featured[0].id).toBe('phone_reception');
    expect(featured[0].channel).toBe('voice');
    expect(featured[0].capabilities.appointments).toBe(true);
  });

  it('füllt Create-Args aus dem Ziel, nicht aus einem leeren Formular', () => {
    const args = applyBotGoal('phone_reception', {
      tenant_id: '11111111-1111-1111-1111-111111111111',
      displayName: 'Praxis Dr. Müller',
      hours: 'Mo–Fr 8–18',
      handoffPhone: '+49 40 123',
    });

    expect(args.channel).toBe('voice');
    expect(args.name).toBe('Praxis Dr. Müller');
    expect(args.persona).toContain('Praxis Dr. Müller');
    expect(args.persona).not.toContain('{name}');
    expect(args.greeting).toMatch(/Empfang/);
    expect(args.config?.knowledge).toEqual({
      goal: 'phone_reception',
      hours: 'Mo–Fr 8–18',
      services: undefined,
      handoffPhone: '+49 40 123',
    });
  });

  it('nimmt den Vorlagennamen, wenn kein Anzeigename gesetzt ist', () => {
    const args = applyBotGoal('web_chat', {
      tenant_id: '11111111-1111-1111-1111-111111111111',
      displayName: '   ',
    });
    expect(args.name).toBe(botGoalById('web_chat').name);
    expect(args.channel).toBe('chat');
  });

  it('liest Wissen in derselben Form, die der Prompt-Bau erwartet', () => {
    expect(knowledgeFromBotConfig({
      knowledge: { hours: '  9-17  ', services: 'Beratung', extra: 1 },
    })).toEqual({
      goal: undefined,
      hours: '9-17',
      services: 'Beratung',
      handoffPhone: undefined,
      notes: undefined,
    });
  });
});
