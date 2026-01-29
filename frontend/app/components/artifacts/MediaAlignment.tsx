'use client';

import { useState } from 'react';
import { usePlanningStore } from '../../stores/planningStore';
import { useUIStore } from '../../stores/uiStore';
import { useToast, Button, Input, Select } from '../ui';
import type { PlacementSpec, MediaAlignmentPlan } from '../../types/planning';

// ============================================================================
// ARTIFACT 5: MEDIA ALIGNMENT PLAN (Intent, not buying)
// ============================================================================

const PLATFORM_OPTIONS = [
  'Meta',
  'Instagram',
  'TikTok',
  'YouTube',
  'LinkedIn',
  'DV360',
  'Connected TV',
  'Audio Streaming',
  'Programmatic Display',
];

const ROTATION_STRATEGIES = [
  { value: 'static', label: 'Static', description: 'Single creative per placement' },
  { value: 'modular', label: 'Modular', description: 'Dynamic creative assembly' },
  { value: 'sequential', label: 'Sequential', description: 'Ordered creative rotation' },
  { value: 'dynamic', label: 'Dynamic', description: 'AI-optimized rotation' },
];

export function MediaAlignmentArtifact() {
  const { mediaAlignmentPlan, updateMediaPlan, addPlacement, removePlacement, contentMatrix } = usePlanningStore();
  const { roleLens } = useUIStore();
  const [isAddingPlacement, setIsAddingPlacement] = useState(false);

  // Calculate format requirements from content matrix
  const formatRequirements = contentMatrix.cells.reduce((acc, cell) => {
    const existing = acc.find((f) => f.format === cell.format);
    if (existing) {
      existing.count++;
      if (!existing.platforms.includes(cell.placement.split(' ')[0])) {
        existing.platforms.push(cell.placement.split(' ')[0]);
      }
    } else {
      acc.push({
        format: cell.format,
        count: 1,
        platforms: [cell.placement.split(' ')[0]],
      });
    }
    return acc;
  }, [] as { format: string; count: number; platforms: string[] }[]);

  return (
    <div className="space-y-6">
      {/* Media Plan Overview */}
      <div className={`
        bg-slate-900 rounded-xl border p-6
        ${roleLens === 'media' ? 'border-green-500/50' : 'border-slate-800'}
      `}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-white font-medium">Media Alignment Overview</h3>
          {roleLens === 'media' && (
            <span className="px-3 py-1 bg-green-600/20 text-green-400 rounded-lg text-sm">
              Media Focus Active
            </span>
          )}
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            label="Placements"
            value={mediaAlignmentPlan.placements.length}
          />
          <StatCard
            label="Platforms"
            value={mediaAlignmentPlan.platform_breakdown.length || new Set(mediaAlignmentPlan.placements.map(p => p.platform)).size}
          />
          <StatCard
            label="Format Types"
            value={formatRequirements.length}
          />
          <StatCard
            label="Rotation"
            value={mediaAlignmentPlan.rotation_strategy}
            capitalize
          />
        </div>
      </div>

      {/* Rotation Strategy */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <h3 className="text-white font-medium mb-4">Rotation Strategy</h3>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          {ROTATION_STRATEGIES.map((strategy) => (
            <button
              key={strategy.value}
              onClick={() => updateMediaPlan({ 
                rotation_strategy: strategy.value as any,
                rotation_rationale: '',
              })}
              className={`
                p-4 rounded-lg border text-left transition-all
                ${mediaAlignmentPlan.rotation_strategy === strategy.value
                  ? 'border-green-500 bg-green-600/10'
                  : 'border-slate-700 hover:border-slate-600'
                }
              `}
            >
              <p className={`font-medium ${
                mediaAlignmentPlan.rotation_strategy === strategy.value
                  ? 'text-green-400'
                  : 'text-white'
              }`}>
                {strategy.label}
              </p>
              <p className="text-slate-400 text-sm mt-1">{strategy.description}</p>
            </button>
          ))}
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-2">Rotation Rationale</label>
          <textarea
            value={mediaAlignmentPlan.rotation_rationale}
            onChange={(e) => updateMediaPlan({ rotation_rationale: e.target.value })}
            placeholder="Explain why this rotation strategy was chosen..."
            rows={2}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg
              text-white placeholder-slate-500 text-sm
              focus:outline-none focus:border-green-500"
          />
        </div>
      </div>

      {/* Format Requirements */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <h3 className="text-white font-medium mb-4">Format Requirements</h3>
        
        {formatRequirements.length > 0 ? (
          <div className="space-y-3">
            {formatRequirements.map((req, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 bg-slate-800 rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <FormatIcon format={req.format} />
                  <div>
                    <p className="text-white font-medium">{req.format}</p>
                    <p className="text-slate-400 text-sm">
                      {req.platforms.join(', ')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-medium">{req.count}</p>
                  <p className="text-slate-400 text-xs">cells</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-slate-500 text-sm">
              Format requirements will populate from Content Matrix
            </p>
          </div>
        )}
      </div>

      {/* Flighting Summary */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <h3 className="text-white font-medium mb-4">Flighting Assumptions</h3>
        
        <textarea
          value={mediaAlignmentPlan.flighting_summary}
          onChange={(e) => updateMediaPlan({ flighting_summary: e.target.value })}
          placeholder="Describe the flighting approach: continuous, pulsing, seasonal windows, etc."
          rows={3}
          className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg
            text-white placeholder-slate-500 text-sm
            focus:outline-none focus:border-green-500"
        />

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Flight Start</label>
            <input
              type="date"
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg
                text-white text-sm focus:outline-none focus:border-green-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">Flight End</label>
            <input
              type="date"
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg
                text-white text-sm focus:outline-none focus:border-green-500"
            />
          </div>
        </div>
      </div>

      {/* Planned Placements */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-medium">Planned Placements</h3>
          <button
            onClick={() => setIsAddingPlacement(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
          >
            + Add Placement
          </button>
        </div>

        {mediaAlignmentPlan.placements.length > 0 ? (
          <div className="space-y-3">
            {mediaAlignmentPlan.placements.map((placement) => (
              <PlacementCard
                key={placement.id}
                placement={placement}
                onRemove={() => removePlacement(placement.id)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 border-2 border-dashed border-slate-700 rounded-lg">
            <p className="text-slate-500 text-sm mb-2">No placements defined yet</p>
            <button
              onClick={() => setIsAddingPlacement(true)}
              className="text-green-400 text-sm hover:text-green-300"
            >
              Add your first placement
            </button>
          </div>
        )}
      </div>

      {/* Platform Breakdown */}
      {mediaAlignmentPlan.placements.length > 0 && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
          <h3 className="text-white font-medium mb-4">Platform Breakdown</h3>
          
          <div className="grid grid-cols-3 gap-4">
            {getPlatformBreakdown(mediaAlignmentPlan.placements).map((platform) => (
              <div
                key={platform.name}
                className="p-4 bg-slate-800 rounded-lg"
              >
                <div className="flex items-center gap-2 mb-2">
                  <PlatformIcon platform={platform.name} />
                  <span className="text-white font-medium">{platform.name}</span>
                </div>
                <p className="text-slate-400 text-sm">
                  {platform.placements} placement{platform.placements !== 1 ? 's' : ''}
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {platform.formats.map((format, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-xs"
                    >
                      {format}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* What This Is / What This Is Not */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-green-600/10 border border-green-500/30 rounded-xl p-4">
          <h4 className="text-green-400 font-medium mb-2">What This Plan Is</h4>
          <ul className="text-slate-300 text-sm space-y-1">
            <li>• Activation intent for creative teams</li>
            <li>• Format requirements per platform</li>
            <li>• Flighting and rotation assumptions</li>
            <li>• Scope alignment for production</li>
          </ul>
        </div>
        <div className="bg-red-600/10 border border-red-500/30 rounded-xl p-4">
          <h4 className="text-red-400 font-medium mb-2">What This Plan Is Not</h4>
          <ul className="text-slate-300 text-sm space-y-1">
            <li>• Not a media buy or budget allocation</li>
            <li>• Not trafficking instructions</li>
            <li>• Not an ad server configuration</li>
            <li>• Not audience targeting specs</li>
          </ul>
        </div>
      </div>

      {/* Add Placement Modal */}
      {isAddingPlacement && (
        <AddPlacementModal
          onSave={(placement) => {
            addPlacement(placement);
            setIsAddingPlacement(false);
          }}
          onCancel={() => setIsAddingPlacement(false)}
        />
      )}
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function StatCard({ 
  label, 
  value, 
  capitalize 
}: { 
  label: string; 
  value: string | number;
  capitalize?: boolean;
}) {
  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <p className="text-slate-400 text-sm">{label}</p>
      <p className={`text-2xl font-bold text-white mt-1 ${capitalize ? 'capitalize' : ''}`}>
        {value}
      </p>
    </div>
  );
}

function PlacementCard({ 
  placement, 
  onRemove 
}: { 
  placement: PlacementSpec; 
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
      <div className="flex items-center gap-4">
        <PlatformIcon platform={placement.platform} />
        <div>
          <p className="text-white font-medium">{placement.placement}</p>
          <p className="text-slate-400 text-sm">
            {placement.platform} • {placement.format} • {placement.dimensions}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className={`
          px-2 py-1 rounded text-xs font-medium capitalize
          ${placement.rotation_strategy === 'static' ? 'bg-slate-600 text-slate-300' : ''}
          ${placement.rotation_strategy === 'modular' ? 'bg-blue-600/20 text-blue-400' : ''}
          ${placement.rotation_strategy === 'sequential' ? 'bg-purple-600/20 text-purple-400' : ''}
          ${placement.rotation_strategy === 'dynamic' ? 'bg-green-600/20 text-green-400' : ''}
        `}>
          {placement.rotation_strategy}
        </span>
        <button
          onClick={onRemove}
          className="text-slate-400 hover:text-red-400"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

function AddPlacementModal({
  onSave,
  onCancel,
}: {
  onSave: (placement: PlacementSpec) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Partial<PlacementSpec>>({
    platform: 'Meta',
    placement: '',
    format: '',
    dimensions: '',
    rotation_strategy: 'static',
  });

  const handleSave = () => {
    if (!form.placement?.trim()) {
      // Focus the placement input
      return;
    }
    onSave({
      id: `placement-${Date.now()}`,
      platform: form.platform || 'Meta',
      placement: form.placement,
      format: form.format || '',
      dimensions: form.dimensions || '',
      rotation_strategy: form.rotation_strategy || 'static',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 w-full max-w-md">
        <h3 className="text-white font-medium mb-4">Add Placement</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Platform</label>
            <select
              value={form.platform}
              onChange={(e) => setForm({ ...form, platform: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
            >
              {PLATFORM_OPTIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Placement Name</label>
            <input
              type="text"
              value={form.placement}
              onChange={(e) => setForm({ ...form, placement: e.target.value })}
              placeholder="e.g., Feed, Stories, In-Stream"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Format</label>
              <input
                type="text"
                value={form.format}
                onChange={(e) => setForm({ ...form, format: e.target.value })}
                placeholder="e.g., Video, Image"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Dimensions</label>
              <input
                type="text"
                value={form.dimensions}
                onChange={(e) => setForm({ ...form, dimensions: e.target.value })}
                placeholder="e.g., 1080x1920"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Rotation Strategy</label>
            <select
              value={form.rotation_strategy}
              onChange={(e) => setForm({ ...form, rotation_strategy: e.target.value as any })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
            >
              {ROTATION_STRATEGIES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
          >
            Add Placement
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getPlatformBreakdown(placements: PlacementSpec[]) {
  const breakdown: Record<string, { name: string; placements: number; formats: string[] }> = {};
  
  placements.forEach((p) => {
    if (!breakdown[p.platform]) {
      breakdown[p.platform] = { name: p.platform, placements: 0, formats: [] };
    }
    breakdown[p.platform].placements++;
    if (p.format && !breakdown[p.platform].formats.includes(p.format)) {
      breakdown[p.platform].formats.push(p.format);
    }
  });
  
  return Object.values(breakdown);
}

// ============================================================================
// ICONS
// ============================================================================

function FormatIcon({ format }: { format: string }) {
  if (format.toLowerCase().includes('video')) {
    return (
      <div className="w-10 h-10 rounded-lg bg-purple-600/20 flex items-center justify-center">
        <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    );
  }
  if (format.toLowerCase().includes('audio')) {
    return (
      <div className="w-10 h-10 rounded-lg bg-pink-600/20 flex items-center justify-center">
        <svg className="w-5 h-5 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        </svg>
      </div>
    );
  }
  return (
    <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
      <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    </div>
  );
}

function PlatformIcon({ platform }: { platform: string }) {
  return (
    <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-white text-xs font-bold">
      {platform.slice(0, 2).toUpperCase()}
    </div>
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
