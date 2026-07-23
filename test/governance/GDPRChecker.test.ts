import { describe, it, expect } from 'vitest';
import { GDPRChecker } from '../../src/governance/GDPRChecker';
import { AISystem } from '../../src/governance/types';

describe('GDPRChecker', () => {
  const baseSystem: AISystem = {
    id: 'sys-1',
    tenantId: 'tenant-1',
    name: 'Test AI System',
    description: 'Test system',
    riskClass: 'minimal',
    hasHighImpact: false,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  describe('getRequirements', () => {
    it('returns strict requirements for consent basis', () => {
      const req = GDPRChecker.getRequirements('consent');
      expect(req.basis).toBe('consent');
      expect(req.requiresConsent).toBe(true);
      expect(req.requiresDataProcessingAgreement).toBe(true);
      expect(req.requiresPrivacyImpactAssessment).toBe(true);
      expect(req.requiresDataProtectionOfficer).toBe(true);
      expect(req.requiresRightToErasure).toBe(true);
      expect(req.requiresRightToObjection).toBe(true);
    });

    it('returns contract basis requirements', () => {
      const req = GDPRChecker.getRequirements('contract');
      expect(req.basis).toBe('contract');
      expect(req.requiresConsent).toBe(false);
      expect(req.requiresDataProcessingAgreement).toBe(true);
      expect(req.requiresRightToErasure).toBe(false);
    });

    it('returns legal basis requirements', () => {
      const req = GDPRChecker.getRequirements('legal');
      expect(req.basis).toBe('legal');
      expect(req.requiresConsent).toBe(false);
      expect(req.requiresDataProtectionOfficer).toBe(true);
    });

    it('returns legitimate interest requirements', () => {
      const req = GDPRChecker.getRequirements('legitimate');
      expect(req.basis).toBe('legitimate');
      expect(req.requiresDataProcessingAgreement).toBe(true);
      expect(req.requiresPrivacyImpactAssessment).toBe(true);
      expect(req.requiresRightToErasure).toBe(true);
      expect(req.requiresRightToObjection).toBe(true);
    });

    it('returns none requirements for undefined basis', () => {
      const req = GDPRChecker.getRequirements('none');
      expect(req.basis).toBe('none');
      expect(req.requiresConsent).toBe(false);
      expect(req.requiresDataProtectionOfficer).toBe(false);
    });
  });

  describe('requiresDataProtectionImpactAssessment', () => {
    it('requires DPIA for biometric processing', () => {
      const system: AISystem = {
        ...baseSystem,
        usesBiometric: true
      };
      expect(GDPRChecker.requiresDataProtectionImpactAssessment(system)).toBe(true);
    });

    it('requires DPIA for LLM remote processing', () => {
      const system: AISystem = {
        ...baseSystem,
        usesLargeLangModel: true,
        usesRemoteProcessing: true
      };
      expect(GDPRChecker.requiresDataProtectionImpactAssessment(system)).toBe(true);
    });

    it('requires DPIA for high-impact systems', () => {
      const system: AISystem = {
        ...baseSystem,
        hasHighImpact: true
      };
      expect(GDPRChecker.requiresDataProtectionImpactAssessment(system)).toBe(true);
    });

    it('does not require DPIA for minimal-impact systems', () => {
      expect(GDPRChecker.requiresDataProtectionImpactAssessment(baseSystem)).toBe(false);
    });
  });

  describe('requiresDataProtectionOfficer', () => {
    it('requires DPO for consent basis', () => {
      expect(GDPRChecker.requiresDataProtectionOfficer('consent', false)).toBe(true);
    });

    it('requires DPO for public authorities', () => {
      expect(GDPRChecker.requiresDataProtectionOfficer('contract', true)).toBe(true);
    });

    it('requires DPO for legitimate interest', () => {
      expect(GDPRChecker.requiresDataProtectionOfficer('legitimate', false)).toBe(true);
    });

    it('does not require DPO for contract with private entity', () => {
      expect(GDPRChecker.requiresDataProtectionOfficer('contract', false)).toBe(false);
    });
  });

  describe('validateRetention', () => {
    it('validates appropriate retention period', () => {
      const result = GDPRChecker.validateRetention(36, 48);
      expect(result.valid).toBe(true);
    });

    it('rejects excessive retention period', () => {
      const result = GDPRChecker.validateRetention(72, 36);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('exceeds recommendation');
    });
  });

  describe('requiresAutomatedDecisionDisclosure', () => {
    it('requires disclosure for high-impact systems', () => {
      const system: AISystem = {
        ...baseSystem,
        hasHighImpact: true
      };
      expect(GDPRChecker.requiresAutomatedDecisionDisclosure(system)).toBe(true);
    });

    it('requires disclosure for biometric systems', () => {
      const system: AISystem = {
        ...baseSystem,
        usesBiometric: true
      };
      expect(GDPRChecker.requiresAutomatedDecisionDisclosure(system)).toBe(true);
    });

    it('does not require disclosure for low-impact systems', () => {
      expect(GDPRChecker.requiresAutomatedDecisionDisclosure(baseSystem)).toBe(false);
    });
  });

  describe('getApplicableRights', () => {
    it('includes all rights for consent basis', () => {
      const rights = GDPRChecker.getApplicableRights('consent');
      expect(rights).toContain('Right to be informed');
      expect(rights).toContain('Right of access');
      expect(rights).toContain('Right to erasure');
      expect(rights).toContain('Right to object');
      expect(rights).toContain('Right to withdraw consent');
      expect(rights).toContain('Right to data portability');
    });

    it('includes limited rights for contract basis', () => {
      const rights = GDPRChecker.getApplicableRights('contract');
      expect(rights).toContain('Right of access');
      expect(rights).toContain('Right to data portability');
      expect(rights).not.toContain('Right to erasure');
    });

    it('includes basic rights for legal basis', () => {
      const rights = GDPRChecker.getApplicableRights('legal');
      expect(rights).toContain('Right to be informed');
      expect(rights).toContain('Right of access');
      expect(rights).not.toContain('Right to erasure');
      expect(rights).not.toContain('Right to object');
    });
  });

  describe('analyze', () => {
    it('provides comprehensive compliance analysis for consent basis', () => {
      const analysis = GDPRChecker.analyze(baseSystem, 'consent', false);

      expect(analysis.basis).toBe('consent');
      expect(analysis.requirements.requiresConsent).toBe(true);
      expect(analysis.needsDPIA).toBe(false);
      expect(analysis.needsDPO).toBe(true);
      expect(analysis.recommendations.length).toBeGreaterThan(0);
      expect(analysis.recommendations).toContain('Obtain explicit, informed, freely given consent');
    });

    it('flags DPIA requirement for biometric systems', () => {
      const system: AISystem = {
        ...baseSystem,
        usesBiometric: true
      };

      const analysis = GDPRChecker.analyze(system, 'consent', false);

      expect(analysis.needsDPIA).toBe(true);
      expect(analysis.recommendations).toContain('Conduct Data Protection Impact Assessment');
    });

    it('identifies high-impact disclosure requirements', () => {
      const system: AISystem = {
        ...baseSystem,
        hasHighImpact: true
      };

      const analysis = GDPRChecker.analyze(system, 'legitimate', false);

      expect(analysis.recommendations).toContain(
        'Implement human review for significant decisions'
      );
    });

    it('flags undefined basis', () => {
      const analysis = GDPRChecker.analyze(baseSystem, 'none', false);

      expect(analysis.recommendations[0]).toContain('❌');
      expect(analysis.recommendations[0]).toContain('No valid legal basis');
    });

    it('includes applicable rights in analysis', () => {
      const analysis = GDPRChecker.analyze(baseSystem, 'consent', false);

      expect(analysis.applicableRights.length).toBeGreaterThan(0);
      expect(analysis.applicableRights).toContain('Right to be informed');
    });
  });
});
