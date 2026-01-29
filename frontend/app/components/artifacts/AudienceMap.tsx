'use client';

import { useState } from 'react';
import { usePlanningStore } from '../../stores/planningStore';
import { useUIStore } from '../../stores/uiStore';
import { useToast, ConfirmModal, PromptModal, Button, IconButton } from '../ui';
import type { AudienceCard } from '../../types/planning';

// ============================================================================
// ARTIFACT 2: AUDIENCE & SIGNAL MAP
// ============================================================================

export function AudienceMapArtifact() {
  const { audienceMap, addAudience, updateAudience, removeAudience } = usePlanningStore();
  const { roleLens, selectedAudienceIds, selectAudience, clearAudienceSelection } = useUIStore();
  const toast = useToast();
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; audienceId: string | null }>({
    isOpen: false,
    audienceId: null,
  });

  const handleAddAudience = (audience: AudienceCard) => {
    addAudience(audience);
    setIsAddingNew(false);
    toast.success('Audience added', `"${audience.segment_name}" added to audience map`);
  };

  const handleDeleteAudience = (id: string) => {
    removeAudience(id);
    setDeleteConfirm({ isOpen: false, audienceId: null });
    toast.info('Audience removed');
  };

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="bg-slate-900 rounded-xl p-6 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-medium">Audience Overview</h3>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">
              {audienceMap.audiences.length} audience{audienceMap.audiences.length !== 1 ? 's' : ''} defined
            </span>
            {audienceMap.total_reach_estimate && (
              <span className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded-lg text-sm">
                Est. reach: {audienceMap.total_reach_estimate}
              </span>
            )}
          </div>
        </div>

        {/* Role-specific guidance */}
        {roleLens === 'creative' && (
          <div className="p-3 bg-purple-600/10 border border-purple-500/30 rounded-lg">
            <p className="text-purple-400 text-sm">
              <strong>Creative Focus:</strong> Pay attention to key insights, current vs desired perception, 
              and how audiences differ for message variation planning.
            </p>
          </div>
        )}
        {roleLens === 'media' && (
          <div className="p-3 bg-green-600/10 border border-green-500/30 rounded-lg">
            <p className="text-green-400 text-sm">
              <strong>Media Focus:</strong> Review behavioral signals, contextual triggers, and platform 
              affinities for targeting strategy.
            </p>
          </div>
        )}
        {roleLens === 'production' && (
          <div className="p-3 bg-orange-600/10 border border-orange-500/30 rounded-lg">
            <p className="text-orange-400 text-sm">
              <strong>Production Focus:</strong> Number of distinct audiences determines variant volume. 
              Consider shared messaging opportunities.
            </p>
          </div>
        )}

        {/* Overlap warnings */}
        {audienceMap.overlap_warnings.length > 0 && (
          <div className="mt-4 p-3 bg-amber-600/10 border border-amber-500/30 rounded-lg">
            <p className="text-amber-400 text-sm font-medium mb-2">Overlap Warnings:</p>
            <ul className="list-disc list-inside text-amber-400 text-sm space-y-1">
              {audienceMap.overlap_warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Audience Cards */}
      <div className="grid gap-4">
        {audienceMap.audiences.map((audience) => (
          <AudienceCardComponent
            key={audience.id}
            audience={audience}
            isSelected={selectedAudienceIds.includes(audience.id)}
            onSelect={() => selectAudience(audience.id)}
            onUpdate={(updates) => updateAudience(audience.id, updates)}
            onRemove={() => removeAudience(audience.id)}
            roleLens={roleLens}
          />
        ))}
      </div>

      {/* Add New Audience */}
      {isAddingNew ? (
        <NewAudienceForm
          onSave={handleAddAudience}
          onCancel={() => setIsAddingNew(false)}
        />
      ) : (
        <button
          onClick={() => setIsAddingNew(true)}
          className="w-full py-4 border-2 border-dashed border-slate-700 rounded-xl
            text-slate-400 hover:text-white hover:border-slate-600 transition-colors
            flex items-center justify-center gap-2"
        >
          <PlusIcon />
          Add Audience Segment
        </button>
      )}
    </div>
  );
}

// ============================================================================
// AUDIENCE CARD COMPONENT
// ============================================================================

