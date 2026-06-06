export type ControlSignalType =
  | 'new_tracker'
  | 'consent_timing'
  | 'new_third_party_domain'
  | 'new_cookies'
  | 'legal_text_changed'
  | 'evidence_snapshot';

export type ControlSignalSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type ControlSignalStatus = 'open' | 'acknowledged' | 'resolved';

export interface ControlSignal {
  id: string;
  type: ControlSignalType;
  label: string;
  domain: string;
  severity: ControlSignalSeverity;
  detectedAt: string;
  summary: string;
  evidenceRef?: string;
  status: ControlSignalStatus;
}
