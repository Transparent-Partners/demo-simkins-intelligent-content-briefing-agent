'use client';

import { LeftRail } from './LeftRail';
import { PlanningCanvas } from './PlanningCanvas';
import { AIPanel } from './AIPanel';
import { useUIStore } from '../../stores/uiStore';

// ============================================================================
// PLANNING WORKSPACE - Main 3-Panel Layout
// ============================================================================
// Layout: Left Rail | Central Planning Canvas | Right AI Panel
// This replaces the chat-centric layout with a canvas-primary approach
// ============================================================================

export function PlanningWorkspace() {
  const { leftRailCollapsed, rightPanelCollapsed } = useUIStore();

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Left Rail - Workflow Navigation */}
      <LeftRail />

      {/* Central Planning Canvas - Primary workspace */}
      <PlanningCanvas />

      {/* Right AI Panel - Facilitator assistant */}
      <AIPanel />
    </div>
  );
}

// ============================================================================
// LAYOUT VARIANTS
// ============================================================================

// Compact layout for smaller screens
export function PlanningWorkspaceCompact() {
  const { currentStage } = useUIStore();

  return (
    <div className="flex flex-col h-screen bg-slate-950">
      {/* Mobile Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <span className="text-white text-sm font-bold">M</span>
          </div>
          <span className="text-white font-semibold">ModCon Planner</span>
        </div>
        <button className="p-2 text-slate-400">
          <MenuIcon />
        </button>
      </div>

      {/* Stage Tabs */}
      <div className="flex border-b border-slate-800 overflow-x-auto">
        <StageTab stage="brief" label="Brief" />
        <StageTab stage="audiences" label="Audiences" />
        <StageTab stage="content_matrix" label="Matrix" />
        <StageTab stage="production" label="Production" />
        <StageTab stage="media" label="Media" />
      </div>

      {/* Canvas Area */}
      <div className="flex-1 overflow-y-auto">
        <PlanningCanvas />
      </div>

      {/* Bottom AI Bar */}
      <div className="border-t border-slate-800 p-4">
        <button className="w-full flex items-center justify-center gap-2 py-3 bg-slate-800 rounded-xl text-slate-300">
          <SparklesIcon />
          <span>Ask AI for help</span>
        </button>
      </div>
    </div>
  );
}

function StageTab({ stage, label }: { stage: string; label: string }) {
  const { currentStage, setCurrentStage } = useUIStore();
  const isActive = currentStage === stage;

  return (
    <button
      onClick={() => setCurrentStage(stage as any)}
      className={`
        px-4 py-3 text-sm font-medium whitespace-nowrap
        ${isActive
          ? 'text-blue-400 border-b-2 border-blue-400'
          : 'text-slate-500 hover:text-slate-300'
        }
      `}
    >
      {label}
    </button>
  );
}

// ============================================================================
// ICONS
// ============================================================================

function MenuIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
    </svg>
  );
}
