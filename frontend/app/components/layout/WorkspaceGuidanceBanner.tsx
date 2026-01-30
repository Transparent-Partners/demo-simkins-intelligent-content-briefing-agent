'use client';

import React from 'react';

type WorkspaceGuidanceBannerProps = {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
  variant?: 'light' | 'muted';
};

export function WorkspaceGuidanceBanner({
  title,
  body,
  actionLabel,
  onAction,
  disabled = false,
  variant = 'muted',
}: WorkspaceGuidanceBannerProps) {
  const base = variant === 'light' ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200';
  return (
    <div className={`px-6 py-3 border-b ${base}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{title}</p>
          <p className="text-[12px] text-slate-600">{body}</p>
        </div>
        <button
          type="button"
          onClick={onAction}
          disabled={disabled}
          className={`text-[11px] px-3 py-1.5 rounded-full border whitespace-nowrap ${
            disabled
              ? 'border-slate-200 text-slate-400 bg-slate-100 cursor-not-allowed'
              : 'border-teal-500 text-teal-700 bg-teal-50 hover:bg-teal-100'
          }`}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
