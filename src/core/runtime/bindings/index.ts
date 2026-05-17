// Bindings-Schicht — der einzige Einstiegspunkt, um die lib/skills in den
// Runtime-Stack einzuhaengen. Wird beim Boot der Runtime aufgerufen:
//
//   const registry = new SkillRegistry();
//   const handlers = new HandlerRegistry();
//   registerSkillBindings({ registry, handlers });
//
// Danach kann ein `Executor` ueber `skills.<key_snake>` Aktionen ausfuehren.
// Approval-Gates entstehen automatisch fuer alles, was nicht `auto_approve`
// ist (siehe mapping.ts).

import type { HandlerRegistry } from '../handlers';
import type { SkillRegistry } from '../registry';
import { ALL_SKILLS, type SkillDef, type SkillKey } from '../../../lib/skills/registry';
import { buildSkillManifest, runtimeSkillId } from './mapping';
import { makeDispatchHandler } from './dispatch';
import { SKILL_ACTIONS } from './skill-actions';

export interface SkillBinding {
  key: SkillKey;
  runtime_skill_id: string;
  manifest: ReturnType<typeof buildSkillManifest>;
}

export interface RegisterOptions {
  registry: SkillRegistry;
  handlers: HandlerRegistry;
  /** Optional: subset of skill keys to register (defaults to all). */
  only?: readonly SkillKey[];
}

/**
 * Registriert die ausgewaehlten Skills inkl. Handlern bei einer
 * laufenden Runtime. Idempotenz-Verhalten = das der zugrundeliegenden
 * Registries: doppelte Registrierung wirft.
 */
export function registerSkillBindings(opts: RegisterOptions): SkillBinding[] {
  const set = opts.only ? new Set(opts.only) : null;
  const bindings: SkillBinding[] = [];
  for (const skill of ALL_SKILLS) {
    if (set && !set.has(skill.key)) continue;
    const binding = bindOne(skill, opts.registry, opts.handlers);
    bindings.push(binding);
  }
  return bindings;
}

function bindOne(
  skill: SkillDef,
  registry: SkillRegistry,
  handlers: HandlerRegistry,
): SkillBinding {
  const manifest = buildSkillManifest(skill);
  registry.register(manifest);

  const actions = SKILL_ACTIONS[skill.key];
  if (!actions) {
    throw new Error(`No action map registered for skill: ${skill.key}`);
  }
  handlers.register(manifest.id, makeDispatchHandler(actions));

  return {
    key: skill.key,
    runtime_skill_id: manifest.id,
    manifest,
  };
}

export { buildSkillManifest, runtimeSkillId } from './mapping';
export { makeDispatchHandler, listActions } from './dispatch';
export { SKILL_ACTIONS } from './skill-actions';
