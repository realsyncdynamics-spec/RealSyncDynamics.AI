import { useState } from 'react';
import { ArrowRight, Clock, Zap, TrendingUp } from 'lucide-react';
import { WORKFLOW_TEMPLATES } from '../../../config/workflows';
import type { WorkflowTemplate } from '../../../config/workflows';

interface WorkflowListProps {
  onSelectWorkflow: (workflow: WorkflowTemplate) => void;
  filterCategory?: WorkflowTemplate['category'];
}

const categoryLabels: Record<WorkflowTemplate['category'], string> = {
  policy: 'Policy',
  vendor: 'Vendor Management',
  incident: 'Incident Response',
  assessment: 'Assessment',
  documentation: 'Documentation',
};

const categoryIcons: Record<WorkflowTemplate['category'], React.FC<{ size: number; className?: string }>> = {
  policy: (props) => <Zap {...props} />,
  vendor: (props) => <TrendingUp {...props} />,
  incident: (props) => <Clock {...props} />,
  assessment: (props) => <Zap {...props} />,
  documentation: (props) => <Clock {...props} />,
};

export function WorkflowList({ onSelectWorkflow, filterCategory }: WorkflowListProps) {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const filtered = WORKFLOW_TEMPLATES.filter((w) => {
    if (filterCategory && w.category !== filterCategory) return false;
    if (selectedTag && !w.tags.includes(selectedTag)) return false;
    return true;
  });

  const allTags = Array.from(new Set(WORKFLOW_TEMPLATES.flatMap((w) => w.tags)));

  const getDifficultyColor = (difficulty: string): string => {
    switch (difficulty) {
      case 'easy':
        return 'bg-green-500/10 text-green-400 border border-green-500/20';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20';
      case 'hard':
        return 'bg-red-500/10 text-red-400 border border-red-500/20';
      default:
        return 'bg-titanium-500/10 text-titanium-400 border border-titanium-500/20';
    }
  };

  const getDifficultyLabel = (difficulty: string): string => {
    return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-titanium-50">Guided Workflows</h2>
        <p className="text-sm text-titanium-400 mt-1">
          Step-by-step workflows to guide you through complex compliance tasks
        </p>
      </div>

      {/* Tag Filter */}
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-wider text-titanium-400 font-semibold">
          Filter by tag
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedTag(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedTag === null
                ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/40'
                : 'bg-obsidian-800 border border-titanium-300/20 text-titanium-400 hover:text-titanium-50 hover:border-titanium-300/40'
            }`}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedTag === tag
                  ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/40'
                  : 'bg-obsidian-800 border border-titanium-300/20 text-titanium-400 hover:text-titanium-50 hover:border-titanium-300/40'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Workflow Cards */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {filtered.map((workflow) => {
          const IconComponent = categoryIcons[workflow.category];
          return (
            <div
              key={workflow.id}
              className="group bg-obsidian-800 border border-titanium-300/20 rounded-lg p-5 hover:border-cyan-500/40 hover:bg-obsidian-750 transition-all cursor-pointer"
              onClick={() => onSelectWorkflow(workflow)}
            >
              <div className="space-y-4">
                {/* Category & Icon */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded bg-cyan-600/10 border border-cyan-500/20 group-hover:border-cyan-500/40 transition-colors">
                      <IconComponent size={18} className="text-cyan-400" />
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wider text-titanium-400 font-semibold">
                        {categoryLabels[workflow.category]}
                      </div>
                      <h3 className="text-base font-semibold text-titanium-50 mt-0.5">
                        {workflow.name}
                      </h3>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded text-xs font-medium ${getDifficultyColor(workflow.difficulty)}`}>
                    {getDifficultyLabel(workflow.difficulty)}
                  </span>
                </div>

                {/* Description */}
                <p className="text-sm text-titanium-400 line-clamp-2">
                  {workflow.description}
                </p>

                {/* Metadata */}
                <div className="flex items-center gap-4 text-xs text-titanium-400 border-t border-titanium-300/10 pt-4">
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} />
                    {workflow.estimatedDuration}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {workflow.steps.length} steps
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {workflow.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-full text-xs bg-cyan-600/10 text-cyan-400 border border-cyan-500/20"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Start Button */}
                <button className="w-full mt-4 px-4 py-2.5 rounded bg-gradient-to-r from-cyan-600 to-cyan-500 text-obsidian-900 hover:from-cyan-500 hover:to-cyan-400 transition-all font-medium text-sm flex items-center justify-center gap-2 group-hover:gap-3">
                  Start Workflow
                  <ArrowRight size={16} className="transition-transform" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filtered.length === 0 && (
        <div className="text-center py-12">
          <div className="text-titanium-400 text-sm">No workflows match your filters</div>
        </div>
      )}
    </div>
  );
}
