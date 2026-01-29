'use client';

import { useState, useMemo } from 'react';
import { usePlanningStore } from '../../stores/planningStore';
import { useUIStore } from '../../stores/uiStore';
import { useToast, Button, ConfirmModal } from '../ui';
import type { MatrixCell, MatrixWarning } from '../../types/planning';

// ============================================================================
// ARTIFACT 3: CONTENT SCOPE MATRIX (Heart of ModCon)
// ============================================================================
// This is the contract between teams. It defines:
// - Audience × Funnel Stage × Message Theme × Format × Placement × Variants
// ============================================================================

const FUNNEL_STAGES = ['awareness', 'consideration', 'conversion', 'retention'] as const;

const FORMAT_OPTIONS = [
  'Static Image',
  'Vertical Video (9:16)',
  'Horizontal Video (16:9)',
  'Square Video (1:1)',
  'Carousel',
  'Stories',
  'HTML5 Banner',
  'Audio',
];

const PLACEMENT_OPTIONS = [
  'Meta Feed',
  'Meta Stories',
  'Meta Reels',
  'Instagram Feed',
  'Instagram Stories',
  'TikTok For You',
  'YouTube In-Stream',
  'YouTube Shorts',
  'LinkedIn Feed',
  'Display 300x250',
  'Display 728x90',
  'Display 160x600',
  'Connected TV',
  'Audio Streaming',
];

export function ContentScopeMatrixArtifact() {
  const { 
    contentMatrix, 
    audienceMap, 
    addMatrixCell, 
    updateMatrixCell, 
    removeMatrixCell,
    updateVariantCount,
    recalculateMatrixMetrics,
    productionPlan,
    recalculateProductionImpact,
  } = usePlanningStore();
  const { roleLens } = useUIStore();
  const toast = useToast();
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [isAddingCell, setIsAddingCell] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; cellId: string | null }>({
    isOpen: false,
    cellId: null,
  });

  // Recalculate metrics when cells change
  const handleCellChange = () => {
    recalculateMatrixMetrics();
    recalculateProductionImpact();
  };

  // Group cells by audience for the grid view
  const cellsByAudience = useMemo(() => {
    const groups: Record<string, MatrixCell[]> = {};
    contentMatrix.cells.forEach((cell) => {
      if (!groups[cell.audience_id]) {
        groups[cell.audience_id] = [];
      }
      groups[cell.audience_id].push(cell);
    });
    return groups;
  }, [contentMatrix.cells]);

  return (
    <div className="space-y-6">
      {/* Matrix Summary */}
      <MatrixSummary 
        matrix={contentMatrix} 
        productionPlan={productionPlan}
        roleLens={roleLens} 
      />

      {/* Warnings */}
      {contentMatrix.warnings.length > 0 && (
        <WarningsPanel warnings={contentMatrix.warnings} />
      )}

      {/* View Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 p-1 bg-slate-800 rounded-lg">
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${
              viewMode === 'table'
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Table View
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${
              viewMode === 'grid'
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Grid View
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              // Auto-suggest matrix rows based on audiences
              if (audienceMap.audiences.length === 0) {
                toast.warning('No audiences defined', 'Add audiences first to auto-generate matrix rows');
                return;
              }
              audienceMap.audiences.forEach((aud) => {
                FUNNEL_STAGES.forEach((stage) => {
                  const cell: MatrixCell = {
                    id: `cell-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    audience_id: aud.id,
                    funnel_stage: stage,
                    message_theme: '',
                    format: 'Static Image',
                    placement: 'Meta Feed',
                    planned_variants: 1,
                    production_units: 1,
                    status: 'planned',
                  };
                  addMatrixCell(cell);
                });
              });
              handleCellChange();
            }}
            className="px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300"
          >
            Auto-suggest from Audiences
          </button>
          <button
            onClick={() => setIsAddingCell(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + Add Cell
          </button>
        </div>
      </div>

      {/* Matrix Content */}
      {viewMode === 'table' ? (
        <MatrixTable
          cells={contentMatrix.cells}
          audiences={audienceMap.audiences}
          onUpdateCell={(id, updates) => {
            updateMatrixCell(id, updates);
            handleCellChange();
          }}
          onRemoveCell={(id) => {
            removeMatrixCell(id);
            handleCellChange();
          }}
          onUpdateVariants={(id, count) => {
            updateVariantCount(id, count);
            handleCellChange();
          }}
          roleLens={roleLens}
        />
      ) : (
        <MatrixGrid
          cellsByAudience={cellsByAudience}
          audiences={audienceMap.audiences}
          onUpdateCell={(id, updates) => {
            updateMatrixCell(id, updates);
            handleCellChange();
          }}
          roleLens={roleLens}
        />
      )}

      {/* Add Cell Modal */}
      {isAddingCell && (
        <AddCellModal
          audiences={audienceMap.audiences}
          onSave={(cell) => {
            addMatrixCell(cell);
            handleCellChange();
            setIsAddingCell(false);
          }}
          onCancel={() => setIsAddingCell(false)}
        />
      )}

      {/* Role-specific guidance */}
      <RoleGuidance roleLens={roleLens} matrix={contentMatrix} />
    </div>
  );
}

