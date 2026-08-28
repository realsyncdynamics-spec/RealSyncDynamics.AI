import * as Icons from 'lucide-react';
import { RUNTIME_PIPELINE, PRODUCT_POSITIONING } from '@/shared/pricing';
import { PlatformOsSection } from '../sections/PlatformOsSection';

export function RuntimePipeline({
  variant = 'section',
}: {
  variant?: 'section' | 'bare';
}) {
  const chain = (
    <ol className="grid grid-cols-1 gap-px bg-titanium-900 sm:grid-cols-2 lg:grid-cols-4">
      {RUNTIME_PIPELINE.map((stage, index) => {
        const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[stage.icon] ?? Icons.Circle;
        return (
          <li
            key={stage.id}
            className="relative flex flex-col gap-2 bg-obsidian-950 p-5"
            data-testid={`runtime-stage-${stage.id}`}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] tabular-nums text-titanium-600">
                {String(index + 1).padStart(2, '0')}
              </span>
              <Icon className="h-4 w-4 text-security-500" aria-hidden="true" />
            </div>
            <div className="font-display text-sm font-bold tracking-tight text-titanium-50">
              {stage.label}
            </div>
            <p className="text-xs leading-relaxed text-titanium-400">{stage.description}</p>
          </li>
        );
      })}
    </ol>
  );

  if (variant === 'bare') return chain;

  return (
    <>
      <section
        className="border-t border-silver-700/30 bg-obsidian-900/20 px-4 py-16 sm:px-6 sm:py-20 lg:px-8"
        aria-labelledby="runtime-pipeline-heading"
      >
        <div className="mx-auto max-w-5xl">
          <div className="mb-8">
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.22em] text-titanium-500">
              {PRODUCT_POSITIONING}
            </p>
            <h2
              id="runtime-pipeline-heading"
              className="mb-3 font-display text-2xl font-bold tracking-tight text-titanium-50 sm:text-3xl"
            >
              Wie die Runtime arbeitet
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-titanium-400">
              Jeder Plan durchläuft dieselbe Kette. Der Unterschied liegt darin, wie viele
              Rahmenwerke die Policy Engine prüft, wie oft die Runtime läuft und wie weit
              die Automatisierung reicht.
            </p>
          </div>
          {chain}
        </div>
      </section>
      <PlatformOsSection source="pricing" />
    </>
  );
}
