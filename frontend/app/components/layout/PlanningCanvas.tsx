'use client';

import { useUIStore } from '../../stores/uiStore';
import { RoleLensToggleCompact } from './RoleLensToggle';
import { ActivationBriefArtifact } from '../artifacts/ActivationBrief';
import { AudienceMapArtifact } from '../artifacts/AudienceMap';
import { ContentScopeMatrixArtifact } from '../artifacts/ContentScopeMatrix';
import { ProductionPlanArtifact } from '../artifacts/ProductionPlan';
import { MediaAlignmentArtifact } from '../artifacts/MediaAlignment';
import { AlignmentCheckpoints } from '../artifacts/AlignmentCheckpoints';
import { WORKFLOW_STAGES } from '../../types/planning';

// ============================================================================
// PLANNING CANVAS - Central workspace for all planning artifacts
// ============================================================================

export function PlanningCanvas() {
  const { currentStage, roleLens, goToNextStage, goToPreviousStage } = useUIStore();
  
  const currentStageConfig = WORKFLOW_STAGES.find(s => s.id === currentStage);
  const currentIndex = WORKFLOW_STAGES.findIndex(s => s.id === currentStage);
  const isFirstStage = currentIndex === 0;
  const isLastStage = currentIndex === WORKFLOW_STAGES.length - 1;

  return (
    <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
      {/* Canvas Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-white font-semibold text-lg">
              {currentStageConfig?.label || 'Planning'}
            </h2>
            <p className="text-slate-400 text-sm">
              {currentStageConfig?.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Role Lens Toggle */}
          <RoleLensToggleCompact />

          {/* Stage Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousStage}
              disabled={isFirstStage}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800
                disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Previous stage"
            >
              <ChevronLeftIcon />
            </button>
            <span className="text-sm text-slate-500 min-w-[60px] text-center">
              {currentIndex + 1} / {WORKFLOW_STAGES.length}
            </span>
            <button
              onClick={goToNextStage}
              disabled={isLastStage}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800
                disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Next stage"
            >
              <ChevronRightIcon />
            </button>
          </div>
        </div>
      </div>

      {/* Canvas Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {/* Role Lens Indicator Banner */}
          {roleLens !== 'all' && (
            <div className={`
              mb-6 px-4 py-3 rounded-xl border
              ${roleLens === 'creative' ? 'bg-purple-600/10 border-purple-500/30 text-purple-400' : ''}
              ${roleLens === 'production' ? 'bg-orange-600/10 border-orange-500/30 text-orange-400' : ''}
              ${roleLens === 'media' ? 'bg-green-600/10 border-green-500/30 text-green-400' : ''}
            `}>
              <div className="flex items-center gap-2">
                <InfoIcon />
                <span className="text-sm">
                  Viewing with <strong>{roleLens}</strong> lens — 
                  {roleLens === 'creative' && ' emphasizing narrative, themes, and creative variants'}
                  {roleLens === 'production' && ' emphasizing volume, formats, and complexity'}
                  {roleLens === 'media' && ' emphasizing placements, flighting, and targeting'}
                </span>
              </div>
            </div>
          )}

          {/* Render Current Artifact */}
          <ArtifactRenderer stage={currentStage} />

          {/* Alignment Checkpoints (shown on all stages) */}
          <div className="mt-8">
            <AlignmentCheckpoints artifactId={currentStage} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ARTIFACT RENDERER
// ============================================================================

function ArtifactRenderer({ stage }: { stage: string }) {
  switch (stage) {
    case 'brief':
      return <ActivationBriefArtifact />;
    case 'audiences':
      return <AudienceMapArtifact />;
    case 'content_matrix':
      return <ContentScopeMatrixArtifact />;
    case 'production':
      return <ProductionPlanArtifact />;
    case 'media':
      return <MediaAlignmentArtifact />;
    default:
      return (
        <div className="text-center text-slate-500 py-20">
          <p>Select a planning stage from the left rail</p>
        </div>
      );
  }
}

// ============================================================================
// ICONS
// ============================================================================

function ChevronLeftIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