function AudienceCardComponent({
  audience,
  isSelected,
  onSelect,
  onUpdate,
  onRemove,
  roleLens,
}: {
  audience: AudienceCard;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<AudienceCard>) => void;
  onRemove: () => void;
  roleLens: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const priorityColors = {
    tier1: 'bg-red-600/20 text-red-400 border-red-500/30',
    tier2: 'bg-yellow-600/20 text-yellow-400 border-yellow-500/30',
    tier3: 'bg-slate-600/20 text-slate-400 border-slate-500/30',
  };

  return (
    <div
      className={`
        bg-slate-900 rounded-xl border transition-all duration-200
        ${isSelected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-800'}
      `}
    >
      {/* Card Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className={`
              w-5 h-5 rounded border-2 flex items-center justify-center
              ${isSelected
                ? 'bg-blue-600 border-blue-600'
                : 'border-slate-600 hover:border-slate-500'
              }
            `}
          >
            {isSelected && <CheckIcon className="w-3 h-3 text-white" />}
          </button>

          <div>
            <div className="flex items-center gap-3">
              <h4 className="text-white font-medium">{audience.segment_name}</h4>
              <span className={`px-2 py-0.5 text-xs rounded-full border ${priorityColors[audience.priority_level]}`}>
                {audience.priority_level.replace('tier', 'Tier ')}
              </span>
            </div>
            <p className="text-slate-400 text-sm mt-0.5">
              {audience.segment_id} • {audience.segment_size}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(!isEditing);
            }}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
          >
            <EditIcon />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg"
          >
            <TrashIcon />
          </button>
          <ChevronIcon className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-slate-800 pt-4 space-y-4">
          {/* Who They Are */}
          <Section 
            title="Who They Are" 
            value={audience.description}
            emphasized={roleLens === 'creative'}
            onEdit={isEditing ? (v) => onUpdate({ description: v }) : undefined}
          />

          {/* Why They Matter */}
          <div className={`grid grid-cols-2 gap-4 ${roleLens === 'creative' ? 'ring-2 ring-purple-500/30 rounded-lg p-2 -m-2' : ''}`}>
            <Section
              title="Key Insight"
              value={audience.key_insight}
              emphasized={roleLens === 'creative'}
              onEdit={isEditing ? (v) => onUpdate({ key_insight: v }) : undefined}
            />
            <Section
              title="Current Perception"
              value={audience.current_perception}
              onEdit={isEditing ? (v) => onUpdate({ current_perception: v }) : undefined}
            />
          </div>

          <Section
            title="Desired Perception"
            value={audience.desired_perception}
            emphasized={roleLens === 'creative'}
            onEdit={isEditing ? (v) => onUpdate({ desired_perception: v }) : undefined}
          />

          {/* Signals for Media */}
          <div className={`space-y-3 ${roleLens === 'media' ? 'ring-2 ring-green-500/30 rounded-lg p-3 -m-1' : ''}`}>
            <h5 className="text-slate-400 text-sm font-medium flex items-center gap-2">
              Signals for Media Targeting
              {roleLens === 'media' && (
                <span className="text-xs text-green-400 bg-green-600/20 px-2 py-0.5 rounded">Focus</span>
              )}
            </h5>
            
            <TagList
              title="Behavioral Signals"
              tags={audience.behavioral_signals}
              color="blue"
              onAdd={isEditing ? (tag) => onUpdate({ 
                behavioral_signals: [...audience.behavioral_signals, tag] 
              }) : undefined}
              onRemove={isEditing ? (i) => {
                const updated = [...audience.behavioral_signals];
                updated.splice(i, 1);
                onUpdate({ behavioral_signals: updated });
              } : undefined}
            />

            <TagList
              title="Contextual Triggers"
              tags={audience.contextual_triggers}
              color="purple"
              onAdd={isEditing ? (tag) => onUpdate({ 
                contextual_triggers: [...audience.contextual_triggers, tag] 
              }) : undefined}
              onRemove={isEditing ? (i) => {
                const updated = [...audience.contextual_triggers];
                updated.splice(i, 1);
                onUpdate({ contextual_triggers: updated });
              } : undefined}
            />

            <TagList
              title="Platform Affinities"
              tags={audience.platform_affinities}
              color="green"
              onAdd={isEditing ? (tag) => onUpdate({ 
                platform_affinities: [...audience.platform_affinities, tag] 
              }) : undefined}
              onRemove={isEditing ? (i) => {
                const updated = [...audience.platform_affinities];
                updated.splice(i, 1);
                onUpdate({ platform_affinities: updated });
              } : undefined}
            />
          </div>

          {/* Notes */}
          {(audience.notes || isEditing) && (
            <Section
              title="Notes"
              value={audience.notes || ''}
              onEdit={isEditing ? (v) => onUpdate({ notes: v }) : undefined}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// NEW AUDIENCE FORM
// ============================================================================

function NewAudienceForm({
  onSave,
  onCancel,
}: {
  onSave: (audience: AudienceCard) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Partial<AudienceCard>>({
    id: `aud-${Date.now()}`,
    segment_name: '',
    segment_id: '',
    segment_source: '',
    segment_size: '',
    priority_level: 'tier2',
    description: '',
    key_insight: '',
    current_perception: '',
    desired_perception: '',
    differentiators: [],
    behavioral_signals: [],
    contextual_triggers: [],
    platform_affinities: [],
  });

  const handleSave = () => {
    if (!form.segment_name?.trim()) {
      // Focus the segment name input
      return;
    }
    onSave(form as AudienceCard);
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-blue-500 p-6 space-y-4">
      <h3 className="text-white font-medium">New Audience Segment</h3>

      <div className="grid grid-cols-2 gap-4">
        <input
          placeholder="Segment Name *"
          value={form.segment_name}
          onChange={(e) => setForm({ ...form, segment_name: e.target.value })}
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
        />
        <input
          placeholder="Segment ID"
          value={form.segment_id}
          onChange={(e) => setForm({ ...form, segment_id: e.target.value })}
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
        />
        <input
          placeholder="Segment Source"
          value={form.segment_source}
          onChange={(e) => setForm({ ...form, segment_source: e.target.value })}
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
        />
        <input
          placeholder="Size (e.g., 50k)"
          value={form.segment_size}
          onChange={(e) => setForm({ ...form, segment_size: e.target.value })}
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
        />
      </div>

      <select
        value={form.priority_level}
        onChange={(e) => setForm({ ...form, priority_level: e.target.value as any })}
        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
      >
        <option value="tier1">Tier 1 (Bespoke)</option>
        <option value="tier2">Tier 2</option>
        <option value="tier3">Tier 3</option>
      </select>

      <textarea
        placeholder="Description - Who are they?"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        rows={2}
        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
      />

      <textarea
        placeholder="Key Insight - What do we know about them?"
        value={form.key_insight}
        onChange={(e) => setForm({ ...form, key_insight: e.target.value })}
        rows={2}
        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
      />

      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-slate-400 hover:text-white"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
        >
          Add Audience
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function Section({
  title,
  value,
  emphasized,
  onEdit,
}: {
  title: string;
  value: string;
  emphasized?: boolean;
  onEdit?: (value: string) => void;
}) {
  return (
    <div className={emphasized ? 'bg-purple-600/5 p-3 rounded-lg -m-1' : ''}>
      <h5 className="text-slate-400 text-sm mb-1">{title}</h5>
      {onEdit ? (
        <textarea
          value={value}
          onChange={(e) => onEdit(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
        />
      ) : (
        <p className="text-white text-sm">{value || '-'}</p>
      )}
    </div>
  );
}

function TagList({
  title,
  tags,
  color,
  onAdd,
  onRemove,
}: {
  title: string;
  tags: string[];
  color: 'blue' | 'purple' | 'green';
  onAdd?: (tag: string) => void;
  onRemove?: (index: number) => void;
}) {
  const colorClasses = {
    blue: 'bg-blue-600/20 text-blue-400',
    purple: 'bg-purple-600/20 text-purple-400',
    green: 'bg-green-600/20 text-green-400',
  };

  return (
    <div>
      <p className="text-slate-500 text-xs mb-1">{title}</p>
      <div className="flex flex-wrap gap-1">
        {tags.map((tag, i) => (
          <span
            key={i}
            className={`px-2 py-0.5 rounded text-xs ${colorClasses[color]} flex items-center gap-1`}
          >
            {tag}
            {onRemove && (
              <button onClick={() => onRemove(i)} className="hover:text-white">×</button>
            )}
          </span>
        ))}
        {onAdd && (
          <button
            onClick={() => {
              // In a full implementation, this would open a modal
              // For now, using a simple approach that works without blocking
              const tag = window.prompt(`Add ${title.toLowerCase()}:`);
              if (tag) onAdd(tag);
            }}
            className="px-2 py-0.5 rounded text-xs border border-dashed border-slate-600 text-slate-500 hover:text-slate-300"
            aria-label={`Add ${title.toLowerCase()}`}
          >
            +
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// ICONS
// ============================================================================

function PlusIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function CheckIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
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

function ChevronIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`w-5 h-5 text-slate-400 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}
