import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { WorkflowTemplate, WorkflowStep } from '../../../config/workflows';

interface WorkflowBuilderProps {
  workflow: WorkflowTemplate;
  onComplete?: () => void;
  onSave?: (stepIndex: number, stepData: Record<string, any>) => void;
}

interface StepState {
  [stepId: string]: Record<string, any>;
}

export function WorkflowBuilder({ workflow, onComplete, onSave }: WorkflowBuilderProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepStates, setStepStates] = useState<StepState>({});
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const currentStep = workflow.steps[currentStepIndex];
  const progressPercent = ((currentStepIndex + 1) / workflow.steps.length) * 100;

  useEffect(() => {
    sessionStorage.setItem(
      `workflow-${workflow.id}-progress`,
      JSON.stringify({
        currentStep: currentStepIndex,
        completedSteps: Array.from(completedSteps),
        states: stepStates,
      })
    );
  }, [currentStepIndex, completedSteps, stepStates, workflow.id]);

  const handleStepInputChange = (fieldName: string, value: any) => {
    setStepStates((prev) => ({
      ...prev,
      [currentStep.id]: {
        ...(prev[currentStep.id] || {}),
        [fieldName]: value,
      },
    }));
  };

  const handleCompleteStep = () => {
    const newCompleted = new Set(completedSteps);
    newCompleted.add(currentStepIndex);
    setCompletedSteps(newCompleted);

    if (onSave) {
      onSave(currentStepIndex, stepStates[currentStep.id] || {});
    }

    if (currentStepIndex < workflow.steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      if (onComplete) {
        onComplete();
      }
    }
  };

  const handlePreviousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleSkipStep = () => {
    if (currentStepIndex < workflow.steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-obsidian-900 rounded-lg border border-titanium-300/20 p-6 space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-titanium-50">{workflow.name}</h2>
          <p className="text-sm text-titanium-400 mt-1">{workflow.description}</p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-titanium-400">
              Step {currentStepIndex + 1} of {workflow.steps.length}
            </span>
            <span className="text-titanium-300 font-medium">{Math.round(progressPercent)}%</span>
          </div>
          <div className="w-full h-2 bg-obsidian-800 rounded-full overflow-hidden border border-titanium-300/20">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-cyan-600 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Meta Info */}
        <div className="flex gap-4 text-xs text-titanium-400">
          <div className="flex items-center gap-1.5">
            <Clock size={14} />
            Est. {currentStep.estimatedTime}
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={14} />
            {completedSteps.size} of {workflow.steps.length} completed
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="space-y-4 bg-obsidian-800/50 rounded-lg p-5 border border-titanium-300/10">
        <div className="space-y-2">
          <h3 className="text-lg font-medium text-titanium-50">{currentStep.title}</h3>
          <p className="text-sm text-titanium-400">{currentStep.description}</p>
        </div>

        {/* Instruction Box */}
        <div className="flex gap-3 p-4 bg-blue-500/5 rounded border border-blue-500/20">
          <AlertCircle size={18} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-titanium-300">{currentStep.instruction}</div>
        </div>

        {/* Input Area */}
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-titanium-400 font-semibold mb-2 block">
              Your Input
            </span>
            <textarea
              value={stepStates[currentStep.id]?.input || ''}
              onChange={(e) => handleStepInputChange('input', e.target.value)}
              placeholder="Enter your response or findings..."
              className="w-full bg-obsidian-900 border border-titanium-300/20 rounded px-3 py-2 text-sm text-titanium-50 placeholder:text-titanium-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-colors"
              rows={4}
            />
          </label>
        </div>

        {/* Help Link */}
        {currentStep.helpLink && (
          <div className="pt-2 border-t border-titanium-300/10">
            <a
              href={currentStep.helpLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-cyan-400 hover:text-cyan-300 underline transition-colors"
            >
              Need help? View documentation →
            </a>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 justify-between pt-4 border-t border-titanium-300/10">
        <div className="flex gap-2">
          <button
            onClick={handlePreviousStep}
            disabled={currentStepIndex === 0}
            className="flex items-center gap-2 px-4 py-2 rounded border border-titanium-300/20 text-titanium-400 hover:text-titanium-50 hover:border-titanium-300/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            <ChevronLeft size={16} />
            Previous
          </button>
          <button
            onClick={handleSkipStep}
            className="px-4 py-2 rounded border border-titanium-300/20 text-titanium-400 hover:text-titanium-50 hover:border-titanium-300/40 transition-colors text-sm font-medium"
          >
            Skip Step
          </button>
        </div>

        <button
          onClick={handleCompleteStep}
          className="flex items-center gap-2 px-6 py-2 rounded bg-gradient-to-r from-cyan-600 to-cyan-500 text-obsidian-900 hover:from-cyan-500 hover:to-cyan-400 transition-all font-medium text-sm"
        >
          {currentStepIndex === workflow.steps.length - 1 ? 'Complete Workflow' : 'Next Step'}
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Step List */}
      <div className="border-t border-titanium-300/10 pt-4">
        <div className="text-xs uppercase tracking-wider text-titanium-400 font-semibold mb-3">
          Workflow Steps
        </div>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {workflow.steps.map((step, idx) => (
            <button
              key={step.id}
              onClick={() => setCurrentStepIndex(idx)}
              className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                idx === currentStepIndex
                  ? 'bg-cyan-600/20 border border-cyan-500/40 text-titanium-50'
                  : completedSteps.has(idx)
                    ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                    : 'bg-obsidian-800/30 border border-titanium-300/10 text-titanium-400 hover:text-titanium-50 hover:border-titanium-300/20'
              }`}
            >
              <div className="flex items-center gap-2">
                {completedSteps.has(idx) ? (
                  <CheckCircle2 size={14} className="text-green-400" />
                ) : (
                  <div className={`w-3 h-3 rounded-full ${idx === currentStepIndex ? 'bg-cyan-500' : 'bg-titanium-500'}`} />
                )}
                <span className="font-medium">{idx + 1}.</span>
                <span className="truncate">{step.title}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
