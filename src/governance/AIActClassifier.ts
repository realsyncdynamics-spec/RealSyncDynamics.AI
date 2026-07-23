/**
 * AI Act Classifier — Determines AI Act risk class and requirements.
 * Implements EU AI Act Articles 6 & 8 classification logic.
 */

import {
  AISystem,
  AIActRiskClass,
  AIActRequirements
} from './types';

/**
 * Classifies AI systems according to EU AI Act risk tiers.
 */
export class AIActClassifier {
  /**
   * Classify an AI system's risk level per EU AI Act.
   *
   * Risk classes (Article 6):
   * - Prohibited: Violates fundamental rights
   * - High: Significant risk to fundamental rights or safety
   * - Limited: Some risk, requires transparency
   * - Minimal: Low risk, general compliance
   */
  static classify(system: AISystem): AIActRiskClass {
    // Check for prohibited uses (Article 5)
    if (this.isProhibited(system)) {
      return 'prohibited';
    }

    // Check for high-risk (Article 6, Annex III)
    if (this.isHighRisk(system)) {
      return 'high';
    }

    // Check for limited-risk (transparency requirements)
    if (this.isLimitedRisk(system)) {
      return 'limited';
    }

    return 'minimal';
  }

  /**
   * Get requirements for a risk class.
   */
  static getRequirements(riskClass: AIActRiskClass): AIActRequirements {
    switch (riskClass) {
      case 'prohibited':
        return {
          riskClass: 'prohibited',
          requiresRiskAssessment: false, // Prohibited entirely
          requiresDataProcessingAgreement: false,
          requiresExplainability: false,
          requiresHumanOversight: false,
          requiresDocumentation: false,
          requiresAuditTrail: false,
          prohibitedUseCase: true,
          minimumControls: 0
        };

      case 'high':
        return {
          riskClass: 'high',
          requiresRiskAssessment: true,
          requiresDataProcessingAgreement: true,
          requiresExplainability: true,
          requiresHumanOversight: true,
          requiresDocumentation: true,
          requiresAuditTrail: true,
          prohibitedUseCase: false,
          minimumControls: 12
        };

      case 'limited':
        return {
          riskClass: 'limited',
          requiresRiskAssessment: true,
          requiresDataProcessingAgreement: false,
          requiresExplainability: true,
          requiresHumanOversight: false,
          requiresDocumentation: true,
          requiresAuditTrail: true,
          prohibitedUseCase: false,
          minimumControls: 6
        };

      case 'minimal':
      default:
        return {
          riskClass: 'minimal',
          requiresRiskAssessment: false,
          requiresDataProcessingAgreement: false,
          requiresExplainability: false,
          requiresHumanOversight: false,
          requiresDocumentation: true,
          requiresAuditTrail: false,
          prohibitedUseCase: false,
          minimumControls: 2
        };
    }
  }

  /**
   * Check if use case is prohibited (Article 5).
   */
  private static isProhibited(system: AISystem): boolean {
    // Real-time biometric identification in public (with narrow exceptions)
    if (system.usesBiometric && system.usesRemoteProcessing) {
      // Check if it's law enforcement (if data available)
      // For now, we treat all as prohibited to be conservative
      return true;
    }

    // Subliminal manipulation
    // Systems designed to manipulate behavior (e.g., dark patterns)
    // This would need explicit marking in system metadata

    // Social scoring (discrimination based on social behavior)
    // Would need explicit marking

    return false;
  }

  /**
   * Check if system is high-risk per Annex III.
   */
  private static isHighRisk(system: AISystem): boolean {
    const highRiskIndicators: boolean[] = [];

    // Biometric identification (Article 5.3)
    if (system.usesBiometric) {
      highRiskIndicators.push(true);
    }

    // Emotion recognition (Annex III, § 4.4)
    if (system.usesEmotionalRecognition) {
      highRiskIndicators.push(true);
    }

    // Large language models with remote processing
    if (system.usesLargeLangModel && system.usesRemoteProcessing) {
      highRiskIndicators.push(true);
    }

    // Systems affecting fundamental rights (employment, education, services)
    if (system.hasHighImpact) {
      highRiskIndicators.push(true);
    }

    // Critical infrastructure systems
    // Would need explicit marking

    return highRiskIndicators.length >= 1;
  }

  /**
   * Check if system requires transparency (limited-risk).
   */
  private static isLimitedRisk(system: AISystem): boolean {
    // Chatbots and generative AI using remote processing
    if (system.usesLargeLangModel && system.usesRemoteProcessing) {
      // This is actually high-risk, already handled above
      return false;
    }

    // Systems processing personal data
    // Default to limited-risk if not high or prohibited
    return true;
  }

  /**
   * Get human-readable risk class description.
   */
  static getDescription(riskClass: AIActRiskClass): string {
    switch (riskClass) {
      case 'prohibited':
        return 'Prohibited use case that violates EU AI Act Article 5';
      case 'high':
        return 'High-risk system requiring comprehensive compliance measures';
      case 'limited':
        return 'Limited-risk system requiring transparency and documentation';
      case 'minimal':
      default:
        return 'Minimal-risk system with basic compliance requirements';
    }
  }

  /**
   * Analyze system and return detailed classification report.
   */
  static analyze(system: AISystem): {
    riskClass: AIActRiskClass;
    description: string;
    requirements: AIActRequirements;
    riskIndicators: string[];
    recommendations: string[];
  } {
    const riskClass = this.classify(system);
    const requirements = this.getRequirements(riskClass);
    const description = this.getDescription(riskClass);
    const riskIndicators: string[] = [];
    const recommendations: string[] = [];

    // Identify risk indicators
    if (system.usesBiometric) {
      riskIndicators.push('Uses biometric identification');
      recommendations.push('Conduct biometric impact assessment');
      recommendations.push('Implement strict access controls');
    }

    if (system.usesEmotionalRecognition) {
      riskIndicators.push('Uses emotion recognition');
      recommendations.push('Document emotion recognition use case');
      recommendations.push('Obtain explicit user consent');
    }

    if (system.usesLargeLangModel) {
      riskIndicators.push('Uses large language model');
      recommendations.push('Provide transparency about LLM limitations');
      recommendations.push('Implement output monitoring');
    }

    if (system.usesRemoteProcessing) {
      riskIndicators.push('Uses remote processing');
      recommendations.push('Implement data protection measures');
      recommendations.push('Document data flows');
    }

    if (system.hasHighImpact) {
      riskIndicators.push('Has high impact on fundamental rights');
      recommendations.push('Conduct human rights impact assessment');
      recommendations.push('Ensure human oversight mechanisms');
    }

    if (riskClass === 'prohibited') {
      recommendations.push('❌ System use case is prohibited by EU AI Act');
      recommendations.push('Review system design and purpose immediately');
    } else if (riskClass === 'high') {
      recommendations.push('Establish risk management system');
      recommendations.push('Conduct data protection impact assessment');
      recommendations.push('Implement audit trail and logging');
      recommendations.push('Designate data protection officer');
    }

    return {
      riskClass,
      description,
      requirements,
      riskIndicators,
      recommendations
    };
  }
}
