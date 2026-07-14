/**
 * Auto-Mapping Logic Tests — Edge-Cases und Refinements (Phase 2)
 *
 * Tests für:
 * 1. Besondere Kategorien (DSGVO Art. 9)
 * 2. Industry-spezifische Controls (Tenant-Industrie)
 * 3. Non-Destructive Reconciliation (manuelle Mappings)
 * 4. Multi-Framework Scenarios
 */

import { describe, it, expect } from 'vitest';
import {
  proposeControlStatuses,
  reconcileProposals,
  computeAutoMappings,
  type AssetProfile,
  type ControlRef,
  type CurrentMapping,
} from '../../src/lib/governance/autoMap';

describe('autoMap — Phase 2 Edge-Cases', () => {
  describe('Special Category Detection (DSGVO Art. 9)', () => {
    it('should detect health/medical data', () => {
      const profile: AssetProfile = {
        assetType: 'api',
        aiActClass: 'minimal',
        dataTypes: ['patient_diagnosis', 'treatment_plan'],
      };
      const controls: ControlRef[] = [
        { framework: 'GDPR', control_code: 'GDPR_ART9' },
        { framework: 'GDPR', control_code: 'GDPR_DATA_MINIMIZATION' },
      ];
      const proposals = proposeControlStatuses(profile, controls);
      const art9 = proposals.find((p) => p.control_code === 'GDPR_ART9');
      expect(art9).toBeDefined();
      expect(art9?.rationale).toContain('besondere Kategorien');
    });

    it('should trigger EU AI Act for high-risk AI with biometric data', () => {
      const profile: AssetProfile = {
        assetType: 'ai_system',
        aiActClass: 'high',
        dataTypes: ['facial_recognition', 'biometric'],
      };
      const controls: ControlRef[] = [
        { framework: 'EU_AI_ACT', control_code: 'HRIA' },
        { framework: 'GDPR', control_code: 'GDPR_DATA_MINIMIZATION' },
      ];
      const proposals = proposeControlStatuses(profile, controls);
      // EU AI Act should trigger (high-risk AI)
      const aiAct = proposals.find((p) => p.framework === 'EU_AI_ACT');
      expect(aiAct).toBeDefined();
      expect(aiAct?.status).toBe('gap');
      // Biometric is PII, so GDPR should trigger
      const gdpr = proposals.find((p) => p.framework === 'GDPR');
      expect(gdpr).toBeDefined();
      expect(gdpr?.status).toBe('gap');
    });

    it('should not confuse regular "health" string with special category', () => {
      const profile: AssetProfile = {
        assetType: 'website',
        aiActClass: 'minimal',
        dataTypes: ['general_health_info'], // Generic health topic, not diagnostic
      };
      const controls: ControlRef[] = [
        { framework: 'GDPR', control_code: 'GDPR_EXERCISE_RIGHTS' },
      ];
      const proposals = proposeControlStatuses(profile, controls);
      // Should still propose as PII, but not as Art. 9 special category
      const special = proposals.filter((p) => p.rationale.includes('Art. 9'));
      expect(special.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Industry-Specific Controls', () => {
    it('should recommend healthcare controls for healthcare tenant', () => {
      const profile: AssetProfile = {
        assetType: 'ai_system',
        aiActClass: 'high',
        dataTypes: ['patient_records'],
        tenantIndustry: 'healthcare',
      };
      const controls: ControlRef[] = [
        { framework: 'HEALTHCARE', control_code: 'HC_GDPR_PLUS' },
        { framework: 'EU_AI_ACT', control_code: 'HRIA' },
      ];
      const proposals = proposeControlStatuses(profile, controls);
      const healthcareControl = proposals.find((p) => p.framework === 'HEALTHCARE');
      expect(healthcareControl).toBeDefined();
      expect(healthcareControl?.status).toBe('gap');
    });

    it('should not recommend healthcare controls for non-healthcare tenant', () => {
      const profile: AssetProfile = {
        assetType: 'ai_system',
        aiActClass: 'high',
        dataTypes: ['customer_preferences'],
        tenantIndustry: 'ecommerce',
      };
      const controls: ControlRef[] = [
        { framework: 'HEALTHCARE', control_code: 'HC_GDPR_PLUS' },
        { framework: 'EU_AI_ACT', control_code: 'HRIA' },
      ];
      const proposals = proposeControlStatuses(profile, controls);
      const healthcareControl = proposals.find((p) => p.framework === 'HEALTHCARE');
      expect(healthcareControl).toBeUndefined();
    });

    it('should handle missing industry gracefully', () => {
      const profile: AssetProfile = {
        assetType: 'ai_system',
        aiActClass: 'high',
        dataTypes: ['patient_data'],
        // tenantIndustry is undefined
      };
      const controls: ControlRef[] = [
        { framework: 'HEALTHCARE', control_code: 'HC_GDPR_PLUS' },
      ];
      expect(() => proposeControlStatuses(profile, controls)).not.toThrow();
    });
  });

  describe('Non-Destructive Reconciliation', () => {
    it('should preserve manual mappings', () => {
      const proposals = [
        {
          framework: 'GDPR',
          control_code: 'DATA_MINIMIZATION',
          status: 'gap' as const,
          rationale: 'Has PII',
        },
      ];
      const current: CurrentMapping[] = [
        {
          framework: 'GDPR',
          control_code: 'DATA_MINIMIZATION',
          status: 'implemented',
          source: 'manual' as const,
        },
      ];
      const reconciled = reconcileProposals(proposals, current);
      expect(reconciled.length).toBe(0); // Manual mapping not overwritten
    });

    it('should update auto-mappings that changed', () => {
      const proposals = [
        {
          framework: 'GDPR',
          control_code: 'DATA_MINIMIZATION',
          status: 'gap' as const,
          rationale: 'Has PII',
        },
      ];
      const current: CurrentMapping[] = [
        {
          framework: 'GDPR',
          control_code: 'DATA_MINIMIZATION',
          status: 'implemented',
          source: 'auto' as const, // Auto-generated previously
        },
      ];
      const reconciled = reconcileProposals(proposals, current);
      expect(reconciled.length).toBe(1); // Updated because source='auto' and status changed
      expect(reconciled[0].status).toBe('gap');
    });

    it('should not propose when status matches', () => {
      const proposals = [
        {
          framework: 'GDPR',
          control_code: 'DATA_MINIMIZATION',
          status: 'gap' as const,
          rationale: 'Has PII',
        },
      ];
      const current: CurrentMapping[] = [
        {
          framework: 'GDPR',
          control_code: 'DATA_MINIMIZATION',
          status: 'gap',
          source: 'auto' as const,
        },
      ];
      const reconciled = reconcileProposals(proposals, current);
      expect(reconciled.length).toBe(0); // No-op, status unchanged
    });
  });

  describe('Multi-Framework Scenarios', () => {
    it('should handle high-risk AI with special data (GDPR + EU_AI_ACT)', () => {
      const profile: AssetProfile = {
        assetType: 'ai_system',
        aiActClass: 'high',
        dataTypes: ['patient_diagnosis', 'genetic_data'],
        tenantIndustry: 'healthcare',
      };
      const controls: ControlRef[] = [
        { framework: 'EU_AI_ACT', control_code: 'HRIA' },
        { framework: 'GDPR', control_code: 'GDPR_ART9' },
        { framework: 'HEALTHCARE', control_code: 'HC_GDPR_PLUS' },
      ];
      const proposals = proposeControlStatuses(profile, controls);

      const aiAct = proposals.find((p) => p.framework === 'EU_AI_ACT');
      expect(aiAct?.status).toBe('gap'); // High-risk AI

      const gdpr = proposals.find((p) => p.framework === 'GDPR' && p.control_code === 'GDPR_ART9');
      expect(gdpr?.status).toBe('gap'); // Special categories

      const healthcare = proposals.find((p) => p.framework === 'HEALTHCARE');
      expect(healthcare?.status).toBe('gap'); // Healthcare tenant
    });

    it('should idempotently apply mappings', () => {
      const profile: AssetProfile = {
        assetType: 'ai_system',
        aiActClass: 'prohibited',
        dataTypes: ['personal_data'],
      };
      const controls: ControlRef[] = [
        { framework: 'EU_AI_ACT', control_code: 'PROHIBITED' },
      ];

      const first = computeAutoMappings(profile, controls, []);
      const firstAsCurrentMappings: CurrentMapping[] = first.map((p) => ({
        ...p,
        source: 'auto' as const,
      }));
      const second = computeAutoMappings(profile, controls, firstAsCurrentMappings);

      // Second run should be empty (idempotent)
      expect(second.length).toBe(0);
    });
  });

  describe('Edge Case: Industry-Specific Mixed Signals', () => {
    it('should prefer special-category detection over generic PII', () => {
      const profile: AssetProfile = {
        assetType: 'dataset',
        aiActClass: 'minimal',
        dataTypes: ['patient_health_records', 'generic_email'],
        tenantIndustry: 'healthcare',
      };
      const controls: ControlRef[] = [
        { framework: 'GDPR', control_code: 'GDPR_ART9' },
        { framework: 'GDPR', control_code: 'GDPR_DATA_MINIMIZATION' },
      ];
      const proposals = proposeControlStatuses(profile, controls);

      // Should include Art. 9 (special categories)
      const art9 = proposals.find((p) => p.control_code === 'GDPR_ART9');
      expect(art9).toBeDefined();
    });
  });
});
