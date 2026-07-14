import { useState } from 'react';
import { X } from 'lucide-react';
import { WorkflowList } from './WorkflowList';
import { WorkflowBuilder } from './WorkflowBuilder';
import { useWorkflow } from '../hooks/useWorkflow';
import type { WorkflowTemplate } from '../../../config/workflows';

interface WorkflowViewProps {
  tenantId: string;
  onClose?: () => void;
}

export function WorkflowView({ tenantId, onClose }: WorkflowViewProps) {
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowTemplate | null>(null);
  const { workflow, progress, saveProgress, completeWorkflow, resetWorkflow } = useWorkflow(
    selectedWorkflow?.id || ''
  );

  const handleSelectWorkflow = (w: WorkflowTemplate) => {
    setSelectedWorkflow(w);
  };

  const handleClose = () => {
    setSelectedWorkflow(null);
    if (onClose) {
      onClose();
    }
  };

  const handleWorkflowComplete = () => {
    completeWorkflow();
    setTimeout(() => {
      setSelectedWorkflow(null);
    }, 2000);
  };

  if (selectedWorkflow && workflow) {
    return (
      <div className="w-full space-y-4">
        {/* Header with Close */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedWorkflow(null)}
            className="text-sm text-titanium-400 hover:text-titanium-50 transition-colors flex items-center gap-2"
          >
            ← Back to Workflows
          </button>
          <button
            onClick={handleClose}
            className="p-1.5 rounded hover:bg-obsidian-800 transition-colors text-titanium-400 hover:text-titanium-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Workflow Builder */}
        <WorkflowBuilder
          workflow={workflow}
          onComplete={handleWorkflowComplete}
          onSave={saveProgress}
        />

        {/* Completion Message */}
        {progress?.status === 'completed' && (
          <div className="mt-6 p-4 rounded bg-green-500/10 border border-green-500/20">
            <div className="text-green-400 font-medium text-sm">✓ Workflow completed successfully!</div>
            <div className="text-green-400/70 text-xs mt-1">
              All steps have been documented and saved to your audit trail.
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full">
      <WorkflowList onSelectWorkflow={handleSelectWorkflow} />
    </div>
  );
}
