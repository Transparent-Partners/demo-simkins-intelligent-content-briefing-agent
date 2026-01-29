'use client';

import { useState } from 'react';
import { useToast, Button, Modal, Select } from '../ui';
import {
  MODULE_TYPE_CONFIG,
  type DecisionRule,
  type DecisionCondition,
  type DecisioningLogic,
  type ConditionType,
  type Operator,
  type ModuleType,
  type Module,
} from '../../types/modules';

// ============================================================================
// DECISIONING EDITOR - Visual rule builder for DCO logic
// ============================================================================

interface DecisioningEditorProps {
  decisioning: DecisioningLogic;
  modules: Module[];
  audiences: { id: string; name: string }[];
  onAddRule: (rule: DecisionRule) => void;
  onUpdateRule: (id: string, updates: Partial<DecisionRule>) => void;
  onRemoveRule: (id: string) => void;
  onReorderRules: (ruleIds: string[]) => void;
  onSetDefault: (moduleType: ModuleType, moduleId: string, variationId: string) => void;
}

const CONDITION_TYPES: { value: ConditionType; label: string; description: string }[] = [
  { value: 'audience', label: 'Audience', description: 'Target specific audience segments' },
  { value: 'funnel_stage', label: 'Funnel Stage', description: 'Based on purchase journey stage' },
  { value: 'trigger', label: 'Contextual Trigger', description: 'Based on context or signals' },
  { value: 'platform', label: 'Platform', description: 'Based on ad platform' },
  { value: 'placement', label: 'Placement', description: 'Based on ad placement' },
  { value: 'daypart', label: 'Day/Time', description: 'Based on time of day' },
  { value: 'geo', label: 'Geography', description: 'Based on location' },
  { value: 'weather', label: 'Weather', description: 'Based on weather conditions' },
];

const OPERATORS: { value: Operator; label: string }[] = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'contains', label: 'contains' },
  { value: 'in', label: 'is one of' },
  { value: 'not_in', label: 'is not one of' },
];

