/**
 * Reine Ableitung des Status je Onboarding-Schritt aus dem Flow-Zustand.
 * Kein Schritt wird ohne eindeutigen Nachweis als `success` markiert.
 */
import { connectionOutcome } from './runtimeClient';
import { isCloudModel, isModelInstalled } from './roles';
import type {
  GovernanceTestResult,
  HealthLoopSnapshot,
  LocalAiResult,
  LocalAiRoleId,
  LocalAiRuntimeProfile,
  OnboardingStepId,
  RuntimeProbe,
  StepStatus,
} from './types';

export interface OnboardingFlowState {
  probing: boolean;
  probe: LocalAiResult<RuntimeProbe> | null;
  role: LocalAiRoleId | null;
  model: string;
  testing: boolean;
  test: LocalAiResult<GovernanceTestResult> | null;
  savedProfile: LocalAiRuntimeProfile | null;
  loopRunning: boolean;
  loopChecking: boolean;
  loopSnapshot: HealthLoopSnapshot | null;
}

export const INITIAL_FLOW_STATE: OnboardingFlowState = {
  probing: false,
  probe: null,
  role: null,
  model: '',
  testing: false,
  test: null,
  savedProfile: null,
  loopRunning: false,
  loopChecking: false,
  loopSnapshot: null,
};

export function installStatus(s: OnboardingFlowState): StepStatus {
  if (s.probing) return 'checking';
  if (!s.probe) return 'pending';
  const outcome = connectionOutcome(s.probe);
  if (outcome === 'reachable' || outcome === 'no_models') return 'success';
  if (outcome === 'blocked') return 'warning';
  if (outcome === 'invalid') return 'pending';
  return 'failed';
}

export function connectionStatus(s: OnboardingFlowState): StepStatus {
  if (s.probing) return 'checking';
  if (!s.probe) return 'pending';
  const outcome = connectionOutcome(s.probe);
  if (outcome === 'reachable') return 'success';
  if (outcome === 'no_models') return 'warning';
  return 'failed';
}

export function roleStatus(s: OnboardingFlowState): StepStatus {
  if (!s.role || !s.model.trim()) return 'pending';
  // Cloud-Modell über Ollama ist keine lokale KI — nie freigeben.
  if (isCloudModel(s.model)) return 'failed';
  if (!s.probe?.ok) return 'warning';
  return isModelInstalled(s.model, s.probe.data.models) ? 'success' : 'warning';
}

export function testStatus(s: OnboardingFlowState): StepStatus {
  if (s.testing) return 'checking';
  if (!s.test) return 'pending';
  if (!s.test.ok) return 'failed';
  // Ein Test für ein anderes als das gewählte Modell zählt nicht.
  if (s.test.data.model !== s.model) return 'pending';
  return s.test.data.overall;
}

export function profileStatus(s: OnboardingFlowState): StepStatus {
  if (!s.savedProfile) return 'pending';
  return s.savedProfile.enabled ? 'success' : 'warning';
}

export function loopStatus(s: OnboardingFlowState): StepStatus {
  if (s.loopChecking) return 'checking';
  if (!s.loopRunning || !s.loopSnapshot) return 'pending';
  const snap = s.loopSnapshot;
  if (!snap.runtimeReachable) return 'failed';
  return snap.modelReachable ? 'success' : 'warning';
}

export function deriveStepStatuses(s: OnboardingFlowState): Record<OnboardingStepId, StepStatus> {
  return {
    install: installStatus(s),
    connection: connectionStatus(s),
    role: roleStatus(s),
    governance_test: testStatus(s),
    profile: profileStatus(s),
    loop: loopStatus(s),
  };
}

/** Governance-Test nur mit erreichbarer Runtime und installiertem Modell. */
export function canRunTest(s: OnboardingFlowState): boolean {
  return !s.testing && connectionStatus(s) === 'success' && roleStatus(s) === 'success';
}

/** Aktivieren nur, wenn der Test für genau dieses Modell bestanden ist. */
export function canActivate(s: OnboardingFlowState): boolean {
  return testStatus(s) === 'success' && connectionStatus(s) === 'success' && !isCloudModel(s.model);
}

/** Loop nur für ein gespeichertes, aktiviertes Profil. */
export function canStartLoop(s: OnboardingFlowState): boolean {
  return s.savedProfile?.enabled === true;
}
