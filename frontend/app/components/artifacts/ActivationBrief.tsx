'use client';

import { useState } from 'react';
import { usePlanningStore } from '../../stores/planningStore';
import { useUIStore } from '../../stores/uiStore';
import { useToast, PromptModal, Button, Input, Textarea } from '../ui';
import type { ConfidenceLevel } from '../../types/planning';

// ============================================================================
// ARTIFACT 1: ACTIVATION BRIEF (Strategic Truth)
// ============================================================================

const BRIEF_FIELDS = [
  { key: 'campaign_name', label: 'Campaign Name', required: true, multiline: false },
  { key: 'objective', label: 'Objective', required: true, multiline: false, 
    placeholder: 'What is the business objective?' },
  { key: 'kpi', label: 'Key Performance Indicator', required: true, multiline: false,
    placeholder: 'How will success be measured?' },
  { key: 'primary_audience', label: 'Primary Audience', required: true, multiline: true,
    placeholder: 'Who is the primary target audience?' },
  { key: 'single_minded_proposition', label: 'Single-Minded Proposition', required: true, multiline: true,
    placeholder: 'What is the one thing we want the audience to believe?' },
  { key: 'success_definition', label: 'Success Definition', required: false, multiline: true,
    placeholder: 'What does success look like at the end of this campaign?' },
  { key: 'narrative_brief', label: 'Narrative Brief', required: false, multiline: true,
    placeholder: 'The story of this campaign in 2-3 paragraphs...' },
];

const CONSTRAINT_SUGGESTIONS = [
  'Budget cap',
  'Timeline constraint',
  'Brand guidelines restriction',
  'Legal/compliance requirement',
  'Platform limitation',
  'Seasonal window',
  'Resource availability',
];