export function DecisioningEditor({
  decisioning,
  modules,
  audiences,
  onAddRule,
  onUpdateRule,
  onRemoveRule,
  onReorderRules,
  onSetDefault,
}: DecisioningEditorProps) {
  const toast = useToast();
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);

  // Calculate coverage metrics
  const coverageMetrics = {
    totalRules: decisioning.rules.length,
    activeRules: decisioning.rules.filter((r) => r.is_active).length,
    coveragePercentage: decisioning.coverage_percentage,
    hasOrphanRules: decisioning.has_orphan_rules,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-white font-semibold text-lg">Decisioning Logic</h3>
            <p className="text-slate-400 text-sm mt-1">
              Define rules for dynamic creative optimization
            </p>
          </div>
          <Button onClick={() => setIsAddingRule(true)}>
            + Add Rule
          </Button>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-4 gap-4">
          <MetricCard
            label="Total Rules"
            value={coverageMetrics.totalRules}
          />
          <MetricCard
            label="Active Rules"
            value={coverageMetrics.activeRules}
          />
          <MetricCard
            label="Matrix Coverage"
            value={`${coverageMetrics.coveragePercentage}%`}
            warning={coverageMetrics.coveragePercentage < 80}
          />
          <MetricCard
            label="Validation"
            value={coverageMetrics.hasOrphanRules ? 'Issues' : 'OK'}
            isStatus
            warning={coverageMetrics.hasOrphanRules}
          />
        </div>

        {/* Warnings */}
        {coverageMetrics.hasOrphanRules && (
          <div className="mt-4 p-3 bg-amber-600/10 border border-amber-500/30 rounded-lg">
            <p className="text-amber-400 text-sm flex items-center gap-2">
              ⚠️ Some rules reference modules or variations that don&apos;t exist
            </p>
          </div>
        )}

        {coverageMetrics.coveragePercentage < 100 && (
          <div className="mt-4 p-3 bg-blue-600/10 border border-blue-500/30 rounded-lg">
            <p className="text-blue-400 text-sm">
              💡 {100 - coverageMetrics.coveragePercentage}% of content matrix cells don&apos;t have specific rules. 
              Default variations will be used.
            </p>
          </div>
        )}
      </div>

      {/* How Decisioning Works */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4">
        <p className="text-slate-400 text-sm">
          <strong className="text-white">How it works:</strong> Rules are evaluated in priority order (1 = highest). 
          When a condition matches, the specified module variation is shown. 
          If no rules match, the default variation is used.
        </p>
      </div>

      {/* Rules List */}
      <div className="space-y-3">
        {decisioning.rules.length > 0 ? (
          decisioning.rules
            .sort((a, b) => a.priority - b.priority)
            .map((rule, index) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                index={index}
                modules={modules}
                isSelected={selectedRuleId === rule.id}
                onSelect={() => setSelectedRuleId(
                  selectedRuleId === rule.id ? null : rule.id
                )}
                onUpdate={(updates) => onUpdateRule(rule.id, updates)}
                onRemove={() => {
                  onRemoveRule(rule.id);
                  toast.info('Rule removed');
                }}
                onMoveUp={() => {
                  if (index === 0) return;
                  const newOrder = [...decisioning.rules.map((r) => r.id)];
                  [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
                  onReorderRules(newOrder);
                }}
                onMoveDown={() => {
                  if (index === decisioning.rules.length - 1) return;
                  const newOrder = [...decisioning.rules.map((r) => r.id)];
                  [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
                  onReorderRules(newOrder);
                }}
              />
            ))
        ) : (
          <EmptyRulesState onAdd={() => setIsAddingRule(true)} />
        )}
      </div>

      {/* Default Variations */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <h4 className="text-white font-medium mb-4">Default Variations</h4>
        <p className="text-slate-400 text-sm mb-4">
          Used when no rules match. Set a default for each module type you&apos;re using.
        </p>
        
        <div className="space-y-3">
          {(Object.keys(MODULE_TYPE_CONFIG) as ModuleType[])
            .filter((type) => modules.some((m) => m.type === type))
            .map((type) => {
              const config = MODULE_TYPE_CONFIG[type];
              const typeModules = modules.filter((m) => m.type === type);
              const defaultSetting = decisioning.defaults[type];
              
              return (
                <div
                  key={type}
                  className="flex items-center justify-between p-3 bg-slate-800 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{config.icon}</span>
                    <span className="text-white font-medium">{config.label}</span>
                  </div>
                  <select
                    value={defaultSetting ? `${defaultSetting.module_id}::${defaultSetting.variation_id}` : ''}
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const [moduleId, variationId] = e.target.value.split('::');
                      onSetDefault(type, moduleId, variationId);
                    }}
                    className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                  >
                    <option value="">Select default...</option>
                    {typeModules.map((mod) => (
                      <optgroup key={mod.id} label={mod.name}>
                        {mod.variations.map((v) => (
                          <option key={v.id} value={`${mod.id}::${v.id}`}>
                            {v.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              );
            })}
        </div>
      </div>

      {/* Add Rule Modal */}
      {isAddingRule && (
        <AddRuleModal
          modules={modules}
          audiences={audiences}
          existingRulesCount={decisioning.rules.length}
          onSave={(rule) => {
            onAddRule(rule);
            setIsAddingRule(false);
            toast.success('Rule created', `"${rule.name}" added to decisioning logic`);
          }}
          onCancel={() => setIsAddingRule(false)}
        />
      )}
    </div>
  );
}

// ============================================================================
// RULE CARD
// ============================================================================

function RuleCard({
  rule,
  index,
  modules,
  isSelected,
  onSelect,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  rule: DecisionRule;
  index: number;
  modules: Module[];
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<DecisionRule>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const targetModule = modules.find((m) => m.id === rule.action.module_id);
  const targetVariation = targetModule?.variations.find((v) => v.id === rule.action.variation_id);
  const moduleConfig = targetModule ? MODULE_TYPE_CONFIG[targetModule.type] : null;

  return (
    <div
      className={`
        bg-slate-900 rounded-xl border transition-all
        ${isSelected ? 'border-blue-500' : 'border-slate-800'}
        ${!rule.is_active ? 'opacity-60' : ''}
      `}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={onSelect}
      >
        <div className="flex items-center gap-4">
          {/* Priority Badge */}
          <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center text-sm font-bold">
            {rule.priority}
          </div>

          {/* Rule Summary */}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-medium">{rule.name}</span>
              {!rule.is_active && (
                <span className="px-2 py-0.5 bg-slate-700 text-slate-400 rounded text-xs">
                  Disabled
                </span>
              )}
            </div>
            <p className="text-slate-400 text-sm mt-0.5">
              {formatConditionsSummary(rule.conditions, rule.condition_logic)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Target */}
          {moduleConfig && targetVariation && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg">
              <span>{moduleConfig.icon}</span>
              <span className="text-white text-sm">{targetVariation.name}</span>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
              className="p-1.5 text-slate-500 hover:text-white rounded"
              title="Move up"
            >
              ▲
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
              className="p-1.5 text-slate-500 hover:text-white rounded"
              title="Move down"
            >
              ▼
            </button>
          </div>
        </div>
      </div>

      {/* Expanded View */}
      {isSelected && (
        <div className="border-t border-slate-800 p-4 space-y-4">
          {/* Conditions */}
          <div>
            <h5 className="text-white font-medium text-sm mb-2">Conditions</h5>
            <div className="space-y-2">
              {rule.conditions.map((condition, i) => (
                <div key={i} className="flex items-center gap-2">
                  {i > 0 && (
                    <span className="text-slate-500 text-xs uppercase">
                      {rule.condition_logic}
                    </span>
                  )}
                  <div className="flex-1 p-2 bg-slate-800 rounded-lg text-sm">
                    <span className="text-blue-400">{condition.type}</span>
                    <span className="text-slate-400"> {condition.operator} </span>
                    <span className="text-white">
                      {Array.isArray(condition.value) 
                        ? condition.value.join(', ') 
                        : condition.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action */}
          <div>
            <h5 className="text-white font-medium text-sm mb-2">Then Show</h5>
            <div className="p-3 bg-slate-800 rounded-lg flex items-center gap-3">
              {moduleConfig && (
                <>
                  <span className="text-lg">{moduleConfig.icon}</span>
                  <div>
                    <p className="text-white text-sm">{targetModule?.name}</p>
                    <p className="text-slate-400 text-xs">
                      Variation: {targetVariation?.name || 'Unknown'}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <button
              onClick={() => onUpdate({ is_active: !rule.is_active })}
              className={`text-sm ${rule.is_active ? 'text-amber-400' : 'text-green-400'}`}
            >
              {rule.is_active ? 'Disable Rule' : 'Enable Rule'}
            </button>
            <button
              onClick={onRemove}
              className="text-sm text-red-400 hover:text-red-300"
            >
              Delete Rule
            </button>
          </div>
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
  warning,
  isStatus,
}: {
  label: string;
  value: string | number;
  warning?: boolean;
  isStatus?: boolean;
}) {
  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <p className="text-slate-400 text-sm mb-1">{label}</p>
      <p className={`text-2xl font-bold ${
        isStatus
          ? warning ? 'text-amber-400' : 'text-green-400'
          : warning ? 'text-amber-400' : 'text-white'
      }`}>
        {value}
      </p>
    </div>
  );
}

function EmptyRulesState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="bg-slate-900 rounded-xl border-2 border-dashed border-slate-700 p-12 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center text-2xl">
        🎯
      </div>
      <h3 className="text-white font-medium mb-2">No decisioning rules defined</h3>
      <p className="text-slate-400 text-sm mb-4">
        Rules determine which creative variation shows to each audience segment.
        Without rules, default variations will be used for all.
      </p>
      <Button onClick={onAdd}>Create Your First Rule</Button>
    </div>
  );
}

function formatConditionsSummary(conditions: DecisionCondition[], logic: 'AND' | 'OR'): string {
  if (conditions.length === 0) return 'No conditions';
  if (conditions.length === 1) {
    const c = conditions[0];
    return `When ${c.type} ${c.operator} "${c.value}"`;
  }
  return `When ${conditions.length} conditions (${logic})`;
}

// ============================================================================
// ADD RULE MODAL
// ============================================================================

function AddRuleModal({
  modules,
  audiences,
  existingRulesCount,
  onSave,
  onCancel,
}: {
  modules: Module[];
  audiences: { id: string; name: string }[];
  existingRulesCount: number;
  onSave: (rule: DecisionRule) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: '',
    conditionType: 'audience' as ConditionType,
    operator: 'equals' as Operator,
    value: '',
    moduleId: '',
    variationId: '',
  });

  const selectedModule = modules.find((m) => m.id === form.moduleId);

  const handleSave = () => {
    if (!form.name.trim() || !form.value.trim() || !form.moduleId || !form.variationId) {
      return;
    }

    const rule: DecisionRule = {
      id: `rule-${Date.now()}`,
      name: form.name,
      priority: existingRulesCount + 1,
      conditions: [
        {
          type: form.conditionType,
          operator: form.operator,
          value: form.value,
        },
      ],
      condition_logic: 'AND',
      action: {
        module_type: selectedModule!.type,
        module_id: form.moduleId,
        variation_id: form.variationId,
      },
      is_active: true,
    };

    onSave(rule);
  };

  return (
    <Modal
      isOpen={true}
      onClose={onCancel}
      title="Add Decisioning Rule"
      description="Define when to show a specific creative variation"
      size="lg"
    >
      <div className="space-y-6">
        {/* Rule Name */}
        <div>
          <label className="block text-sm text-slate-400 mb-1">Rule Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g., New Customers - Awareness Hook"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
          />
        </div>

        {/* Condition (IF) */}
        <div className="p-4 bg-slate-800/50 rounded-lg">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">IF</p>
          
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Condition Type</label>
              <select
                value={form.conditionType}
                onChange={(e) => setForm({ ...form, conditionType: e.target.value as ConditionType })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
              >
                {CONDITION_TYPES.map((ct) => (
                  <option key={ct.value} value={ct.value}>{ct.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Operator</label>
              <select
                value={form.operator}
                onChange={(e) => setForm({ ...form, operator: e.target.value as Operator })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
              >
                {OPERATORS.map((op) => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Value</label>
              {form.conditionType === 'audience' ? (
                <select
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                >
                  <option value="">Select audience...</option>
                  {audiences.map((aud) => (
                    <option key={aud.id} value={aud.id}>{aud.name}</option>
                  ))}
                </select>
              ) : form.conditionType === 'funnel_stage' ? (
                <select
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
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
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  placeholder="Enter value..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                />
              )}
            </div>
          </div>
        </div>

        {/* Action (THEN) */}
        <div className="p-4 bg-green-600/10 border border-green-500/30 rounded-lg">
          <p className="text-xs text-green-400 uppercase tracking-wider mb-3">THEN SHOW</p>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Module</label>
              <select
                value={form.moduleId}
                onChange={(e) => setForm({ ...form, moduleId: e.target.value, variationId: '' })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
              >
                <option value="">Select module...</option>
                {modules.map((mod) => {
                  const config = MODULE_TYPE_CONFIG[mod.type];
                  return (
                    <option key={mod.id} value={mod.id}>
                      {config.icon} {mod.name}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Variation</label>
              <select
                value={form.variationId}
                onChange={(e) => setForm({ ...form, variationId: e.target.value })}
                disabled={!form.moduleId}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm disabled:opacity-50"
              >
                <option value="">Select variation...</option>
                {selectedModule?.variations.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={!form.name.trim() || !form.value || !form.moduleId || !form.variationId}
        >
          Create Rule
        </Button>
      </div>
    </Modal>
  );
}
