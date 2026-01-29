'use client';

import { useState, useMemo } from 'react';
import { useToast, Button, Modal, Select } from '../ui';
import {
  PLATFORM_LIBRARY,
  type FeedStructure,
  type FeedColumn,
  type PlatformId,
  type Module,
  type DecisioningLogic,
} from '../../types/modules';

// ============================================================================
// FEED PREVIEW - Preview DCO feed structure before handoff
// ============================================================================

interface FeedPreviewProps {
  feedStructure: FeedStructure | null;
  modules: Module[];
  audiences: { id: string; name: string }[];
  placements: { id: string; name: string; platform: string }[];
  decisioning: DecisioningLogic;
  onCreateFeed: (structure: FeedStructure) => void;
  onUpdateFeed: (id: string, updates: Partial<FeedStructure>) => void;
  onExportFeed: (format: 'csv' | 'json') => void;
}

const STANDARD_COLUMNS: FeedColumn[] = [
  { id: 'row_id', name: 'row_id', display_name: 'Row ID', type: 'text', is_required: true, is_dynamic: false, source: 'static' },
  { id: 'audience_id', name: 'audience_id', display_name: 'Audience ID', type: 'text', is_required: true, is_dynamic: true, source: 'audience' },
  { id: 'audience_name', name: 'audience_name', display_name: 'Audience Name', type: 'text', is_required: false, is_dynamic: true, source: 'audience' },
  { id: 'placement_id', name: 'placement_id', display_name: 'Placement ID', type: 'text', is_required: true, is_dynamic: true, source: 'placement' },
  { id: 'platform', name: 'platform', display_name: 'Platform', type: 'text', is_required: true, is_dynamic: true, source: 'placement' },
];

