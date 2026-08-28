import { useState } from 'react';
import { Link } from 'react-router-dom';
import { furnitureDefaults } from '@/shared/onboarding';
import { ChannelToggles } from './ChannelToggles';
import { readOnboardingProfile } from './onboardingStorage';
import { WorkstoreListingCard } from './WorkstoreListingCard';

export function OperateChannelsView() {
  const [profile, setProfile] = useState(() => readOnboardingProfile() ?? furnitureDefaults());

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">Dashboard</p>
          <h1 className="mt-1 text-2xl font-semibold">Betrieb</h1>
          <p className="mt-2 text-sm text-slate-600">
            Empfohlener Plan aus dem Q&amp;A: {profile.plan_suggested}. Preise stehen nur in der SSoT.
          </p>
        </div>
        <ChannelToggles profile={profile} onProfileChange={setProfile} />
        <WorkstoreListingCard />
        <Link to="/start" className="text-sm text-slate-600 underline">
          Onboarding erneut durchlaufen
        </Link>
      </div>
    </div>
  );
}
