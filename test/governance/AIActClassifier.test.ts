import { describe, it, expect } from 'vitest';
import { AIActClassifier } from '../../src/governance/AIActClassifier';
import { AISystem } from '../../src/governance/types';

describe('AIActClassifier', () => {
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

  describe('classify', () => {
    it('classifies prohibited biometric + remote processing systems', () => {
      const system: AISystem = {
        ...baseSystem,
        usesBiometric: true,
        usesRemoteProcessing: true
      };

      const result = AIActClassifier.classify(system);
      expect(result).toBe('prohibited');
    });

    it('classifies high-risk biometric systems', () => {
      const system: AISystem = {
        ...baseSystem,
        usesBiometric: true
      };

      const result = AIActClassifier.classify(system);
      expect(result).toBe('high');
    });

    it('classifies high-risk emotion recognition systems', () => {
      const system: AISystem = {
        ...baseSystem,
        usesEmotionalRecognition: true
      };

      const result = AIActClassifier.classify(system);
      expect(result).toBe('high');
    });

    it('classifies high-risk LLM remote processing systems', () => {
      const system: AISystem = {
        ...baseSystem,
        usesLargeLangModel: true,
        usesRemoteProcessing: true
      };

      const result = AIActClassifier.classify(system);
      expect(result).toBe('high');
    });

    it('classifies high-impact systems as high-risk', () => {
      const system: AISystem = {
        ...baseSystem,
        hasHighImpact: true
      };

      const result = AIActClassifier.classify(system);
      expect(result).toBe('high');
    });

    it('classifies minimal-risk systems by default', () => {
      const result = AIActClassifier.classify(baseSystem);
      expect(result).toBe('limited'); // Default to limited due to personal data processing
    });
  });

  describe('getRequirements', () => {
    it('returns strict requirements for prohibited systems', () => {
      const req = AIActClassifier.getRequirements('prohibited');
      expect(req.riskClass).toBe('prohibited');
      expect(req.prohibitedUseCase).toBe(true);
      expect(req.requiresRiskAssessment).toBe(false);
    });

    it('returns comprehensive requirements for high-risk systems', () => {
      const req = AIActClassifier.getRequirements('high');
      expect(req.riskClass).toBe('high');
      expect(req.requiresRiskAssessment).toBe(true);
      expect(req.requiresDataProcessingAgreement).toBe(true);
      expect(req.requiresExplainability).toBe(true);
      expect(req.requiresHumanOversight).toBe(true);
      expect(req.minimumControls).toBe(12);
    });

    it('returns transparency requirements for limited-risk systems', () => {
      const req = AIActClassifier.getRequirements('limited');
      expect(req.riskClass).toBe('limited');
      expect(req.requiresRiskAssessment).toBe(true);
      expect(req.requiresExplainability).toBe(true);
      expect(req.minimumControls).toBe(6);
    });

    it('returns minimal requirements for minimal-risk systems', () => {
      const req = AIActClassifier.getRequirements('minimal');
      expect(req.riskClass).toBe('minimal');
      expect(req.requiresRiskAssessment).toBe(false);
      expect(req.minimumControls).toBe(2);
    });
  });

  describe('analyze', () => {
    it('provides comprehensive analysis', () => {
      const system: AISystem = {
        ...baseSystem,
        usesBiometric: true,
        hasHighImpact: true
      };

      const analysis = AIActClassifier.analyze(system);

      expect(analysis.riskClass).toBe('high');
      expect(analysis.description).toContain('high-risk');
      expect(analysis.riskIndicators).toContain('Uses biometric identification');
      expect(analysis.riskIndicators).toContain('Has high impact on fundamental rights');
      expect(analysis.recommendations.length).toBeGreaterThan(0);
    });

    it('identifies biometric risks', () => {
      const system: AISystem = {
        ...baseSystem,
        usesBiometric: true
      };

      const analysis = AIActClassifier.analyze(system);

      expect(analysis.riskIndicators).toContain('Uses biometric identification');
      expect(analysis.recommendations).toContain('Conduct biometric impact assessment');
    });

    it('identifies emotion recognition risks', () => {
      const system: AISystem = {
        ...baseSystem,
        usesEmotionalRecognition: true
      };

      const analysis = AIActClassifier.analyze(system);

      expect(analysis.riskIndicators).toContain('Uses emotion recognition');
      expect(analysis.recommendations).toContain('Document emotion recognition use case');
    });

    it('identifies LLM risks', () => {
      const system: AISystem = {
        ...baseSystem,
        usesLargeLangModel: true,
        usesRemoteProcessing: true
      };

      const analysis = AIActClassifier.analyze(system);

      expect(analysis.riskIndicators).toContain('Uses large language model');
      expect(analysis.recommendations).toContain('Provide transparency about LLM limitations');
    });

    it('flags prohibited use cases', () => {
      const system: AISystem = {
        ...baseSystem,
        usesBiometric: true,
        usesRemoteProcessing: true
      };

      const analysis = AIActClassifier.analyze(system);

      expect(analysis.riskClass).toBe('prohibited');
      expect(analysis.recommendations).toContain(
        '❌ System use case is prohibited by EU AI Act'
      );
    });
  });

  describe('getDescription', () => {
    it('provides description for each risk class', () => {
      expect(AIActClassifier.getDescription('prohibited')).toContain('Prohibited');
      expect(AIActClassifier.getDescription('high')).toContain('high-risk');
      expect(AIActClassifier.getDescription('limited')).toContain('Limited');
      expect(AIActClassifier.getDescription('minimal')).toContain('Minimal');
    });
  });
});