// ============================================================================
// MATRIX SUMMARY
// ============================================================================

function MatrixSummary({ 
  matrix, 
  productionPlan,
  roleLens 
}: { 
  matrix: any; 
  productionPlan: any;
  roleLens: string;
}) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
      <h3 className="text-white font-medium mb-4">Content Scope Summary</h3>
      
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          label="Content Cells"
          value={matrix.cells.length}
          emphasized={false}
        />
        <MetricCard
          label="Total Variants"
          value={matrix.total_variants}
          emphasized={roleLens === 'production'}
          warning={matrix.total_variants > 48}
          warningText="High volume"
        />
        <MetricCard
          label="Unique Modules"
          value={matrix.total_unique_modules}
          emphasized={roleLens === 'production'}
        />
        <MetricCard
          label="Reuse Opportunities"
          value={matrix.reuse_opportunities}
          emphasized={roleLens === 'production'}
          positive={matrix.reuse_opportunities > 0}
        />
      </div>

      {/* Production Impact (live update) */}
      <div className={`
        mt-4 p-4 rounded-lg border
        ${roleLens === 'production' 
          ? 'bg-orange-600/10 border-orange-500/30' 
          : 'bg-slate-800 border-slate-700'
        }
      `}>
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-sm">Production Impact</span>
          <span className={`
            px-2 py-1 rounded text-xs font-medium
            ${productionPlan.complexity_score === 'simple' ? 'bg-green-600/20 text-green-400' : ''}
            ${productionPlan.complexity_score === 'moderate' ? 'bg-yellow-600/20 text-yellow-400' : ''}
            ${productionPlan.complexity_score === 'heavy' ? 'bg-red-600/20 text-red-400' : ''}
          `}>
            {productionPlan.complexity_score?.toUpperCase() || 'TBD'}
          </span>
        </div>
        <p className="text-white text-lg font-semibold mt-1">
          {productionPlan.total_assets} estimated assets
        </p>
        {productionPlan.capacity_warnings.length > 0 && (
          <p className="text-amber-400 text-sm mt-2">
            ⚠️ {productionPlan.capacity_warnings[0]}
          </p>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  emphasized,
  warning,
  warningText,
  positive,
}: {
  label: string;
  value: number;
  emphasized?: boolean;
  warning?: boolean;
  warningText?: string;
  positive?: boolean;
}) {
  return (
    <div className={`
      p-4 rounded-lg border
      ${emphasized ? 'bg-orange-600/10 border-orange-500/30' : 'bg-slate-800 border-slate-700'}
    `}>
      <p className="text-slate-400 text-sm">{label}</p>
      <p className={`
        text-2xl font-bold mt-1
        ${warning ? 'text-amber-400' : positive ? 'text-green-400' : 'text-white'}
      `}>
        {value}
      </p>
      {warning && warningText && (
        <p className="text-amber-400 text-xs mt-1">⚠️ {warningText}</p>
      )}
    </div>
  );
}

// ============================================================================
// WARNINGS PANEL
// ============================================================================

