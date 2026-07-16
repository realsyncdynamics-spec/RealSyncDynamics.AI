import { useState, useCallback, useEffect } from 'react';
import { getWorkflowById } from '../../../config/workflows';
import type { WorkflowTemplate } from '../../../config/workflows';

interface WorkflowProgress {
  workflowId: string;
  currentStep: number;
  completedSteps: number[];
  states: Record<string, Record<string, any>>;
  startedAt: string;
  lastUpdatedAt: string;
  status: 'in_progress' | 'completed' | 'abandoned';
}

const STORAGE_KEY_PREFIX = 'workflow-progress-';

export function useWorkflow(workflowId: string) {
  const [workflow, setWorkflow] = useState<WorkflowTemplate | null>(null);
  const [progress, setProgress] = useState<WorkflowProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load workflow and resume progress from storage
  useEffect(() => {
    const templateWorkflow = getWorkflowById(workflowId);
    if (!templateWorkflow) {
      console.warn(`Workflow ${workflowId} not found`);
      setIsLoading(false);
      return;
    }

    setWorkflow(templateWorkflow);

    // Try to resume from sessionStorage
    const storageKey = STORAGE_KEY_PREFIX + workflowId;
    const stored = sessionStorage.getItem(storageKey);

    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setProgress({
          workflowId,
          currentStep: parsed.currentStep || 0,
          completedSteps: parsed.completedSteps || [],
          states: parsed.states || {},
          startedAt: parsed.startedAt || new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString(),
          status: 'in_progress',
        });
      } catch (e) {
        console.error('Failed to parse workflow progress:', e);
        initializeNewWorkflow(workflowId);
      }
    } else {
      initializeNewWorkflow(workflowId);
    }

    setIsLoading(false);
  }, [workflowId]);

  const initializeNewWorkflow = (id: string) => {
    setProgress({
      workflowId: id,
      currentStep: 0,
      completedSteps: [],
      states: {},
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      status: 'in_progress',
    });
  };

  const saveProgress = useCallback(
    (stepIndex: number, stepData: Record<string, any>) => {
      if (!progress) return;

      const updated: WorkflowProgress = {
        ...progress,
        currentStep: stepIndex,
        completedSteps: Array.from(new Set([...progress.completedSteps, stepIndex])),
        states: {
          ...progress.states,
          [stepIndex]: stepData,
        },
        lastUpdatedAt: new Date().toISOString(),
      };

      setProgress(updated);

      // Save to sessionStorage
      const storageKey = STORAGE_KEY_PREFIX + workflowId;
      sessionStorage.setItem(storageKey, JSON.stringify(updated));
    },
    [progress, workflowId]
  );

  const completeWorkflow = useCallback(() => {
    if (!progress) return;

    const completed: WorkflowProgress = {
      ...progress,
      status: 'completed',
      lastUpdatedAt: new Date().toISOString(),
    };

    setProgress(completed);

    // Save to sessionStorage
    const storageKey = STORAGE_KEY_PREFIX + workflowId;
    sessionStorage.setItem(storageKey, JSON.stringify(completed));

    // Clear after a delay to allow UI update
    setTimeout(() => {
      sessionStorage.removeItem(storageKey);
    }, 5000);
  }, [progress, workflowId]);

  const abandonWorkflow = useCallback(() => {
    if (!progress) return;

    const abandoned: WorkflowProgress = {
      ...progress,
      status: 'abandoned',
      lastUpdatedAt: new Date().toISOString(),
    };

    setProgress(abandoned);

    // Save to sessionStorage
    const storageKey = STORAGE_KEY_PREFIX + workflowId;
    sessionStorage.setItem(storageKey, JSON.stringify(abandoned));
  }, [progress, workflowId]);

  const resetWorkflow = useCallback(() => {
    const storageKey = STORAGE_KEY_PREFIX + workflowId;
    sessionStorage.removeItem(storageKey);
    initializeNewWorkflow(workflowId);
  }, [workflowId]);

  const getProgressPercent = useCallback((): number => {
    if (!workflow || !progress) return 0;
    return (progress.completedSteps.length / workflow.steps.length) * 100;
  }, [workflow, progress]);

  return {
    workflow,
    progress,
    isLoading,
    saveProgress,
    completeWorkflow,
    abandonWorkflow,
    resetWorkflow,
    getProgressPercent,
  };
}
