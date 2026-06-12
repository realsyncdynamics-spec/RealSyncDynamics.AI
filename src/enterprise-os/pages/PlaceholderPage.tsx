import React from 'react';
import { Construction } from 'lucide-react';
import { EmptyState } from '../components/States';

interface PlaceholderPageProps {
  title: string;
  description: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">Governance OS</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-titanium-50 sm:text-3xl">{title}</h1>
      </div>
      <EmptyState
        icon={<Construction className="h-5 w-5" />}
        title="Modul folgt in Phase 2/3"
        description={description}
      />
    </div>
  );
}
