'use client';

import { useState } from 'react';
import { usePlanningStore } from '../../stores/planningStore';
import { useToast, Button } from '../ui';
import type { AlignmentCheckpoint, AlignmentStatus } from '../../types/planning';

// ============================================================================
// ALIGNMENT CHECKPOINTS
// ModCon fails when misalignment is discovered too late.
// This component implements approval gates for cross-functional trust.
// ============================================================================

const ROLE_CONFIGS = {
  creative: {
    label: 'Creative',
    color: 'purple',
    description: 'Creative team sign-off',
  },
  production: {
    label: 'Production',
    color: 'orange',
    description: 'Production feasibility confirmation',
  },
  media: {
    label: 'Media',
    color: 'green',
    description: 'Media assumption validation',
  },
};

type Role = keyof typeof ROLE_CONFIGS;

export function AlignmentCheckpoints({ artifactId }: { artifactId: string }) {
  const { alignment, updateCheckpoint, lockPlan, unlockPlan } = usePlanningStore();
  const [expandedRole, setExpandedRole] = useState<Role | null>(null);

  const getCheckpointForRole = (role: Role): AlignmentCheckpoint | undefined => {
    return alignment.checkpoints.find(
      (c) => c.role === role && c.artifact === artifactId
    );
  };

  const allApproved = (['creative', 'production', 'media'] as Role[]).every((role) => {
    const checkpoint = getCheckpointForRole(role);
    return checkpoint?.status === 'approved';
  });

  const handleApprove = (role: Role, comment: string) => {
    updateCheckpoint(role, artifactId as any, 'approved', comment);
    setExpandedRole(null);
  };

  const handleRequestRevision = (role: Role, comment: string) => {
    updateCheckpoint(role, artifactId as any, 'revision_requested', comment);
    setExpandedRole(null);
    unlockPlan();
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-medium">Alignment Checkpoints</h3>
        {alignment.is_plan_locked && (
          <span className="px-3 py-1 bg-green-600/20 text-green-400 rounded-lg text-sm flex items-center gap-2">
            <LockIcon />
            Plan Locked
          </span>
        )}
      </div>

      <p className="text-slate-400 text-sm mb-6">
        Before this artifact is &ldquo;Ready,&rdquo; each team must confirm their alignment.
      </p>

      {/* Checkpoint Cards */}
      <div className="space-y-4">
        {(['creative', 'production', 'media'] as Role[]).map((role) => {
          const config = ROLE_CONFIGS[role];
          const checkpoint = getCheckpointForRole(role);
          const status = checkpoint?.status || 'pending';

          return (
            <CheckpointCard
              key={role}
              role={role}
              config={config}
              status={status}
              checkpoint={checkpoint}
              isExpanded={expandedRole === role}
              onToggle={() => setExpandedRole(expandedRole === role ? null : role)}
              onApprove={(comment) => handleApprove(role, comment)}
              onRequestRevision={(comment) => handleRequestRevision(role, comment)}
              isLocked={alignment.is_plan_locked}
            />
          );
        })}
      </div>

      {/* Lock/Unlock Button */}
      {allApproved && !alignment.is_plan_locked && (
        <div className="mt-6 pt-6 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">All Teams Aligned</p>
              <p className="text-slate-400 text-sm">
                Lock the plan to prevent further changes
              </p>
            </div>
            <button
              onClick={lockPlan}
              className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 flex items-center gap-2"
            >
              <LockIcon />
              Lock Plan
            </button>
          </div>
        </div>
      )}

      {alignment.is_plan_locked && (
        <div className="mt-6 pt-6 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">Plan is Locked</p>
              <p className="text-slate-400 text-sm">
                Unlock to make changes (will require re-approval)
              </p>
            </div>
            <button
              onClick={unlockPlan}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-600 flex items-center gap-2"
            >
              <UnlockIcon />
              Unlock for Revision
            </button>
          </div>
        </div>
      )}

      {/* Last revision timestamp */}
      {alignment.last_revision_at && (
        <p className="text-slate-500 text-xs mt-4">
          Last revision: {new Date(alignment.last_revision_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// CHECKPOINT CARD
// ============================================================================

function CheckpointCard({
  role,
  config,
  status,
  checkpoint,
  isExpanded,
  onToggle,
  onApprove,
  onRequestRevision,
  isLocked,
}: {
  role: Role;
  config: (typeof ROLE_CONFIGS)[Role];
  status: AlignmentStatus;
  checkpoint?: AlignmentCheckpoint;
  isExpanded: boolean;
  onToggle: () => void;
  onApprove: (comment: string) => void;
  onRequestRevision: (comment: string) => void;
  isLocked: boolean;
}) {
  const [comment, setComment] = useState('');

  const getStatusStyles = () => {
    switch (status) {
      case 'approved':
        return 'bg-green-600/10 border-green-500/30';
      case 'revision_requested':
        return 'bg-amber-600/10 border-amber-500/30';
      default:
        return 'bg-slate-800 border-slate-700';
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'approved':
        return (
          <span className="px-2 py-1 bg-green-600/20 text-green-400 rounded text-xs font-medium flex items-center gap-1">
            <CheckIcon />
            Approved
          </span>
        );
      case 'revision_requested':
        return (
          <span className="px-2 py-1 bg-amber-600/20 text-amber-400 rounded text-xs font-medium flex items-center gap-1">
            <RevisionIcon />
            Revision Requested
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-slate-600/20 text-slate-400 rounded text-xs font-medium">
            Pending
          </span>
        );
    }
  };

  const getRoleColor = () => {
    switch (config.color) {
      case 'purple':
        return 'text-purple-400';
      case 'orange':
        return 'text-orange-400';
      case 'green':
        return 'text-green-400';
      default:
        return 'text-white';
    }
  };

  return (
    <div className={`rounded-lg border ${getStatusStyles()} transition-all`}>
      <div
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <RoleIcon role={role} />
          <div>
            <p className={`font-medium ${getRoleColor()}`}>{config.label}</p>
            <p className="text-slate-500 text-sm">{config.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {getStatusBadge()}
          {!isLocked && (
            <ChevronIcon className={isExpanded ? 'rotate-180' : ''} />
          )}
        </div>
      </div>

      {/* Expanded Section */}
      {isExpanded && !isLocked && (
        <div className="px-4 pb-4 border-t border-slate-700/50 pt-4">
          {status === 'approved' && checkpoint && (
            <div className="mb-4 p-3 bg-slate-800/50 rounded-lg">
              <p className="text-slate-400 text-sm">
                Approved on {new Date(checkpoint.approved_at!).toLocaleString()}
              </p>
              {checkpoint.comment && (
                <p className="text-white text-sm mt-2">&ldquo;{checkpoint.comment}&rdquo;</p>
              )}
            </div>
          )}

          {status === 'revision_requested' && checkpoint && (
            <div className="mb-4 p-3 bg-amber-600/10 rounded-lg">
              <p className="text-amber-400 text-sm font-medium">Revision Notes:</p>
              <p className="text-white text-sm mt-1">{checkpoint.comment}</p>
            </div>
          )}

          <div className="space-y-3">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment (optional)..."
              rows={2}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg
                text-white placeholder-slate-500 text-sm
                focus:outline-none focus:border-blue-500"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  onApprove(comment);
                  setComment('');
                }}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 flex items-center justify-center gap-2"
              >
                <CheckIcon />
                Approve
              </button>
              <button
                onClick={() => {
                  if (!comment.trim()) {
                    // Focus the comment input instead
                    const textarea = document.querySelector('textarea');
                    textarea?.focus();
                    return;
                  }
                  onRequestRevision(comment);
                  setComment('');
                }}
                className="flex-1 py-2 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-600 flex items-center justify-center gap-2"
              >
                <RevisionIcon />
                Request Revision
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Show approval info when locked */}
      {isLocked && status === 'approved' && checkpoint && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-700/50">
          <p className="text-slate-400 text-sm">
            Approved {checkpoint.approved_at && new Date(checkpoint.approved_at).toLocaleDateString()}
            {checkpoint.comment && ` • "${checkpoint.comment}"`}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// COMPACT ALIGNMENT STATUS (for headers/summaries)
// ============================================================================

export function AlignmentStatusBadge({ artifactId }: { artifactId: string }) {
  const { alignment } = usePlanningStore();

  const getCheckpointStatus = (role: string) => {
    const checkpoint = alignment.checkpoints.find(
      (c) => c.role === role && c.artifact === artifactId
    );
    return checkpoint?.status || 'pending';
  };

  const roles = ['creative', 'production', 'media'];
  const approvedCount = roles.filter((r) => getCheckpointStatus(r) === 'approved').length;
  const hasRevisions = roles.some((r) => getCheckpointStatus(r) === 'revision_requested');

  if (approvedCount === 3) {
    return (
      <span className="px-2 py-1 bg-green-600/20 text-green-400 rounded text-xs font-medium flex items-center gap-1">
        <CheckIcon />
        Aligned
      </span>
    );
  }

  if (hasRevisions) {
    return (
      <span className="px-2 py-1 bg-amber-600/20 text-amber-400 rounded text-xs font-medium flex items-center gap-1">
        <RevisionIcon />
        Needs Revision
      </span>
    );
  }

  return (
    <span className="px-2 py-1 bg-slate-600/20 text-slate-400 rounded text-xs font-medium">
      {approvedCount}/3 Approved
    </span>
  );
}

// ============================================================================
// ICONS
// ============================================================================

function RoleIcon({ role }: { role: Role }) {
  const baseClass = "w-10 h-10 rounded-lg flex items-center justify-center";
  
  switch (role) {
    case 'creative':
      return (
        <div className={`${baseClass} bg-purple-600/20`}>
          <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
        </div>
      );
    case 'production':
      return (
        <div className={`${baseClass} bg-orange-600/20`}>
          <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        </div>
      );
    case 'media':
      return (
        <div className={`${baseClass} bg-green-600/20`}>
          <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
      );
  }
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function RevisionIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

function UnlockIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
    </svg>
  );
}

function ChevronIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`w-5 h-5 text-slate-400 transition-transform ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}
