'use client';

import { useUIStore } from '../../stores/uiStore';
import { usePlanningStore } from '../../stores/planningStore';
import { WORKFLOW_STAGES, type WorkflowStage } from '../../types/planning';

// ============================================================================
// LEFT RAIL - Workflow Navigation + Role Visibility
// ============================================================================

export function LeftRail() {
  const {
    leftRailCollapsed,
    toggleLeftRail,
    currentStage,
    setCurrentStage,
    roleLens,
  } = useUIStore();

  const { activationBrief, alignment } = usePlanningStore();

  if (leftRailCollapsed) {
    return (
      <div className="flex flex-col items-center py-4 px-2 bg-slate-900 border-r border-slate-700 w-14">
        <button
          onClick={toggleLeftRail}
          className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white mb-6"
          title="Expand sidebar"
        >
          <ChevronRightIcon />
        </button>
        
        {/* Collapsed stage indicators */}
        <div className="flex flex-col gap-2">
          {WORKFLOW_STAGES.map((stage, index) => (
            <button
              key={stage.id}
              onClick={() => setCurrentStage(stage.id)}
              className={`
                w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium
                transition-all duration-150
                ${currentStage === stage.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                }
              `}
              title={stage.label}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-slate-900 border-r border-slate-700 w-60">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <span className="text-white text-sm font-bold">M</span>
          </div>
          <div>
            <h1 className="text-white font-semibold text-sm">ModCon Planner</h1>
            <p className="text-slate-400 text-xs">Planning Workspace</p>
          </div>
        </div>
        <button
          onClick={toggleLeftRail}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
          title="Collapse sidebar"
        >
          <ChevronLeftIcon />
        </button>
      </div>

      {/* Campaign Name */}
      {activationBrief.campaign_name && (
        <div className="px-4 py-3 border-b border-slate-700">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Campaign</p>
          <p className="text-white text-sm font-medium truncate">
            {activationBrief.campaign_name}
          </p>
        </div>
      )}

      {/* Workflow Stages */}
      <div className="flex-1 py-4">
        <p className="px-4 text-xs text-slate-500 uppercase tracking-wider mb-3">
          Planning Workflow
        </p>
        <nav className="space-y-1 px-2">
          {WORKFLOW_STAGES.map((stage, index) => {
            const isActive = currentStage === stage.id;
            const isComplete = getStageCompletionStatus(stage.id, activationBrief, alignment);
            
            return (
              <button
                key={stage.id}
                onClick={() => setCurrentStage(stage.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left
                  transition-all duration-150 group
                  ${isActive
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white border border-transparent'
                  }
                `}
              >
                <div className={`
                  w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
                  ${isActive
                    ? 'bg-blue-600 text-white'
                    : isComplete
                      ? 'bg-green-600 text-white'
                      : 'bg-slate-700 text-slate-400 group-hover:bg-slate-600'
                  }
                `}>
                  {isComplete && !isActive ? (
                    <CheckIcon />
                  ) : (
                    index + 1
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{stage.label}</p>
                  <p className="text-xs text-slate-500 truncate">{stage.description}</p>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Role Lens Indicator */}
      <div className="px-4 py-3 border-t border-slate-700">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
          Current View
        </p>
        <div className={`
          px-3 py-2 rounded-lg text-sm font-medium
          ${roleLens === 'all' ? 'bg-slate-700 text-white' : ''}
          ${roleLens === 'creative' ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' : ''}
          ${roleLens === 'production' ? 'bg-orange-600/20 text-orange-400 border border-orange-500/30' : ''}
          ${roleLens === 'media' ? 'bg-green-600/20 text-green-400 border border-green-500/30' : ''}
        `}>
          {roleLens.charAt(0).toUpperCase() + roleLens.slice(1)} Lens
        </div>
      </div>

      {/* Plan Status */}
      <div className="px-4 py-3 border-t border-slate-700">
        <PlanStatusIndicator />
      </div>
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function PlanStatusIndicator() {
  const { isDirty, lastSaved } = usePlanningStore();
  const { alignment } = usePlanningStore();

  const approvedCount = alignment.checkpoints.filter(c => c.status === 'approved').length;
  const totalCheckpoints = 3; // Creative, Production, Media

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">Plan Status</span>
        <span className={`text-xs ${isDirty ? 'text-amber-400' : 'text-green-400'}`}>
          {isDirty ? 'Unsaved changes' : 'Saved'}
        </span>
      </div>
      {approvedCount > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-300"
              style={{ width: `${(approvedCount / totalCheckpoints) * 100}%` }}
            />
          </div>
          <span className="text-xs text-slate-400">{approvedCount}/{totalCheckpoints}</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getStageCompletionStatus(
  stageId: WorkflowStage,
  brief: any,
  alignment: any
): boolean {
  switch (stageId) {
    case 'brief':
      return brief.completion_score >= 80;
    case 'audiences':
      return false; // TODO: Check audience count
    case 'content_matrix':
      return false; // TODO: Check matrix cells
    case 'production':
      return false; // TODO: Check production plan
    case 'media':
      return false; // TODO: Check media plan
    default:
      return false;
  }
}

// ============================================================================
// ICONS
// ============================================================================

function ChevronLeftIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  );
}