export function ActivationBriefArtifact() {
  const { activationBrief, updateBrief, setBriefField, calculateBriefConfidence } = usePlanningStore();
  const { roleLens } = useUIStore();
  const toast = useToast();
  const [newConstraint, setNewConstraint] = useState('');
  const [isAddAudienceOpen, setIsAddAudienceOpen] = useState(false);

  const handleFieldChange = (key: string, value: string) => {
    setBriefField(key, value);
    // Recalculate confidence after a short delay
    setTimeout(() => calculateBriefConfidence(), 100);
  };

  const addConstraint = () => {
    if (newConstraint.trim()) {
      updateBrief({
        known_constraints: [...(activationBrief.known_constraints || []), newConstraint.trim()],
      });
      setNewConstraint('');
    }
  };

  const removeConstraint = (index: number) => {
    const updated = [...(activationBrief.known_constraints || [])];
    updated.splice(index, 1);
    updateBrief({ known_constraints: updated });
  };

  const addSecondaryAudience = (audience: string) => {
    if (audience.trim()) {
      updateBrief({
        secondary_audiences: [...(activationBrief.secondary_audiences || []), audience.trim()],
      });
      toast.success('Audience added', `"${audience.trim()}" added to secondary audiences`);
    }
    setIsAddAudienceOpen(false);
  };

  // Role-specific field emphasis
  const getFieldEmphasis = (key: string): boolean => {
    if (roleLens === 'all') return false;
    const creativeFields = ['narrative_brief', 'single_minded_proposition'];
    const productionFields = ['known_constraints'];
    const mediaFields = ['primary_audience', 'kpi'];

    if (roleLens === 'creative' && creativeFields.includes(key)) return true;
    if (roleLens === 'production' && productionFields.includes(key)) return true;
    if (roleLens === 'media' && mediaFields.includes(key)) return true;
    return false;
  };

  return (
    <div className="space-y-8">
      {/* Confidence Meter */}
      <ConfidenceMeter 
        completion={activationBrief.completion_score} 
        confidence={activationBrief.confidence_score} 
      />

      {/* Brief Fields */}
      <div className="space-y-6">
        {BRIEF_FIELDS.map((field) => {
          const value = (activationBrief as any)[field.key] || '';
          const isEmphasized = getFieldEmphasis(field.key);
          const warning = getFieldWarning(field.key, value);

          return (
            <div
              key={field.key}
              className={`
                transition-all duration-200
                ${isEmphasized ? 'ring-2 ring-offset-2 ring-offset-slate-950 rounded-xl' : ''}
                ${isEmphasized && roleLens === 'creative' ? 'ring-purple-500' : ''}
                ${isEmphasized && roleLens === 'production' ? 'ring-orange-500' : ''}
                ${isEmphasized && roleLens === 'media' ? 'ring-green-500' : ''}
              `}
            >
              <BriefField
                label={field.label}
                value={value}
                onChange={(v) => handleFieldChange(field.key, v)}
                required={field.required}
                multiline={field.multiline}
                placeholder={field.placeholder}
                warning={warning}
              />
            </div>
          );
        })}
      </div>

      {/* Secondary Audiences */}
      <div className="bg-slate-900 rounded-xl p-6 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-medium">Secondary Audiences</h3>
          <button
            onClick={() => setIsAddAudienceOpen(true)}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            + Add audience
          </button>
        </div>
        {activationBrief.secondary_audiences?.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {activationBrief.secondary_audiences.map((audience, i) => (
              <span
                key={i}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-sm flex items-center gap-2"
              >
                {audience}
                <button
                  onClick={() => {
                    const updated = [...activationBrief.secondary_audiences];
                    updated.splice(i, 1);
                    updateBrief({ secondary_audiences: updated });
                  }}
                  className="text-slate-500 hover:text-red-400"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-slate-500 text-sm">No secondary audiences defined</p>
        )}
      </div>

      {/* Known Constraints */}
      <div className={`
        bg-slate-900 rounded-xl p-6 border border-slate-800
        ${roleLens === 'production' ? 'ring-2 ring-orange-500/50' : ''}
      `}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-medium">Known Constraints</h3>
          {roleLens === 'production' && (
            <span className="text-xs text-orange-400 bg-orange-600/20 px-2 py-1 rounded">
              Production focus
            </span>
          )}
        </div>
        
        {/* Existing constraints */}
        <div className="space-y-2 mb-4">
          {activationBrief.known_constraints?.map((constraint, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-4 py-2 bg-slate-800 rounded-lg"
            >
              <span className="text-slate-300 text-sm">{constraint}</span>
              <button
                onClick={() => removeConstraint(i)}
                className="text-slate-500 hover:text-red-400"
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>

        {/* Add new constraint */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newConstraint}
            onChange={(e) => setNewConstraint(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addConstraint()}
            placeholder="Add a constraint..."
            className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg
              text-white placeholder-slate-500 text-sm
              focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={addConstraint}
            disabled={!newConstraint.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium
              hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>

        {/* Suggestions */}
        <div className="mt-4 flex flex-wrap gap-2">
          {CONSTRAINT_SUGGESTIONS.filter(
            (s) => !activationBrief.known_constraints?.includes(s)
          ).slice(0, 4).map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => {
                updateBrief({
                  known_constraints: [...(activationBrief.known_constraints || []), suggestion],
                });
              }}
              className="px-2 py-1 text-xs text-slate-400 border border-slate-700 rounded-lg
                hover:border-slate-600 hover:text-slate-300"
            >
              + {suggestion}
            </button>
          ))}
        </div>
      </div>

      {/* Flight Dates */}
      <div className="bg-slate-900 rounded-xl p-6 border border-slate-800">
        <h3 className="text-white font-medium mb-4">Flight Dates</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Start Date</label>
            <input
              type="date"
              value={activationBrief.flight_start || ''}
              onChange={(e) => updateBrief({ flight_start: e.target.value })}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg
                text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">End Date</label>
            <input
              type="date"
              value={activationBrief.flight_end || ''}
              onChange={(e) => updateBrief({ flight_end: e.target.value })}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg
                text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Add Secondary Audience Modal */}
      <PromptModal
        isOpen={isAddAudienceOpen}
        onClose={() => setIsAddAudienceOpen(false)}
        onSubmit={addSecondaryAudience}
        title="Add Secondary Audience"
        message="Enter the name or description of the secondary audience segment."
        placeholder="e.g., Budget-conscious millennials"
        submitLabel="Add Audience"
      />
    </div>
  );
}

// ============================================================================
// CONFIDENCE METER
// ============================================================================

function ConfidenceMeter({ completion, confidence }: { completion: number; confidence: number }) {
  const getConfidenceColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getConfidenceLabel = (score: number): ConfidenceLevel => {
    if (score >= 80) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  };

  return (
    <div className="bg-slate-900 rounded-xl p-6 border border-slate-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-medium">Brief Confidence</h3>
        <span className={`
          px-3 py-1 rounded-full text-xs font-medium
          ${getConfidenceLabel(confidence) === 'high' ? 'bg-green-600/20 text-green-400' : ''}
          ${getConfidenceLabel(confidence) === 'medium' ? 'bg-yellow-600/20 text-yellow-400' : ''}
          ${getConfidenceLabel(confidence) === 'low' ? 'bg-red-600/20 text-red-400' : ''}
        `}>
          {getConfidenceLabel(confidence).toUpperCase()}
        </span>
      </div>

      <div className="space-y-4">
        {/* Completion bar */}
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-slate-400">Completion</span>
            <span className="text-white font-medium">{completion}%</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getConfidenceColor(completion)}`}
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>

        {/* Confidence bar */}
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-slate-400">AI Confidence</span>
            <span className="text-white font-medium">{confidence}%</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getConfidenceColor(confidence)}`}
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>
      </div>

      {confidence < 50 && (
        <div className="mt-4 p-3 bg-red-600/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400 text-sm flex items-center gap-2">
            <WarningIcon />
            Brief needs more detail. AI flags vague inputs.
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// BRIEF FIELD COMPONENT
// ============================================================================

function BriefField({
  label,
  value,
  onChange,
  required,
  multiline,
  placeholder,
  warning,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  multiline?: boolean;
  placeholder?: string;
  warning?: string;
}) {
  return (
    <div className="bg-slate-900 rounded-xl p-6 border border-slate-800">
      <div className="flex items-center justify-between mb-3">
        <label className="text-white font-medium flex items-center gap-2">
          {label}
          {required && <span className="text-red-400 text-sm">*</span>}
        </label>
        {value && (
          <span className="text-green-400">
            <CheckIcon />
          </span>
        )}
      </div>

      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg
            text-white placeholder-slate-500 text-sm resize-none
            focus:outline-none focus:border-blue-500"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg
            text-white placeholder-slate-500 text-sm
            focus:outline-none focus:border-blue-500"
        />
      )}

      {warning && (
        <div className="mt-2 p-2 bg-amber-600/10 border border-amber-500/30 rounded-lg">
          <p className="text-amber-400 text-xs flex items-center gap-2">
            <WarningIcon />
            {warning}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getFieldWarning(key: string, value: string): string | undefined {
  if (!value) return undefined;

  if (key === 'objective' && /awareness|engagement/i.test(value) && !/\d/.test(value)) {
    return '"Awareness" without a KPI is vague. Add a measurable target.';
  }

  if (key === 'single_minded_proposition' && value.length < 20) {
    return 'SMP seems brief. Consider adding more specificity.';
  }

  return undefined;
}

// ============================================================================
// ICONS
// ============================================================================

function CheckIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}