export function FeedPreview({
  feedStructure,
  modules,
  audiences,
  placements,
  decisioning,
  onCreateFeed,
  onUpdateFeed,
  onExportFeed,
}: FeedPreviewProps) {
  const toast = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformId>('flashtalking');

  // Generate preview rows
  const previewRows = useMemo(() => {
    if (!feedStructure) return [];

    const rows: Record<string, string>[] = [];
    let rowIndex = 1;

    // Generate rows based on structure
    if (feedStructure.row_per === 'audience_x_placement') {
      audiences.forEach((aud) => {
        placements.forEach((placement) => {
          rows.push(generateRow(rowIndex++, aud, placement, modules, decisioning, feedStructure));
        });
      });
    } else if (feedStructure.row_per === 'audience') {
      audiences.forEach((aud) => {
        rows.push(generateRow(rowIndex++, aud, null, modules, decisioning, feedStructure));
      });
    } else if (feedStructure.row_per === 'placement') {
      placements.forEach((placement) => {
        rows.push(generateRow(rowIndex++, null, placement, modules, decisioning, feedStructure));
      });
    }

    return rows.slice(0, 10); // Limit preview to 10 rows
  }, [feedStructure, audiences, placements, modules, decisioning]);

  const platformConfig = PLATFORM_LIBRARY.find((p) => p.id === selectedPlatform);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-white font-semibold text-lg">Feed Preview</h3>
            <p className="text-slate-400 text-sm mt-1">
              Preview the DCO feed structure for handoff to automation platforms
            </p>
          </div>
          <div className="flex items-center gap-3">
            {feedStructure && (
              <>
                <Button variant="secondary" onClick={() => onExportFeed('csv')}>
                  Export CSV
                </Button>
                <Button variant="secondary" onClick={() => onExportFeed('json')}>
                  Export JSON
                </Button>
              </>
            )}
            {!feedStructure && (
              <Button onClick={() => setIsCreating(true)}>
                Configure Feed
              </Button>
            )}
          </div>
        </div>

        {/* Platform Selector */}
        <div className="flex items-center gap-4 mb-4">
          <span className="text-slate-400 text-sm">Target Platform:</span>
          <div className="flex gap-2">
            {PLATFORM_LIBRARY.slice(0, 5).map((platform) => (
              <button
                key={platform.id}
                onClick={() => setSelectedPlatform(platform.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedPlatform === platform.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {platform.name}
              </button>
            ))}
          </div>
        </div>

        {/* Platform Capabilities */}
        {platformConfig && (
          <div className="grid grid-cols-6 gap-2">
            <CapabilityBadge label="Display" enabled={platformConfig.supports_display} />
            <CapabilityBadge label="Video" enabled={platformConfig.supports_video} />
            <CapabilityBadge label="Interactive" enabled={platformConfig.supports_interactive} />
            <CapabilityBadge label="CTV" enabled={platformConfig.supports_ctv} />
            <CapabilityBadge label="Real-time" enabled={platformConfig.real_time_decisioning} />
            <CapabilityBadge label="Feed Format" value={platformConfig.feed_format.toUpperCase()} />
          </div>
        )}
      </div>

      {/* Feed Structure Info */}
      {feedStructure ? (
        <>
          {/* Structure Summary */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-white font-medium">Feed Structure</h4>
              <span className="px-3 py-1 bg-green-600/20 text-green-400 rounded-lg text-sm">
                {feedStructure.estimated_row_count} estimated rows
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="p-3 bg-slate-800 rounded-lg">
                <p className="text-slate-400 text-xs">Row Generation</p>
                <p className="text-white font-medium capitalize">
                  {feedStructure.row_per.replace(/_/g, ' × ')}
                </p>
              </div>
              <div className="p-3 bg-slate-800 rounded-lg">
                <p className="text-slate-400 text-xs">Columns</p>
                <p className="text-white font-medium">{feedStructure.columns.length}</p>
              </div>
              <div className="p-3 bg-slate-800 rounded-lg">
                <p className="text-slate-400 text-xs">Dynamic Fields</p>
                <p className="text-white font-medium">
                  {feedStructure.columns.filter((c) => c.is_dynamic).length}
                </p>
              </div>
            </div>

            {/* Validation Errors */}
            {feedStructure.validation_errors.length > 0 && (
              <div className="p-3 bg-red-600/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm font-medium mb-2">Validation Issues</p>
                <ul className="text-red-400 text-sm space-y-1">
                  {feedStructure.validation_errors.map((error, i) => (
                    <li key={i}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Column Definitions */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
            <h4 className="text-white font-medium mb-4">Column Definitions</h4>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 px-3 text-xs text-slate-400 uppercase">Column Name</th>
                    <th className="text-left py-2 px-3 text-xs text-slate-400 uppercase">Display Name</th>
                    <th className="text-left py-2 px-3 text-xs text-slate-400 uppercase">Type</th>
                    <th className="text-left py-2 px-3 text-xs text-slate-400 uppercase">Source</th>
                    <th className="text-center py-2 px-3 text-xs text-slate-400 uppercase">Required</th>
                    <th className="text-center py-2 px-3 text-xs text-slate-400 uppercase">Dynamic</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {feedStructure.columns.map((column) => (
                    <tr key={column.id} className="hover:bg-slate-800/50">
                      <td className="py-2 px-3 text-white text-sm font-mono">{column.name}</td>
                      <td className="py-2 px-3 text-slate-300 text-sm">{column.display_name}</td>
                      <td className="py-2 px-3 text-slate-400 text-sm">{column.type}</td>
                      <td className="py-2 px-3 text-slate-400 text-sm capitalize">{column.source}</td>
                      <td className="py-2 px-3 text-center">
                        {column.is_required ? (
                          <span className="text-green-400">✓</span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {column.is_dynamic ? (
                          <span className="text-blue-400">✓</span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Preview Table */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-white font-medium">Preview (First 10 Rows)</h4>
              <span className="text-slate-400 text-sm">
                Showing {previewRows.length} of {feedStructure.estimated_row_count} rows
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    {feedStructure.columns.slice(0, 8).map((col) => (
                      <th key={col.id} className="text-left py-2 px-3 text-xs text-slate-400 uppercase whitespace-nowrap">
                        {col.display_name}
                      </th>
                    ))}
                    {feedStructure.columns.length > 8 && (
                      <th className="text-left py-2 px-3 text-xs text-slate-400">
                        +{feedStructure.columns.length - 8} more
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {previewRows.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-800/50">
                      {feedStructure.columns.slice(0, 8).map((col) => (
                        <td key={col.id} className="py-2 px-3 text-slate-300 whitespace-nowrap truncate max-w-[200px]">
                          {row[col.name] || '-'}
                        </td>
                      ))}
                      {feedStructure.columns.length > 8 && (
                        <td className="py-2 px-3 text-slate-500">...</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <EmptyFeedState onConfigure={() => setIsCreating(true)} />
      )}

      {/* Platform Guidance */}
      <div className="bg-blue-600/10 border border-blue-500/30 rounded-xl p-4">
        <h4 className="text-blue-400 font-medium mb-2">Platform Handoff Notes</h4>
        <ul className="text-slate-300 text-sm space-y-1">
          <li>• Export format: {platformConfig?.feed_format.toUpperCase() || 'CSV'}</li>
          <li>• Column naming follows {platformConfig?.name || 'standard'} conventions</li>
          <li>• Dynamic fields will be populated at ad-serve time</li>
          <li>• Review decisioning rules before trafficking</li>
        </ul>
      </div>

      {/* Create Feed Modal */}
      {isCreating && (
        <CreateFeedModal
          modules={modules}
          audiences={audiences}
          placements={placements}
          selectedPlatform={selectedPlatform}
          onSave={(structure) => {
            onCreateFeed(structure);
            setIsCreating(false);
            toast.success('Feed configured', 'Ready for preview and export');
          }}
          onCancel={() => setIsCreating(false)}
        />
      )}
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function CapabilityBadge({ 
  label, 
  enabled, 
  value 
}: { 
  label: string; 
  enabled?: boolean; 
  value?: string;
}) {
  if (value) {
    return (
      <div className="px-3 py-1.5 bg-slate-800 rounded-lg text-center">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm text-white font-medium">{value}</p>
      </div>
    );
  }
  
  return (
    <div className={`px-3 py-1.5 rounded-lg text-center ${
      enabled ? 'bg-green-600/20' : 'bg-slate-800'
    }`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-sm font-medium ${enabled ? 'text-green-400' : 'text-slate-500'}`}>
        {enabled ? '✓' : '—'}
      </p>
    </div>
  );
}

function EmptyFeedState({ onConfigure }: { onConfigure: () => void }) {
  return (
    <div className="bg-slate-900 rounded-xl border-2 border-dashed border-slate-700 p-12 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center text-2xl">
        📊
      </div>
      <h3 className="text-white font-medium mb-2">No feed structure configured</h3>
      <p className="text-slate-400 text-sm mb-4 max-w-md mx-auto">
        Configure your DCO feed structure to preview how data will be organized 
        for handoff to Flashtalking, Innovid, Clinch, or other automation platforms.
      </p>
      <Button onClick={onConfigure}>Configure Feed Structure</Button>
    </div>
  );
}

function generateRow(
  index: number,
  audience: { id: string; name: string } | null,
  placement: { id: string; name: string; platform: string } | null,
  modules: Module[],
  decisioning: DecisioningLogic,
  structure: FeedStructure
): Record<string, string> {
  const row: Record<string, string> = {};
  
  structure.columns.forEach((col) => {
    switch (col.source) {
      case 'static':
        if (col.name === 'row_id') {
          row[col.name] = `row_${index.toString().padStart(4, '0')}`;
        } else {
          row[col.name] = col.default_value || '';
        }
        break;
      case 'audience':
        if (audience) {
          if (col.name.includes('id')) row[col.name] = audience.id;
          else if (col.name.includes('name')) row[col.name] = audience.name;
          else row[col.name] = audience.name;
        }
        break;
      case 'placement':
        if (placement) {
          if (col.name.includes('id')) row[col.name] = placement.id;
          else if (col.name === 'platform') row[col.name] = placement.platform;
          else row[col.name] = placement.name;
        }
        break;
      case 'module':
        // Find the module and get the appropriate variation
        const modRef = col.source_reference;
        if (modRef) {
          const mod = modules.find((m) => m.id === modRef);
          if (mod && mod.variations.length > 0) {
            row[col.name] = mod.variations[0].name;
          }
        }
        break;
      case 'rule':
        row[col.name] = '[DYNAMIC]';
        break;
      default:
        row[col.name] = col.default_value || '';
    }
  });
  
  return row;
}

// ============================================================================
// CREATE FEED MODAL
// ============================================================================

function CreateFeedModal({
  modules,
  audiences,
  placements,
  selectedPlatform,
  onSave,
  onCancel,
}: {
  modules: Module[];
  audiences: { id: string; name: string }[];
  placements: { id: string; name: string; platform: string }[];
  selectedPlatform: PlatformId;
  onSave: (structure: FeedStructure) => void;
  onCancel: () => void;
}) {
  const [rowPer, setRowPer] = useState<'audience' | 'placement' | 'audience_x_placement'>('audience_x_placement');
  const [includeDefaults, setIncludeDefaults] = useState(true);

  const handleSave = () => {
    // Build columns based on modules
    const moduleColumns: FeedColumn[] = modules.flatMap((mod) => {
      const baseCol: FeedColumn = {
        id: `${mod.type}_asset`,
        name: `${mod.type}_asset`,
        display_name: `${mod.type.charAt(0).toUpperCase() + mod.type.slice(1)} Asset`,
        type: 'url',
        is_required: false,
        is_dynamic: true,
        source: 'module',
        source_reference: mod.id,
      };
      
      // Add text column for text modules
      if (mod.format === 'text' || mod.type === 'cta' || mod.type === 'hook') {
        return [
          baseCol,
          {
            ...baseCol,
            id: `${mod.type}_text`,
            name: `${mod.type}_text`,
            display_name: `${mod.type.charAt(0).toUpperCase() + mod.type.slice(1)} Text`,
            type: 'text' as const,
          },
        ];
      }
      
      return [baseCol];
    });

    const estimatedRows = 
      rowPer === 'audience_x_placement' 
        ? audiences.length * placements.length
        : rowPer === 'audience'
          ? audiences.length
          : placements.length;

    const structure: FeedStructure = {
      id: `feed-${Date.now()}`,
      name: `${selectedPlatform} Feed`,
      target_platform: selectedPlatform,
      columns: [...STANDARD_COLUMNS, ...moduleColumns],
      row_per: rowPer,
      include_defaults: includeDefaults,
      estimated_row_count: estimatedRows,
      validation_errors: [],
    };

    onSave(structure);
  };

  return (
    <Modal
      isOpen={true}
      onClose={onCancel}
      title="Configure Feed Structure"
      size="lg"
    >
      <div className="space-y-6">
        {/* Row Generation */}
        <div>
          <label className="block text-sm text-slate-400 mb-2">Generate Row Per</label>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setRowPer('audience')}
              className={`p-4 rounded-lg border text-left transition-all ${
                rowPer === 'audience'
                  ? 'border-blue-500 bg-blue-600/10'
                  : 'border-slate-700 hover:border-slate-600'
              }`}
            >
              <p className="text-white font-medium">Audience</p>
              <p className="text-slate-400 text-sm">{audiences.length} rows</p>
            </button>
            <button
              onClick={() => setRowPer('placement')}
              className={`p-4 rounded-lg border text-left transition-all ${
                rowPer === 'placement'
                  ? 'border-blue-500 bg-blue-600/10'
                  : 'border-slate-700 hover:border-slate-600'
              }`}
            >
              <p className="text-white font-medium">Placement</p>
              <p className="text-slate-400 text-sm">{placements.length} rows</p>
            </button>
            <button
              onClick={() => setRowPer('audience_x_placement')}
              className={`p-4 rounded-lg border text-left transition-all ${
                rowPer === 'audience_x_placement'
                  ? 'border-blue-500 bg-blue-600/10'
                  : 'border-slate-700 hover:border-slate-600'
              }`}
            >
              <p className="text-white font-medium">Audience × Placement</p>
              <p className="text-slate-400 text-sm">{audiences.length * placements.length} rows</p>
            </button>
          </div>
        </div>

        {/* Options */}
        <div className="flex items-center gap-3 p-4 bg-slate-800 rounded-lg">
          <input
            type="checkbox"
            id="includeDefaults"
            checked={includeDefaults}
            onChange={(e) => setIncludeDefaults(e.target.checked)}
            className="w-4 h-4 rounded bg-slate-700 border-slate-600"
          />
          <label htmlFor="includeDefaults" className="text-white text-sm">
            Include default row for each audience (fallback creative)
          </label>
        </div>

        {/* Summary */}
        <div className="p-4 bg-slate-800/50 rounded-lg">
          <p className="text-slate-400 text-sm">
            This will create a feed with <strong className="text-white">{STANDARD_COLUMNS.length + modules.length * 2}</strong> columns 
            and approximately <strong className="text-white">
              {rowPer === 'audience_x_placement' 
                ? audiences.length * placements.length
                : rowPer === 'audience'
                  ? audiences.length
                  : placements.length}
            </strong> rows.
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave}>
          Create Feed Structure
        </Button>
      </div>
    </Modal>
  );
}
