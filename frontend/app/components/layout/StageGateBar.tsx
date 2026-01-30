'use client';

import React from 'react';

type WorkspaceView = 'brief' | 'matrix' | 'concepts' | 'production' | 'feed';

type StageGateBarProps = {
  currentScore: number;
  isProductionReady: boolean;
  hasAudienceMatrix: boolean;
  hasConcepts: boolean;
  hasProductionPlan: boolean;
  threshold: number;
  onSwitch: (view: WorkspaceView) => void;
  onJumpToGap?: (gap: string) => void;
  gaps?: string[];
};

export function StageGateBar({
  currentScore,
  isProductionReady,
  hasAudienceMatrix,
  hasConcepts,
  hasProductionPlan,
  threshold,
  onSwitch,
  onJumpToGap,
  gaps = [],
}: StageGateBarProps) {
  return (
    <div className="px-8 py-3 bg-slate-50 border-b border-slate-200">
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Stage Gate</span>
        <button
          type="button"
          onClick={() => onSwitch('brief')}
          className={`px-2 py-1 rounded-full border ${
            currentScore > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white'
          }`}
        >
          1. Brief {currentScore > 0 ? '✓' : ''}
        </button>
        <button
          type="button"
          onClick={() => onSwitch('matrix')}
          className={`px-2 py-1 rounded-full border ${
            hasAudienceMatrix ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white'
          }`}
        >
          2. Audiences {hasAudienceMatrix ? '✓' : ''}
        </button>
        <button
          type="button"
          onClick={() => onSwitch('concepts')}
          className={`px-2 py-1 rounded-full border ${
            hasConcepts ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white'
          }`}
        >
          3. Concepts {hasConcepts ? '✓' : ''}
        </button>
        <button
          type="button"
          onClick={() => onSwitch('production')}
          className={`px-2 py-1 rounded-full border ${
            hasProductionPlan ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white'
          }`}
        >
          4. Production {hasProductionPlan ? '✓' : ''}
        </button>
        <button
          type="button"
          onClick={() => onSwitch('feed')}
          className={`px-2 py-1 rounded-full border ${
            isProductionReady ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white'
          }`}
        >
          5. Feed {isProductionReady ? '✓' : ''}
        </button>
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
          {!isProductionReady && <span>Brief must reach {threshold}/10 before Production + Feed.</span>}
          {!hasAudienceMatrix && <span>Add at least one audience row.</span>}
          {!hasConcepts && <span>Draft or upload at least one concept.</span>}
          {!hasProductionPlan && <span>Generate a production plan.</span>}
          {gaps.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <span>Fix:</span>
              {gaps.slice(0, 2).map((gap) => (
                <button
                  key={gap}
                  type="button"
                  onClick={() => onJumpToGap?.(gap)}
                  className="px-1.5 py-0.5 rounded-full border border-slate-200 bg-white text-slate-600 hover:text-teal-700 hover:border-teal-300"
                >
                  {gap}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