function WarningsPanel({ warnings }: { warnings: MatrixWarning[] }) {
  return (
    <div className="space-y-2">
      {warnings.map((warning, i) => (
        <div
          key={i}
          className={`
            p-4 rounded-lg border flex items-start gap-3
            ${warning.severity === 'error' ? 'bg-red-600/10 border-red-500/30' : ''}
            ${warning.severity === 'warning' ? 'bg-amber-600/10 border-amber-500/30' : ''}
            ${warning.severity === 'info' ? 'bg-blue-600/10 border-blue-500/30' : ''}
          `}
        >
          <span className={`
            ${warning.severity === 'error' ? 'text-red-400' : ''}
            ${warning.severity === 'warning' ? 'text-amber-400' : ''}
            ${warning.severity === 'info' ? 'text-blue-400' : ''}
          `}>
            {warning.severity === 'info' ? '💡' : '⚠️'}
          </span>
          <p className={`
            text-sm
            ${warning.severity === 'error' ? 'text-red-400' : ''}
            ${warning.severity === 'warning' ? 'text-amber-400' : ''}
            ${warning.severity === 'info' ? 'text-blue-400' : ''}
          `}>
            {warning.message}
          </p>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// MATRIX TABLE
// ============================================================================

function MatrixTable({
  cells,
  audiences,
  onUpdateCell,
  onRemoveCell,
  onUpdateVariants,
  roleLens,
}: {
  cells: MatrixCell[];
  audiences: any[];
  onUpdateCell: (id: string, updates: Partial<MatrixCell>) => void;
  onRemoveCell: (id: string) => void;
  onUpdateVariants: (id: string, count: number) => void;
  roleLens: string;
}) {
  const getAudienceName = (id: string) => {
    const aud = audiences.find((a) => a.id === id);
    return aud?.segment_name || id;
  };

  if (cells.length === 0) {
    return (
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-12 text-center">
        <p className="text-slate-400 mb-2">No content cells defined yet</p>
        <p className="text-slate-500 text-sm">
          Add cells manually or auto-suggest from your audience map
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Audience
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Funnel Stage
              </th>
              <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                roleLens === 'creative' ? 'text-purple-400' : 'text-slate-400'
              }`}>
                Message Theme
              </th>
              <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                roleLens === 'media' ? 'text-green-400' : 'text-slate-400'
              }`}>
                Format
              </th>
              <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                roleLens === 'media' ? 'text-green-400' : 'text-slate-400'
              }`}>
                Placement
              </th>
              <th className={`px-4 py-3 text-center text-xs font-medium uppercase tracking-wider ${
                roleLens === 'production' ? 'text-orange-400' : 'text-slate-400'
              }`}>
                Variants
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {cells.map((cell) => (
              <tr key={cell.id} className="hover:bg-slate-800/50">
                <td className="px-4 py-3 text-sm text-white">
                  {getAudienceName(cell.audience_id)}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={cell.funnel_stage}
                    onChange={(e) => onUpdateCell(cell.id, { funnel_stage: e.target.value as any })}
                    className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                  >
                    {FUNNEL_STAGES.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage.charAt(0).toUpperCase() + stage.slice(1)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={`px-4 py-3 ${roleLens === 'creative' ? 'bg-purple-600/5' : ''}`}>
                  <input
                    type="text"
                    value={cell.message_theme}
                    onChange={(e) => onUpdateCell(cell.id, { message_theme: e.target.value })}
                    placeholder="Enter theme..."
                    className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white w-full"
                  />
                </td>
                <td className={`px-4 py-3 ${roleLens === 'media' ? 'bg-green-600/5' : ''}`}>
                  <select
                    value={cell.format}
                    onChange={(e) => onUpdateCell(cell.id, { format: e.target.value })}
                    className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                  >
                    {FORMAT_OPTIONS.map((format) => (
                      <option key={format} value={format}>{format}</option>
                    ))}
                  </select>
                </td>
                <td className={`px-4 py-3 ${roleLens === 'media' ? 'bg-green-600/5' : ''}`}>
                  <select
                    value={cell.placement}
                    onChange={(e) => onUpdateCell(cell.id, { placement: e.target.value })}
                    className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                  >
                    {PLACEMENT_OPTIONS.map((placement) => (
                      <option key={placement} value={placement}>{placement}</option>
                    ))}
                  </select>
                </td>
                <td className={`px-4 py-3 text-center ${roleLens === 'production' ? 'bg-orange-600/5' : ''}`}>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={cell.planned_variants}
                    onChange={(e) => onUpdateVariants(cell.id, parseInt(e.target.value) || 1)}
                    className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white text-center"
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => onRemoveCell(cell.id)}
                    className="text-slate-400 hover:text-red-400 p-1"
                    aria-label="Remove cell"
                    title="Remove cell"
                  >
                    <TrashIcon />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// MATRIX GRID VIEW
// ============================================================================

function MatrixGrid({
  cellsByAudience,
  audiences,
  onUpdateCell,
  roleLens,
}: {
  cellsByAudience: Record<string, MatrixCell[]>;
  audiences: any[];
  onUpdateCell: (id: string, updates: Partial<MatrixCell>) => void;
  roleLens: string;
}) {
  const getAudienceName = (id: string) => {
    const aud = audiences.find((a) => a.id === id);
    return aud?.segment_name || id;
  };

  if (Object.keys(cellsByAudience).length === 0) {
    return (
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-12 text-center">
        <p className="text-slate-400">No content cells to display</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(cellsByAudience).map(([audienceId, cells]) => (
        <div key={audienceId} className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <h4 className="text-white font-medium mb-4">{getAudienceName(audienceId)}</h4>
          <div className="grid grid-cols-4 gap-3">
            {FUNNEL_STAGES.map((stage) => {
              const stageCells = cells.filter((c) => c.funnel_stage === stage);
              return (
                <div key={stage} className="bg-slate-800 rounded-lg p-3">
                  <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">
                    {stage}
                  </p>
                  <div className="space-y-2">
                    {stageCells.length > 0 ? (
                      stageCells.map((cell) => (
                        <div
                          key={cell.id}
                          className="bg-slate-700 rounded p-2 text-xs"
                        >
                          <p className="text-white font-medium truncate">
                            {cell.format}
                          </p>
                          <p className="text-slate-400 truncate">
                            {cell.placement}
                          </p>
                          <p className="text-blue-400 mt-1">
                            {cell.planned_variants} variant{cell.planned_variants !== 1 ? 's' : ''}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-600 text-xs">No cells</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// ADD CELL MODAL
// ============================================================================

function AddCellModal({
  audiences,
  onSave,
  onCancel,
}: {
  audiences: any[];
  onSave: (cell: MatrixCell) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Partial<MatrixCell>>({
    audience_id: audiences[0]?.id || '',
    funnel_stage: 'awareness',
    message_theme: '',
    format: 'Static Image',
    placement: 'Meta Feed',
    planned_variants: 1,
  });

  const handleSave = () => {
    if (!form.audience_id) {
      // This shouldn't happen if form is properly initialized
      return;
    }
    const cell: MatrixCell = {
      id: `cell-${Date.now()}`,
      audience_id: form.audience_id!,
      funnel_stage: form.funnel_stage as any,
      message_theme: form.message_theme || '',
      format: form.format || 'Static Image',
      placement: form.placement || 'Meta Feed',
      planned_variants: form.planned_variants || 1,
      production_units: form.planned_variants || 1,
      status: 'planned',
    };
    onSave(cell);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 w-full max-w-md">
        <h3 className="text-white font-medium mb-4">Add Content Cell</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Audience</label>
            <select
              value={form.audience_id}
              onChange={(e) => setForm({ ...form, audience_id: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
            >
              {audiences.map((aud) => (
                <option key={aud.id} value={aud.id}>{aud.segment_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Funnel Stage</label>
            <select
              value={form.funnel_stage}
              onChange={(e) => setForm({ ...form, funnel_stage: e.target.value as any })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
            >
              {FUNNEL_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage.charAt(0).toUpperCase() + stage.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Message Theme</label>
            <input
              type="text"
              value={form.message_theme}
              onChange={(e) => setForm({ ...form, message_theme: e.target.value })}
              placeholder="e.g., Speed & Performance"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Format</label>
              <select
                value={form.format}
                onChange={(e) => setForm({ ...form, format: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
              >
                {FORMAT_OPTIONS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Variants</label>
              <input
                type="number"
                min="1"
                max="20"
                value={form.planned_variants}
                onChange={(e) => setForm({ ...form, planned_variants: parseInt(e.target.value) || 1 })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Placement</label>
            <select
              value={form.placement}
              onChange={(e) => setForm({ ...form, placement: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
            >
              {PLACEMENT_OPTIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
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
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Add Cell
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ROLE GUIDANCE
// ============================================================================

function RoleGuidance({ roleLens, matrix }: { roleLens: string; matrix: any }) {
  if (roleLens === 'all') return null;

  const guidance = {
    creative: {
      title: 'Creative Team Focus',
      items: [
        'Message themes should align with the single-minded proposition',
        'Consider how variants will differ (copy, visual, tone)',
        'Identify which cells can share creative concepts',
      ],
    },
    production: {
      title: 'Production Team Focus',
      items: [
        `${matrix.total_variants} variants require production capacity`,
        'Look for reuse opportunities to reduce workload',
        'Formats affect production complexity and timeline',
      ],
    },
    media: {
      title: 'Media Team Focus',
      items: [
        'Validate placement availability for flight dates',
        'Confirm format compatibility with platforms',
        'Consider rotation strategy for multi-variant cells',
      ],
    },
  };

  const current = guidance[roleLens as keyof typeof guidance];
  if (!current) return null;

  const colors = {
    creative: 'border-purple-500/30 bg-purple-600/5',
    production: 'border-orange-500/30 bg-orange-600/5',
    media: 'border-green-500/30 bg-green-600/5',
  };

  const textColors = {
    creative: 'text-purple-400',
    production: 'text-orange-400',
    media: 'text-green-400',
  };

  return (
    <div className={`p-4 rounded-xl border ${colors[roleLens as keyof typeof colors]}`}>
      <h4 className={`font-medium mb-2 ${textColors[roleLens as keyof typeof textColors]}`}>
        {current.title}
      </h4>
      <ul className="space-y-1">
        {current.items.map((item, i) => (
          <li key={i} className="text-slate-400 text-sm flex items-start gap-2">
            <span className={textColors[roleLens as keyof typeof textColors]}>•</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================================
// ICONS
// ============================================================================

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}
