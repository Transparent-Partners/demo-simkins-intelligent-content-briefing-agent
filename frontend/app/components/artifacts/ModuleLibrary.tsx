'use client';

import { useState, useMemo } from 'react';
import { useToast, Button, Modal, Input, Select } from '../ui';
import { 
  MODULE_TYPE_CONFIG, 
  PLATFORM_LIBRARY,
  type Module, 
  type ModuleType, 
  type ModuleVariation,
  type PlatformId,
} from '../../types/modules';

// ============================================================================
// MODULE LIBRARY - Production-ready module definitions for DCO platforms
// ============================================================================

interface ModuleLibraryProps {
  modules: Module[];
  onAddModule: (module: Module) => void;
  onUpdateModule: (id: string, updates: Partial<Module>) => void;
  onRemoveModule: (id: string) => void;
  targetPlatforms: PlatformId[];
}

export function ModuleLibrary({
  modules,
  onAddModule,
  onUpdateModule,
  onRemoveModule,
  targetPlatforms,
}: ModuleLibraryProps) {
  const toast = useToast();
  const [isAddingModule, setIsAddingModule] = useState(false);
  const [selectedType, setSelectedType] = useState<ModuleType | 'all'>('all');
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);

  // Group modules by type
  const modulesByType = useMemo(() => {
    const groups: Partial<Record<ModuleType, Module[]>> = {};
    modules.forEach((mod) => {
      if (!groups[mod.type]) groups[mod.type] = [];
      groups[mod.type]!.push(mod);
    });
    return groups;
  }, [modules]);

  // Calculate reuse metrics
  const reuseMetrics = useMemo(() => {
    const totalModules = modules.length;
    const totalVariations = modules.reduce((sum, m) => sum + m.variations.length, 0);
    const reusedModules = modules.filter((m) => m.reuse_count > 1).length;
    const reusePercentage = totalModules > 0 
      ? Math.round((reusedModules / totalModules) * 100) 
      : 0;
    return { totalModules, totalVariations, reusedModules, reusePercentage };
  }, [modules]);

  const filteredModules = selectedType === 'all' 
    ? modules 
    : modules.filter((m) => m.type === selectedType);

  return (
    <div className="space-y-6">
      {/* Header & Metrics */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-white font-semibold text-lg">Module Library</h3>
            <p className="text-slate-400 text-sm mt-1">
              Reusable content modules for DCO and automation platforms
            </p>
          </div>
          <Button onClick={() => setIsAddingModule(true)}>
            + Add Module
          </Button>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-4 gap-4">
          <MetricCard
            label="Total Modules"
            value={reuseMetrics.totalModules}
            icon="📦"
          />
          <MetricCard
            label="Total Variations"
            value={reuseMetrics.totalVariations}
            icon="🔀"
          />
          <MetricCard
            label="Reused Modules"
            value={reuseMetrics.reusedModules}
            icon="♻️"
            positive
          />
          <MetricCard
            label="Reuse Rate"
            value={`${reuseMetrics.reusePercentage}%`}
            icon="📈"
            positive={reuseMetrics.reusePercentage > 30}
          />
        </div>

        {/* Target Platforms */}
        {targetPlatforms.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-800">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Target Platforms
            </p>
            <div className="flex flex-wrap gap-2">
              {targetPlatforms.map((platformId) => {
                const platform = PLATFORM_LIBRARY.find((p) => p.id === platformId);
                return (
                  <span
                    key={platformId}
                    className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded-lg text-sm"
                  >
                    {platform?.name || platformId}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Type Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedType('all')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
            selectedType === 'all'
              ? 'bg-slate-700 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          All ({modules.length})
        </button>
        {(Object.keys(MODULE_TYPE_CONFIG) as ModuleType[]).map((type) => {
          const config = MODULE_TYPE_CONFIG[type];
          const count = modulesByType[type]?.length || 0;
          if (count === 0 && selectedType !== type) return null;
          
          return (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                selectedType === type
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span>{config.icon}</span>
              {config.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Module Cards */}
      <div className="space-y-4">
        {filteredModules.length > 0 ? (
          filteredModules.map((module) => (
            <ModuleCard
              key={module.id}
              module={module}
              isExpanded={expandedModuleId === module.id}
              onToggle={() => setExpandedModuleId(
                expandedModuleId === module.id ? null : module.id
              )}
              onUpdate={(updates) => onUpdateModule(module.id, updates)}
              onRemove={() => {
                onRemoveModule(module.id);
                toast.info('Module removed');
              }}
              onAddVariation={(variation) => {
                onUpdateModule(module.id, {
                  variations: [...module.variations, variation],
                });
                toast.success('Variation added');
              }}
            />
          ))
        ) : (
          <EmptyState onAdd={() => setIsAddingModule(true)} />
        )}
      </div>

      {/* Add Module Modal */}
      {isAddingModule && (
        <AddModuleModal
          onSave={(module) => {
            onAddModule(module);
            setIsAddingModule(false);
            toast.success('Module created', `"${module.name}" added to library`);
          }}
          onCancel={() => setIsAddingModule(false)}
        />
      )}
    </div>
  );
}

// ============================================================================
// MODULE CARD
// ============================================================================

function ModuleCard({
  module,
  isExpanded,
  onToggle,
  onUpdate,
  onRemove,
  onAddVariation,
}: {
  module: Module;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (updates: Partial<Module>) => void;
  onRemove: () => void;
  onAddVariation: (variation: ModuleVariation) => void;
}) {
  const config = MODULE_TYPE_CONFIG[module.type];
  const [isAddingVariation, setIsAddingVariation] = useState(false);

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-800/50"
        onClick={onToggle}
      >
        <div className="flex items-center gap-4">
          <div className={`
            w-10 h-10 rounded-lg flex items-center justify-center text-lg
            bg-${config.color}-600/20
          `}>
            {config.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-white font-medium">{module.name}</h4>
              <span className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-xs">
                {config.label}
              </span>
              {module.reuse_count > 1 && (
                <span className="px-2 py-0.5 bg-green-600/20 text-green-400 rounded text-xs">
                  ♻️ Reused {module.reuse_count}x
                </span>
              )}
            </div>
            <p className="text-slate-400 text-sm mt-0.5">
              {module.variations.length} variation{module.variations.length !== 1 ? 's' : ''} • 
              {module.format} • {module.source_type.replace('_', ' ')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-500">
            {isExpanded ? '▼' : '▶'}
          </span>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-slate-800 p-4 space-y-4">
          {/* Description */}
          <div>
            <p className="text-sm text-slate-400">{module.description}</p>
          </div>

          {/* Specs */}
          <div className="grid grid-cols-4 gap-4">
            <SpecItem label="Format" value={module.format} />
            {module.specs.dimensions && (
              <SpecItem label="Dimensions" value={module.specs.dimensions} />
            )}
            {module.specs.duration && (
              <SpecItem label="Duration" value={module.specs.duration} />
            )}
            {module.specs.character_limit && (
              <SpecItem label="Max Characters" value={`${module.specs.character_limit}`} />
            )}
          </div>

          {/* Variations */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h5 className="text-white font-medium text-sm">Variations</h5>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAddingVariation(true);
                }}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                + Add Variation
              </button>
            </div>

            <div className="space-y-2">
              {module.variations.map((variation) => (
                <VariationRow key={variation.id} variation={variation} />
              ))}
              {module.variations.length === 0 && (
                <p className="text-slate-500 text-sm">No variations defined</p>
              )}
            </div>
          </div>

          {/* Used In */}
          {module.used_in_cells.length > 0 && (
            <div>
              <h5 className="text-white font-medium text-sm mb-2">Used in Content Matrix</h5>
              <div className="flex flex-wrap gap-1">
                {module.used_in_cells.map((cellId) => (
                  <span
                    key={cellId}
                    className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded text-xs"
                  >
                    {cellId}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
            <button
              onClick={onRemove}
              className="text-sm text-red-400 hover:text-red-300"
            >
              Delete Module
            </button>
          </div>

          {/* Add Variation Modal */}
          {isAddingVariation && (
            <AddVariationModal
              moduleType={module.type}
              onSave={(variation) => {
                onAddVariation(variation);
                setIsAddingVariation(false);
              }}
              onCancel={() => setIsAddingVariation(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function MetricCard({
  label,
  value,
  icon,
  positive,
}: {
  label: string;
  value: string | number;
  icon: string;
  positive?: boolean;
}) {
  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-1">
        <span>{icon}</span>
        <span className="text-slate-400 text-sm">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${positive ? 'text-green-400' : 'text-white'}`}>
        {value}
      </p>
    </div>
  );
}

function SpecItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800 rounded-lg p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-white text-sm font-medium">{value}</p>
    </div>
  );
}

function VariationRow({ variation }: { variation: ModuleVariation }) {
  const statusColors = {
    planned: 'bg-slate-600 text-slate-300',
    in_production: 'bg-blue-600/20 text-blue-400',
    in_review: 'bg-amber-600/20 text-amber-400',
    approved: 'bg-green-600/20 text-green-400',
    live: 'bg-purple-600/20 text-purple-400',
  };

  return (
    <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-slate-700 rounded flex items-center justify-center text-xs text-slate-400">
          {variation.name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <p className="text-white text-sm font-medium">{variation.name}</p>
          {variation.audience_id && (
            <p className="text-slate-400 text-xs">Audience: {variation.audience_id}</p>
          )}
        </div>
      </div>
      <span className={`px-2 py-0.5 rounded text-xs ${statusColors[variation.status]}`}>
        {variation.status.replace('_', ' ')}
      </span>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="bg-slate-900 rounded-xl border-2 border-dashed border-slate-700 p-12 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center text-2xl">
        📦
      </div>
      <h3 className="text-white font-medium mb-2">No modules defined</h3>
      <p className="text-slate-400 text-sm mb-4">
        Modules are reusable content components (hooks, CTAs, proof points) that can be assembled for DCO platforms.
      </p>
      <Button onClick={onAdd}>Create Your First Module</Button>
    </div>
  );
}

// ============================================================================
// ADD MODULE MODAL
// ============================================================================

function AddModuleModal({
  onSave,
  onCancel,
}: {
  onSave: (module: Module) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    type: 'hook' as ModuleType,
    name: '',
    description: '',
    format: 'image' as 'text' | 'image' | 'video' | 'audio' | 'html5' | 'lottie',
    source_type: 'new_shoot' as Module['source_type'],
    dimensions: '',
    duration: '',
    character_limit: '',
  });

  const config = MODULE_TYPE_CONFIG[form.type];

  const handleSave = () => {
    if (!form.name.trim()) return;

    const newModule: Module = {
      id: `mod-${Date.now()}`,
      type: form.type,
      name: form.name,
      description: form.description || config.description,
      format: form.format,
      source_type: form.source_type,
      specs: {
        dimensions: form.dimensions || undefined,
        duration: form.duration || config.typical_duration,
        character_limit: form.character_limit ? parseInt(form.character_limit) : undefined,
      },
      variations: [],
      reuse_count: 0,
      used_in_cells: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    onSave(newModule);
  };

  return (
    <Modal
      isOpen={true}
      onClose={onCancel}
      title="Add Module"
      description="Define a reusable content module for your campaign"
      size="lg"
    >
      <div className="space-y-4">
        {/* Module Type Grid */}
        <div>
          <label className="block text-sm text-slate-400 mb-2">Module Type</label>
          <div className="grid grid-cols-4 gap-2">
            {(Object.keys(MODULE_TYPE_CONFIG) as ModuleType[]).slice(0, 8).map((type) => {
              const typeConfig = MODULE_TYPE_CONFIG[type];
              return (
                <button
                  key={type}
                  onClick={() => setForm({ ...form, type })}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    form.type === type
                      ? 'border-blue-500 bg-blue-600/10'
                      : 'border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <span className="text-xl">{typeConfig.icon}</span>
                  <p className="text-xs text-white mt-1">{typeConfig.label}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Name & Description */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Module Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={`e.g., ${config.common_variations[0]} ${config.label}`}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Format</label>
            <select
              value={form.format}
              onChange={(e) => setForm({ ...form, format: e.target.value as any })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
            >
              <option value="image">Image</option>
              <option value="video">Video</option>
              <option value="text">Text Only</option>
              <option value="audio">Audio</option>
              <option value="html5">HTML5</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder={config.description}
            rows={2}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
          />
        </div>

        {/* Specs */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Source</label>
            <select
              value={form.source_type}
              onChange={(e) => setForm({ ...form, source_type: e.target.value as any })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
            >
              <option value="new_shoot">New Shoot</option>
              <option value="existing_asset">Existing Asset</option>
              <option value="ugc">UGC</option>
              <option value="stock">Stock</option>
              <option value="ai_generated">AI Generated</option>
            </select>
          </div>
          {form.format !== 'text' && form.format !== 'audio' && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">Dimensions</label>
              <input
                type="text"
                value={form.dimensions}
                onChange={(e) => setForm({ ...form, dimensions: e.target.value })}
                placeholder="e.g., 1080x1920"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
              />
            </div>
          )}
          {(form.format === 'video' || form.format === 'audio') && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">Duration</label>
              <input
                type="text"
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: e.target.value })}
                placeholder={config.typical_duration || 'e.g., 15s'}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
              />
            </div>
          )}
          {form.format === 'text' && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">Max Characters</label>
              <input
                type="number"
                value={form.character_limit}
                onChange={(e) => setForm({ ...form, character_limit: e.target.value })}
                placeholder="e.g., 125"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
              />
            </div>
          )}
        </div>

        {/* Common Variations Hint */}
        <div className="p-3 bg-slate-800/50 rounded-lg">
          <p className="text-xs text-slate-500 mb-1">Common {config.label} variations:</p>
          <div className="flex flex-wrap gap-1">
            {config.common_variations.map((v) => (
              <span key={v} className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-xs">
                {v}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!form.name.trim()}>
          Create Module
        </Button>
      </div>
    </Modal>
  );
}

// ============================================================================
// ADD VARIATION MODAL
// ============================================================================

function AddVariationModal({
  moduleType,
  onSave,
  onCancel,
}: {
  moduleType: ModuleType;
  onSave: (variation: ModuleVariation) => void;
  onCancel: () => void;
}) {
  const config = MODULE_TYPE_CONFIG[moduleType];
  const [form, setForm] = useState({
    name: '',
    description: '',
    audience_id: '',
    funnel_stage: '' as '' | 'awareness' | 'consideration' | 'conversion' | 'retention',
  });

  const handleSave = () => {
    if (!form.name.trim()) return;

    const variation: ModuleVariation = {
      id: `var-${Date.now()}`,
      name: form.name,
      description: form.description || undefined,
      audience_id: form.audience_id || undefined,
      funnel_stage: form.funnel_stage || undefined,
      status: 'planned',
    };

    onSave(variation);
  };

  return (
    <Modal
      isOpen={true}
      onClose={onCancel}
      title="Add Variation"
      size="md"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Variation Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={`e.g., ${config.common_variations[0]}`}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Description (optional)</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What makes this variation different?"
            rows={2}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">For Audience (optional)</label>
            <input
              type="text"
              value={form.audience_id}
              onChange={(e) => setForm({ ...form, audience_id: e.target.value })}
              placeholder="e.g., New Customers"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">For Funnel Stage</label>
            <select
              value={form.funnel_stage}
              onChange={(e) => setForm({ ...form, funnel_stage: e.target.value as any })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
            >
              <option value="">Any stage</option>
              <option value="awareness">Awareness</option>
              <option value="consideration">Consideration</option>
              <option value="conversion">Conversion</option>
              <option value="retention">Retention</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!form.name.trim()}>
          Add Variation
        </Button>
      </div>
    </Modal>
  );
}
