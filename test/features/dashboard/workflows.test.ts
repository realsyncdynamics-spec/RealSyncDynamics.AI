import { describe, it, expect } from 'vitest';
import { WORKFLOW_TEMPLATES, getWorkflowById, getWorkflowsByCategory, getWorkflowsByTag } from '../../../src/config/workflows';

describe('Workflow Configuration', () => {
  it('should have at least 5 workflow templates', () => {
    expect(WORKFLOW_TEMPLATES.length).toBeGreaterThanOrEqual(5);
  });

  it('should have required workflow templates', () => {
    const ids = WORKFLOW_TEMPLATES.map((w) => w.id);
    expect(ids).toContain('dpia-assessment');
    expect(ids).toContain('vendor-onboarding');
    expect(ids).toContain('policy-documentation');
    expect(ids).toContain('incident-response');
    expect(ids).toContain('vendor-risk-assessment');
  });

  describe('Workflow Templates', () => {
    WORKFLOW_TEMPLATES.forEach((workflow) => {
      it(`${workflow.id} should have valid structure`, () => {
        expect(workflow.id).toBeDefined();
        expect(workflow.name).toBeDefined();
        expect(workflow.description).toBeDefined();
        expect(workflow.category).toBeDefined();
        expect(workflow.estimatedDuration).toBeDefined();
        expect(workflow.difficulty).toMatch(/easy|medium|hard/);
        expect(Array.isArray(workflow.steps)).toBe(true);
        expect(workflow.steps.length).toBeGreaterThan(0);
        expect(Array.isArray(workflow.tags)).toBe(true);
      });

      it(`${workflow.id} should have valid steps`, () => {
        workflow.steps.forEach((step) => {
          expect(step.id).toBeDefined();
          expect(step.title).toBeDefined();
          expect(step.description).toBeDefined();
          expect(step.instruction).toBeDefined();
          expect(step.estimatedTime).toBeDefined();
        });
      });
    });
  });

  describe('Workflow Lookup Functions', () => {
    it('getWorkflowById should return correct workflow', () => {
      const workflow = getWorkflowById('dpia-assessment');
      expect(workflow).toBeDefined();
      expect(workflow?.id).toBe('dpia-assessment');
      expect(workflow?.name).toBe('DPIA Assessment Workflow');
    });

    it('getWorkflowById should return undefined for unknown workflow', () => {
      const workflow = getWorkflowById('nonexistent');
      expect(workflow).toBeUndefined();
    });

    it('getWorkflowsByCategory should filter correctly', () => {
      const assessmentWorkflows = getWorkflowsByCategory('assessment');
      expect(assessmentWorkflows.length).toBeGreaterThan(0);
      expect(assessmentWorkflows.every((w) => w.category === 'assessment')).toBe(true);
    });

    it('getWorkflowsByTag should filter correctly', () => {
      const gdprWorkflows = getWorkflowsByTag('GDPR');
      expect(gdprWorkflows.length).toBeGreaterThan(0);
      expect(gdprWorkflows.every((w) => w.tags.includes('GDPR'))).toBe(true);
    });

    it('getWorkflowsByTag should return empty array for non-existent tag', () => {
      const workflows = getWorkflowsByTag('NonexistentTag');
      expect(workflows).toEqual([]);
    });
  });
});
