/**
 * GDPR Checker — Ensures compliance with GDPR requirements.
 * Implements data protection compliance checks per GDPR Articles.
 */

import {
  GDPRBasis,
  GDPRRequirements,
  AISystem
} from './types';

/**
 * Verifies GDPR compliance for AI systems processing personal data.
 */
export class GDPRChecker {
  /**
   * Get GDPR requirements for a legal basis.
   *
   * Basis (Article 6):
   * - consent: User gave explicit, informed consent
   * - contract: Processing needed for contract performance
   * - legal: Legal obligation (law, court order)
   * - vital: Protect vital interests
   * - public: Perform public task
   * - legitimate: Legitimate interests (with balancing test)
   */
  static getRequirements(basis: GDPRBasis): GDPRRequirements {
    switch (basis) {
      case 'consent':
        return {
          basis: 'consent',
          requiresConsent: true,
          requiresDataProcessingAgreement: true,
          requiresPrivacyImpactAssessment: true,
          requiresDataProtectionOfficer: true,
          dataRetentionMonths: 36,
          requiresRightToAccess: true,
          requiresRightToErasure: true,
          requiresRightToObjection: true
        };

      case 'contract':
        return {
          basis: 'contract',
          requiresConsent: false,
          requiresDataProcessingAgreement: true,
          requiresPrivacyImpactAssessment: false,
          requiresDataProtectionOfficer: false,
          dataRetentionMonths: 12,
          requiresRightToAccess: true,
          requiresRightToErasure: false,
          requiresRightToObjection: false
        };

      case 'legal':
        return {
          basis: 'legal',
          requiresConsent: false,
          requiresDataProcessingAgreement: false,
          requiresPrivacyImpactAssessment: false,
          requiresDataProtectionOfficer: true,
          dataRetentionMonths: 24,
          requiresRightToAccess: true,
          requiresRightToErasure: false,
          requiresRightToObjection: false
        };

      case 'vital':
        return {
          basis: 'vital',
          requiresConsent: false,
          requiresDataProcessingAgreement: false,
          requiresPrivacyImpactAssessment: true,
          requiresDataProtectionOfficer: true,
          dataRetentionMonths: 6,
          requiresRightToAccess: true,
          requiresRightToErasure: false,
          requiresRightToObjection: false
        };

      case 'public':
        return {
          basis: 'public',
          requiresConsent: false,
          requiresDataProcessingAgreement: false,
          requiresPrivacyImpactAssessment: false,
          requiresDataProtectionOfficer: false,
          dataRetentionMonths: 24,
          requiresRightToAccess: true,
          requiresRightToErasure: false,
          requiresRightToObjection: false
        };

      case 'legitimate':
        return {
          basis: 'legitimate',
          requiresConsent: false,
          requiresDataProcessingAgreement: true,
          requiresPrivacyImpactAssessment: true,
          requiresDataProtectionOfficer: true,
          dataRetentionMonths: 36,
          requiresRightToAccess: true,
          requiresRightToErasure: true,
          requiresRightToObjection: true
        };

      case 'none':
      default:
        return {
          basis: 'none',
          requiresConsent: false,
          requiresDataProcessingAgreement: false,
          requiresPrivacyImpactAssessment: false,
          requiresDataProtectionOfficer: false,
          requiresRightToAccess: false,
          requiresRightToErasure: false,
          requiresRightToObjection: false
        };
    }
  }

  /**
   * Check if data processing needs a Data Protection Impact Assessment (DPIA).
   * Per Article 35 GDPR.
   */
  static requiresDataProtectionImpactAssessment(system: AISystem): boolean {
    // Biometric processing (Article 35.3.b)
    if (system.usesBiometric) {
      return true;
    }

    // Large-scale systematic monitoring (Article 35.3.a)
    if (system.usesLargeLangModel && system.usesRemoteProcessing) {
      return true;
    }

    // Automated decision-making affecting legal rights (Article 35.3.a)
    if (system.hasHighImpact) {
      return true;
    }

    // Processing of special categories (would need explicit marking)

    return false;
  }

