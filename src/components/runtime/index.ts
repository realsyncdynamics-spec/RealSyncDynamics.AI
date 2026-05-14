// Runtime UI System — design primitives for every product surface.
//
// Composition pattern:
//   <RuntimeShell eyebrow="03 · monitor" title="…" sub="…">
//     <RuntimeCard title="…" status="live">
//       <RuntimeFeed>
//         <RuntimeEvent ts="T+02s" kind="scan" text="…" />
//       </RuntimeFeed>
//     </RuntimeCard>
//   </RuntimeShell>
//
// Sub-components (RuntimeAgentCard, RuntimeEvidenceCard, RuntimeControlCard,
// RuntimeTerminal, RuntimeMetric, RuntimeStatusPill) are opinionated
// composites of the primitives. Use them when their shape fits — fall back
// to RuntimeCard + RuntimeFeed for novel layouts.

export { RuntimeShell }                from './RuntimeShell';
export type { RuntimeShellProps }      from './RuntimeShell';

export { RuntimeCard }                 from './RuntimeCard';
export type { RuntimeCardProps }       from './RuntimeCard';

export { RuntimeStatusPill }           from './RuntimeStatusPill';
export type { RuntimeStatusPillProps, RuntimeStatus } from './RuntimeStatusPill';

export { RuntimeMetric }               from './RuntimeMetric';
export type { RuntimeMetricProps, RuntimeMetricTone } from './RuntimeMetric';

export { RuntimeEvent, RUNTIME_EVENT_COLOR } from './RuntimeEvent';
export type { RuntimeEventProps, RuntimeEventKind } from './RuntimeEvent';

export { RuntimeFeed }                 from './RuntimeFeed';
export type { RuntimeFeedProps }       from './RuntimeFeed';

export { RuntimeTerminal }             from './RuntimeTerminal';
export type { RuntimeTerminalProps }   from './RuntimeTerminal';

export { RuntimeAgentCard }            from './RuntimeAgentCard';
export type { RuntimeAgentCardProps, RuntimeAgentMetric } from './RuntimeAgentCard';

export { RuntimeEvidenceCard }         from './RuntimeEvidenceCard';
export type { RuntimeEvidenceCardProps, EvidenceStatus } from './RuntimeEvidenceCard';

export { RuntimeControlCard }          from './RuntimeControlCard';
export type { RuntimeControlCardProps, ControlStatus, RuntimeControlMeta } from './RuntimeControlCard';
