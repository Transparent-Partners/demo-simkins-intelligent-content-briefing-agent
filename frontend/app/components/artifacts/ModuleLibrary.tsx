'use client';

import React, { useState, useMemo } from 'react';
import { MODULE_TYPE_CONFIG, ModuleType, Module, ModuleVariation, DecisionRule, DecisionCondition, PlatformId, PLATFORM_LIBRARY } from '../../types/modules';

// ============================================================================
// MODULE LIBRARY COMPONENT
// ============================================================================

interface ModuleLibraryProps {
  modules: Module[];
  onModulesChange: (modules: Module[]) => void;
  audiences: { id: string; name: string }[];
  onClose?: () => void;
}

export function ModuleLibrary({ modules, onModulesChange, audiences, onClose }: ModuleLibraryProps) {
  const [activeTab, setActiveTab] = useState<'library' | 'create'>('library');
  const [selectedType, setSelectedType] = useState<ModuleType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredModules = useMemo(() => {
    return modules.filter(m => {
      const matchesType = !selectedType || m.type === selectedType;
      const matchesSearch = !searchQuery || 
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [modules, selectedType, searchQuery]);

  const modulesByType = useMemo(() => {
    const grouped: Record<string, Module[]> = {};
    for (const module of filteredModules) {
      if (!grouped[module.type]) grouped[module.type] = [];
      grouped[module.type].push(module);
    }
    return grouped;
  }, [filteredModules]);

  const handleCreateModule = (type: ModuleType, name: string, description: string) => {
    const newModule: Module = {
      id: `mod_${Date.now()}`,
      type,
      name,
      description,
      variations: [],
      format: 'image',
      specs: {},
      source_type: 'new_shoot',
      reuse_count: 0,
      used_in_cells: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    onModulesChange([...modules, newModule]);
    setActiveTab('library');
  };

  const handleDeleteModule = (moduleId: string) => {
    onModulesChange(modules.filter(m => m.id !== moduleId));
  };

  const handleAddVariation = (moduleId: string, variation: ModuleVariation) => {
    onModulesChange(modules.map(m => {
      if (m.id === moduleId) {
        return { ...m, variations: [...m.variations, variation] };
      }
      return m;
    }));
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Module Library</h2>
          <p className="text-xs text-slate-500 mt-0.5">Reusable creative modules for ModCon production</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('library')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === 'library' 
                ? 'bg-emerald-100 text-emerald-700' 
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Library
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === 'create' 
                ? 'bg-emerald-100 text-emerald-700' 
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            + Create Module
          </button>
          {onClose && (
            <button onClick={onClose} className="ml-2 text-slate-400 hover:text-slate-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {activeTab === 'library' ? (
        <div className="p-6">
          {/* Search and Filter */}
          <div className="flex gap-3 mb-6">
            <input
              type="text"
              placeholder="Search modules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <select
              value={selectedType || ''}
              onChange={(e) => setSelectedType(e.target.value as ModuleType || null)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All Types</option>
              {Object.entries(MODULE_TYPE_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
          </div>

          {/* Module Type Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
            {Object.entries(MODULE_TYPE_CONFIG).map(([type, config]) => {
              const count = modulesByType[type]?.length || 0;
              return (
                <button
                  key={type}
                  onClick={() => setSelectedType(selectedType === type ? null : type as ModuleType)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    selectedType === type
                      ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{config.icon}</span>
                    <span className="text-sm font-medium text-slate-700">{config.label}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 line-clamp-2">{config.description}</p>
                  <div className="mt-2 text-[10px] text-slate-400">{count} modules</div>
                </button>
              );
            })}
          </div>

          {/* Module List */}
          <div className="space-y-3">
            {filteredModules.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <p>No modules found. Create your first module to get started.</p>
              </div>
            ) : (
              filteredModules.map((module) => (
                <ModuleCard
                  key={module.id}
                  module={module}
                  audiences={audiences}
                  onDelete={() => handleDeleteModule(module.id)}
                  onAddVariation={(v) => handleAddVariation(module.id, v)}
                />
              ))
            )}
          </div>
        </div>
      ) : (
        <CreateModuleForm
          onSubmit={handleCreateModule}
          onCancel={() => setActiveTab('library')}
        />
      )}
    </div>
  );
}

// ============================================================================
// MODULE CARD
// ============================================================================

interface ModuleCardProps {
  module: Module;
  audiences: { id: string; name: string }[];
  onDelete: () => void;
  onAddVariation: (variation: ModuleVariation) => void;
}

function ModuleCard({ module, audiences, onDelete, onAddVariation }: ModuleCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAddVariation, setShowAddVariation] = useState(false);
  const config = MODULE_TYPE_CONFIG[module.type];

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <div 
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{config.icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-800">{module.name}</span>
              <span className={`px-2 py-0.5 text-[10px] rounded-full bg-${config.color}-100 text-${config.color}-700`}>
                {config.label}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{module.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">{module.variations.length} variations</span>
          <svg 
            className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-slate-100 p-4 bg-slate-50">
          {/* Module Details */}
          <div className="grid grid-cols-3 gap-4 mb-4 text-xs">
            <div>
              <span className="text-slate-500">Format:</span>
              <span className="ml-2 text-slate-700">{module.format}</span>
            </div>
            <div>
              <span className="text-slate-500">Source:</span>
              <span className="ml-2 text-slate-700">{module.source_type.replace('_', ' ')}</span>
            </div>
            <div>
              <span className="text-slate-500">Reuse Count:</span>
              <span className="ml-2 text-slate-700">{module.reuse_count}</span>
            </div>
          </div>

          {/* Variations */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-medium text-slate-700">Variations</h4>
              <button
                onClick={() => setShowAddVariation(true)}
                className="text-xs text-emerald-600 hover:text-emerald-700"
              >
                + Add Variation
              </button>
            </div>
            {module.variations.length === 0 ? (
              <p className="text-xs text-slate-400">No variations yet</p>
            ) : (
              <div className="space-y-2">
                {module.variations.map((v) => (
                  <div key={v.id} className="p-2 bg-white rounded border border-slate-200 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{v.name}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        v.status === 'approved' ? 'bg-green-100 text-green-700' :
                        v.status === 'in_production' ? 'bg-amber-100 text-amber-700' :
                        v.status === 'live' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {v.status}
                      </span>
                    </div>
                    {v.audience_id && (
                      <div className="mt-1 text-slate-500">
                        Audience: {audiences.find(a => a.id === v.audience_id)?.name || v.audience_id}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <button
              onClick={onDelete}
              className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded"
            >
              Delete
            </button>
          </div>

          {/* Add Variation Modal */}
          {showAddVariation && (
            <AddVariationModal
              audiences={audiences}
              onSubmit={(v) => {
                onAddVariation(v);
                setShowAddVariation(false);
              }}
              onClose={() => setShowAddVariation(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CREATE MODULE FORM
// ============================================================================

interface CreateModuleFormProps {
  onSubmit: (type: ModuleType, name: string, description: string) => void;
  onCancel: () => void;
}

function CreateModuleForm({ onSubmit, onCancel }: CreateModuleFormProps) {
  const [type, setType] = useState<ModuleType>('hook');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && description) {
      onSubmit(type, name, description);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <h3 className="text-sm font-semibold text-slate-800 mb-4">Create New Module</h3>
      
      {/* Type Selection */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-slate-600 mb-2">Module Type</label>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(MODULE_TYPE_CONFIG).map(([key, config]) => (
            <button
              key={key}
              type="button"
              onClick={() => setType(key as ModuleType)}
              className={`p-2 rounded-lg border text-left transition-all ${
                type === key
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-1">
                <span>{config.icon}</span>
                <span className="text-xs font-medium">{config.label}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Name */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Hero Product Shot"
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          required
        />
      </div>

      {/* Description */}
      <div className="mb-6">
        <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the module and its purpose..."
          rows={3}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          required
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
        >
          Create Module
        </button>
      </div>
    </form>
  );
}

// ============================================================================
// ADD VARIATION MODAL
// ============================================================================

interface AddVariationModalProps {
  audiences: { id: string; name: string }[];
  onSubmit: (variation: ModuleVariation) => void;
  onClose: () => void;
}

function AddVariationModal({ audiences, onSubmit, onClose }: AddVariationModalProps) {
  const [name, setName] = useState('');
  const [audienceId, setAudienceId] = useState('');
  const [funnelStage, setFunnelStage] = useState<'awareness' | 'consideration' | 'conversion' | 'retention' | ''>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      id: `var_${Date.now()}`,
      name,
      audience_id: audienceId || undefined,
      funnel_stage: funnelStage || undefined,
      status: 'planned',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <h3 className="text-sm font-semibold text-slate-800 mb-4">Add Variation</h3>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-600 mb-1">Variation Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Millennials - Awareness"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-600 mb-1">Target Audience (optional)</label>
            <select
              value={audienceId}
              onChange={(e) => setAudienceId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
            >
              <option value="">All Audiences</option>
              {audiences.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <label className="block text-xs font-medium text-slate-600 mb-1">Funnel Stage (optional)</label>
            <select
              value={funnelStage}
              onChange={(e) => setFunnelStage(e.target.value as any)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
            >
              <option value="">All Stages</option>
              <option value="awareness">Awareness</option>
              <option value="consideration">Consideration</option>
              <option value="conversion">Conversion</option>
              <option value="retention">Retention</option>
            </select>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              Add Variation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// DECISIONING LOGIC EDITOR
// ============================================================================

interface DecisioningEditorProps {
  rules: DecisionRule[];
  onRulesChange: (rules: DecisionRule[]) => void;
  modules: Module[];
  audiences: { id: string; name: string }[];
  onClose?: () => void;
}

export function DecisioningEditor({ rules, onRulesChange, modules, audiences, onClose }: DecisioningEditorProps) {
  const [showAddRule, setShowAddRule] = useState(false);

  const handleAddRule = (rule: DecisionRule) => {
    onRulesChange([...rules, rule]);
    setShowAddRule(false);
  };

  const handleDeleteRule = (ruleId: string) => {
    onRulesChange(rules.filter(r => r.id !== ruleId));
  };

  const handleToggleRule = (ruleId: string) => {
    onRulesChange(rules.map(r => 
      r.id === ruleId ? { ...r, is_active: !r.is_active } : r
    ));
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Decisioning Logic</h2>
          <p className="text-xs text-slate-500 mt-0.5">IF/THEN rules for DCO personalization</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddRule(true)}
            className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            + Add Rule
          </button>
          {onClose && (
            <button onClick={onClose} className="ml-2 text-slate-400 hover:text-slate-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="p-6">
        {rules.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <p>No decisioning rules yet.</p>
            <p className="text-xs mt-1">Add rules to personalize content for different audiences and contexts.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.sort((a, b) => a.priority - b.priority).map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                modules={modules}
                audiences={audiences}
                onDelete={() => handleDeleteRule(rule.id)}
                onToggle={() => handleToggleRule(rule.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Rule Modal */}
      {showAddRule && (
        <AddRuleModal
          modules={modules}
          audiences={audiences}
          onSubmit={handleAddRule}
          onClose={() => setShowAddRule(false)}
        />
      )}
    </div>
  );
}

// ============================================================================
// RULE CARD
// ============================================================================

interface RuleCardProps {
  rule: DecisionRule;
  modules: Module[];
  audiences: { id: string; name: string }[];
  onDelete: () => void;
  onToggle: () => void;
}

function RuleCard({ rule, modules, audiences, onDelete, onToggle }: RuleCardProps) {
  const module = modules.find(m => m.id === rule.action.module_id);
  const variation = module?.variations.find(v => v.id === rule.action.variation_id);

  return (
    <div className={`border rounded-lg overflow-hidden ${
      rule.is_active ? 'border-slate-200' : 'border-slate-100 bg-slate-50 opacity-60'
    }`}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400">#{rule.priority}</span>
            <span className="font-medium text-slate-800">{rule.name}</span>
            {!rule.is_active && (
              <span className="px-1.5 py-0.5 text-[10px] bg-slate-200 text-slate-600 rounded">Disabled</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onToggle}
              className={`px-2 py-1 text-[10px] rounded ${
                rule.is_active 
                  ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              }`}
            >
              {rule.is_active ? 'Active' : 'Inactive'}
            </button>
            <button onClick={onDelete} className="text-red-500 hover:text-red-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* IF conditions */}
        <div className="mb-3">
          <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded">IF</span>
          <div className="mt-2 pl-4 space-y-1">
            {rule.conditions.map((cond, i) => (
              <div key={i} className="text-xs text-slate-600">
                {i > 0 && <span className="text-purple-500 mr-1">{rule.condition_logic}</span>}
                <span className="font-medium">{cond.type}</span>
                <span className="mx-1">{cond.operator.replace('_', ' ')}</span>
                <span className="text-slate-800">
                  {Array.isArray(cond.value) ? cond.value.join(', ') : String(cond.value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* THEN action */}
        <div>
          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">THEN</span>
          <div className="mt-2 pl-4 text-xs text-slate-600">
            Show <span className="font-medium text-slate-800">{module?.name || rule.action.module_id}</span>
            {variation && (
              <> - <span className="text-slate-700">{variation.name}</span></>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ADD RULE MODAL
// ============================================================================

interface AddRuleModalProps {
  modules: Module[];
  audiences: { id: string; name: string }[];
  onSubmit: (rule: DecisionRule) => void;
  onClose: () => void;
}

function AddRuleModal({ modules, audiences, onSubmit, onClose }: AddRuleModalProps) {
  const [name, setName] = useState('');
  const [priority, setPriority] = useState(100);
  const [conditionType, setConditionType] = useState<string>('audience');
  const [operator, setOperator] = useState<string>('equals');
  const [conditionValue, setConditionValue] = useState('');
  const [conditionLogic, setConditionLogic] = useState<'AND' | 'OR'>('AND');
  const [conditions, setConditions] = useState<DecisionCondition[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState('');
  const [selectedVariationId, setSelectedVariationId] = useState('');

  const selectedModule = modules.find(m => m.id === selectedModuleId);

  const handleAddCondition = () => {
    if (conditionValue) {
      const newCondition: DecisionCondition = {
        type: conditionType as any,
        operator: operator as any,
        value: conditionValue,
      };
      setConditions([...conditions, newCondition]);
      setConditionValue('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && conditions.length > 0 && selectedModuleId) {
      const rule: DecisionRule = {
        id: `rule_${Date.now()}`,
        name,
        priority,
        conditions,
        condition_logic: conditionLogic,
        action: {
          module_type: selectedModule?.type || 'hook',
          module_id: selectedModuleId,
          variation_id: selectedVariationId || selectedModule?.variations[0]?.id || '',
        },
        is_active: true,
      };
      onSubmit(rule);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <h3 className="text-sm font-semibold text-slate-800 mb-4">Create Decisioning Rule</h3>
        
        <form onSubmit={handleSubmit}>
          {/* Rule Name & Priority */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Rule Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Millennials Awareness"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Priority (lower = higher)</label>
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value))}
                min={1}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          {/* Conditions */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-600 mb-2">
              IF Conditions
              {conditions.length > 1 && (
                <select
                  value={conditionLogic}
                  onChange={(e) => setConditionLogic(e.target.value as 'AND' | 'OR')}
                  className="ml-2 px-2 py-0.5 text-xs border border-slate-200 rounded"
                >
                  <option value="AND">AND</option>
                  <option value="OR">OR</option>
                </select>
              )}
            </label>
            
            {/* Added conditions */}
            {conditions.length > 0 && (
              <div className="mb-2 space-y-1">
                {conditions.map((cond, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs bg-purple-50 p-2 rounded">
                    {i > 0 && <span className="text-purple-500">{conditionLogic}</span>}
                    <span>{cond.type} {cond.operator} {String(cond.value)}</span>
                    <button
                      type="button"
                      onClick={() => setConditions(conditions.filter((_, idx) => idx !== i))}
                      className="ml-auto text-red-500"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add condition form */}
            <div className="flex gap-2">
              <select
                value={conditionType}
                onChange={(e) => setConditionType(e.target.value)}
                className="px-2 py-1.5 text-xs border border-slate-200 rounded"
              >
                <option value="audience">Audience</option>
                <option value="funnel_stage">Funnel Stage</option>
                <option value="platform">Platform</option>
                <option value="geo">Geography</option>
                <option value="trigger">Trigger</option>
              </select>
              <select
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                className="px-2 py-1.5 text-xs border border-slate-200 rounded"
              >
                <option value="equals">equals</option>
                <option value="not_equals">not equals</option>
                <option value="contains">contains</option>
                <option value="in">in</option>
              </select>
              {conditionType === 'audience' ? (
                <select
                  value={conditionValue}
                  onChange={(e) => setConditionValue(e.target.value)}
                  className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded"
                >
                  <option value="">Select audience...</option>
                  {audiences.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              ) : conditionType === 'funnel_stage' ? (
                <select
                  value={conditionValue}
                  onChange={(e) => setConditionValue(e.target.value)}
                  className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded"
                >
                  <option value="">Select stage...</option>
                  <option value="awareness">Awareness</option>
                  <option value="consideration">Consideration</option>
                  <option value="conversion">Conversion</option>
                  <option value="retention">Retention</option>
                </select>
              ) : (
                <input
                  type="text"
                  value={conditionValue}
                  onChange={(e) => setConditionValue(e.target.value)}
                  placeholder="Value..."
                  className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded"
                />
              )}
              <button
                type="button"
                onClick={handleAddCondition}
                className="px-3 py-1.5 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
              >
                Add
              </button>
            </div>
          </div>

          {/* Action */}
          <div className="mb-6">
            <label className="block text-xs font-medium text-slate-600 mb-2">THEN Show Module</label>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={selectedModuleId}
                onChange={(e) => {
                  setSelectedModuleId(e.target.value);
                  setSelectedVariationId('');
                }}
                className="px-2 py-1.5 text-xs border border-slate-200 rounded"
                required
              >
                <option value="">Select module...</option>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              {selectedModule && selectedModule.variations.length > 0 && (
                <select
                  value={selectedVariationId}
                  onChange={(e) => setSelectedVariationId(e.target.value)}
                  className="px-2 py-1.5 text-xs border border-slate-200 rounded"
                >
                  <option value="">Default variation</option>
                  {selectedModule.variations.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name || conditions.length === 0 || !selectedModuleId}
              className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              Create Rule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// PLATFORM EXPORT COMPONENT
// ============================================================================

interface PlatformExportProps {
  feedRows: any[];
  rules: DecisionRule[];
  campaignName: string;
  onClose?: () => void;
}

export function PlatformExport({ feedRows, rules, campaignName, onClose }: PlatformExportProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformId | null>(null);
  const [exportResult, setExportResult] = useState<{ content: string; filename: string } | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const platforms = [
    { id: 'flashtalking' as PlatformId, name: 'Flashtalking', format: 'CSV', category: 'DCO' },
    { id: 'innovid' as PlatformId, name: 'Innovid', format: 'JSON', category: 'DCO' },
    { id: 'clinch' as PlatformId, name: 'Clinch', format: 'CSV', category: 'DCO' },
    { id: 'celtra' as PlatformId, name: 'Celtra', format: 'JSON', category: 'Production Automation' },
    { id: 'storyteq' as PlatformId, name: 'Storyteq', format: 'CSV', category: 'Production Automation' },
    { id: 'google_studio' as PlatformId, name: 'Google Creative Studio', format: 'CSV', category: 'Production Automation' },
  ];

  const handleExport = async () => {
    if (!selectedPlatform) return;
    
    setIsExporting(true);
    try {
      const response = await fetch('/api/modules/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: selectedPlatform,
          campaign_name: campaignName,
          feed_rows: feedRows,
          rules: rules,
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        setExportResult({ content: result.content, filename: result.filename });
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
    setIsExporting(false);
  };

  const handleDownload = () => {
    if (!exportResult) return;
    
    const blob = new Blob([exportResult.content], { 
      type: exportResult.filename.endsWith('.json') ? 'application/json' : 'text/csv' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportResult.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Export to Platform</h2>
          <p className="text-xs text-slate-500 mt-0.5">Generate feed for DCO or production automation platform</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="p-6">
        {/* Platform Selection */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          {platforms.map((platform) => (
            <button
              key={platform.id}
              onClick={() => setSelectedPlatform(platform.id)}
              className={`p-4 rounded-lg border text-left transition-all ${
                selectedPlatform === platform.id
                  ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="font-medium text-sm text-slate-800">{platform.name}</div>
              <div className="text-[10px] text-slate-500 mt-1">
                {platform.category} • {platform.format}
              </div>
            </button>
          ))}
        </div>

        {/* Export Info */}
        <div className="bg-slate-50 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-slate-500">Feed Rows:</span>
              <span className="ml-2 font-medium">{feedRows.length}</span>
            </div>
            <div>
              <span className="text-slate-500">Rules:</span>
              <span className="ml-2 font-medium">{rules.length}</span>
            </div>
            <div>
              <span className="text-slate-500">Campaign:</span>
              <span className="ml-2 font-medium">{campaignName}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          {exportResult ? (
            <>
              <button
                onClick={() => setExportResult(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Export Another
              </button>
              <button
                onClick={handleDownload}
                className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                Download {exportResult.filename}
              </button>
            </>
          ) : (
            <button
              onClick={handleExport}
              disabled={!selectedPlatform || isExporting}
              className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {isExporting ? 'Exporting...' : 'Generate Export'}
            </button>
          )}
        </div>

        {/* Preview */}
        {exportResult && (
          <div className="mt-6">
            <h4 className="text-xs font-medium text-slate-600 mb-2">Preview</h4>
            <pre className="p-4 bg-slate-900 text-slate-100 rounded-lg text-xs overflow-auto max-h-64">
              {exportResult.content.slice(0, 2000)}
              {exportResult.content.length > 2000 && '\n\n... (truncated)'}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