  /**
   * Check if a Data Protection Officer (DPO) is required.
   * Per Article 37 GDPR.
   */
  static requiresDataProtectionOfficer(basis: GDPRBasis, isPublicAuthority: boolean): boolean {
    // Public authorities must have DPO (with exceptions)
    if (isPublicAuthority) {
      return true;
    }

    // For consent basis, DPO is required
    if (basis === 'consent') {
      return true;
    }

    // For legitimate interests, DPO is recommended
    if (basis === 'legitimate') {
      return true;
    }

    return false;
  }

  /**
   * Validate that retention period is appropriate.
   * Per Article 5.1.e GDPR (storage limitation).
   */
  static validateRetention(
    currentRetentionMonths: number,
    recommendedMonths: number
  ): { valid: boolean; message: string } {
    if (currentRetentionMonths <= recommendedMonths) {
      return {
        valid: true,
        message: `Retention period of ${currentRetentionMonths} months is appropriate`
      };
    }

    return {
      valid: false,
      message: `Retention period of ${currentRetentionMonths} months exceeds recommendation of ${recommendedMonths} months`
    };
  }

  /**
   * Check if automated decision-making disclosure is required.
   * Per Article 13.2.f & 14.2.g GDPR.
   */
  static requiresAutomatedDecisionDisclosure(system: AISystem): boolean {
    // Systems making significant decisions about individuals
    if (system.hasHighImpact) {
      return true;
    }

    // Biometric systems
    if (system.usesBiometric) {
      return true;
    }

    return false;
  }

  /**
   * Get Data Subject rights applicable to the legal basis.
   */
  static getApplicableRights(basis: GDPRBasis): string[] {
    const requirements = this.getRequirements(basis);
    const rights: string[] = [
      'Right to be informed',
      'Right of access'
    ];

    if (requirements.requiresRightToErasure) {
      rights.push('Right to erasure');
    }

    if (requirements.requiresRightToObjection) {
      rights.push('Right to object');
    }

    // Withdraw consent (if applicable)
    if (basis === 'consent') {
      rights.push('Right to withdraw consent');
    }

    // Data portability for consent and contract
    if (basis === 'consent' || basis === 'contract') {
      rights.push('Right to data portability');
    }

    return rights;
  }

  /**
   * Analyze GDPR compliance for an AI system.
   */
  static analyze(
    system: AISystem,
    basis: GDPRBasis,
    isPublicAuthority: boolean = false
  ): {
    basis: GDPRBasis;
    requirements: GDPRRequirements;
    needsDPIA: boolean;
    needsDPO: boolean;
    applicableRights: string[];
    recommendations: string[];
  } {
    const requirements = this.getRequirements(basis);
    const needsDPIA = this.requiresDataProtectionImpactAssessment(system);
    const needsDPO = this.requiresDataProtectionOfficer(basis, isPublicAuthority);
    const applicableRights = this.getApplicableRights(basis);
    const recommendations: string[] = [];

    // Generate recommendations
    if (basis === 'none') {
      recommendations.push('❌ No valid legal basis identified');
      recommendations.push('Select an appropriate legal basis (Article 6 GDPR)');
    }

    if (needsDPIA) {
      recommendations.push('Conduct Data Protection Impact Assessment (Article 35)');
    }

    if (needsDPO) {
      recommendations.push('Designate a Data Protection Officer (Article 37)');
    }

    if (requirements.requiresConsent) {
      recommendations.push('Obtain explicit, informed, freely given consent');
      recommendations.push('Implement consent withdrawal mechanism');
    }

    if (requirements.requiresDataProcessingAgreement) {
      recommendations.push('Execute Data Processing Agreement (if using processors)');
    }

    if (system.usesBiometric) {
      recommendations.push('Special rules apply for biometric processing');
      recommendations.push('Article 9 restrictions may apply');
    }

    if (system.hasHighImpact) {
      recommendations.push('Implement human review for significant decisions (Article 22)');
      recommendations.push('Provide explanation of automated decision-making');
    }

    recommendations.push('Implement data subject rights fulfillment processes');
    recommendations.push('Document processing activities in Records of Processing');

    return {
      basis,
      requirements,
      needsDPIA,
      needsDPO,
      applicableRights,
      recommendations
    };
  }
}
