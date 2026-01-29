'use client';

import { usePlanningStore } from '../../stores/planningStore';
import { useUIStore } from '../../stores/uiStore';
import type { ProductionModule, ModuleType } from '../../types/planning';

// ============================================================================
// ARTIFACT 4: PRODUCTION PLAN (Feasibility & Efficiency)
// ============================================================================

const MODULE_TYPE_LABELS: Record<ModuleType, string> = {
  hook: 'Hooks',
  cta: 'CTAs',
  proof: 'Proof Points',
  visual: 'Visuals',
  audio: 'Audio',
  text: 'Text Copy',
};

const SOURCE_TYPE_LABELS = {
  new_shoot: 'New Shoot',
  existing_asset: 'Existing Asset',
  ugc: 'UGC',
  stock: 'Stock',
  generated: 'AI Generated',
};

export function ProductionPlanArtifact() {
  const { productionPlan, contentMatrix, updateProductionPlan } = usePlanningStore();
  const { roleLens } = useUIStore();

  // Group modules by type
  const modulesByType = productionPlan.modules.reduce((acc, mod) => {
    if (!acc[mod.type]) acc[mod.type] = [];
    acc[mod.type].push(mod);
    return acc;
  }, {} as Record<ModuleType, ProductionModule[]>);

  return (
    <div className="space-y-6">
      {/* Production Overview */}
      <div className={`
        bg-slate-900 rounded-xl border p-6
        ${roleLens === 'production' ? 'border-orange-500/50' : 'border-slate-800'}
      `}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-white font-medium">Production Overview</h3>
          {roleLens === 'production' && (
            <span className="px-3 py-1 bg-orange-600/20 text-orange-400 rounded-lg text-sm">
              Production Focus Active
            </span>
          )}
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <MetricCard
            label="Total Modules"
            value={productionPlan.total_modules}
            icon={<ModulesIcon />}
          />
          <MetricCard
            label="Total Assets"
            value={productionPlan.total_assets}
            icon={<AssetsIcon />}
            warning={productionPlan.total_assets > 50}
          />
          <MetricCard
            label="Reuse Rate"
            value={`${productionPlan.reuse_summary.reuse_percentage}%`}
            icon={<ReuseIcon />}
            positive={productionPlan.reuse_summary.reuse_percentage > 30}
          />
          <MetricCard
            label="Complexity"
            value={productionPlan.complexity_score}
            icon={<ComplexityIcon />}
            variant={productionPlan.complexity_score}
          />
        </div>

        {/* Complexity Factors */}
        {productionPlan.complexity_factors.length > 0 && (
          <div className="p-4 bg-slate-800 rounded-lg mb-4">
            <p className="text-slate-400 text-sm mb-2">Complexity Factors:</p>
            <ul className="space-y-1">
              {productionPlan.complexity_factors.map((factor, i) => (
                <li key={i} className="text-white text-sm flex items-center gap-2">
                  <span className="text-amber-400">•</span>
                  {factor}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Capacity Warnings */}
        {productionPlan.capacity_warnings.length > 0 && (
          <div className="space-y-2">
            {productionPlan.capacity_warnings.map((warning, i) => (
              <div
                key={i}
                className="p-3 bg-red-600/10 border border-red-500/30 rounded-lg flex items-center gap-2"
              >
                <WarningIcon className="text-red-400" />
                <p className="text-red-400 text-sm">{warning}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reuse Analysis */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <h3 className="text-white font-medium mb-4">Reuse Analysis</h3>
        
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-slate-800 rounded-lg p-4">
            <p className="text-slate-400 text-sm">Reusable Modules</p>
            <p className="text-2xl font-bold text-green-400">
              {productionPlan.reuse_summary.reusable_modules}
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <p className="text-slate-400 text-sm">Unique Modules</p>
            <p className="text-2xl font-bold text-white">
              {productionPlan.reuse_summary.unique_modules}
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <p className="text-slate-400 text-sm">Efficiency Gain</p>
            <p className="text-2xl font-bold text-blue-400">
              {productionPlan.reuse_summary.reuse_percentage}%
            </p>
          </div>
        </div>

        {productionPlan.reuse_summary.reuse_percentage > 0 && (
          <div className="p-3 bg-green-600/10 border border-green-500/30 rounded-lg">
            <p className="text-green-400 text-sm flex items-center gap-2">
              <CheckIcon />
              Good reuse potential identified. Consider module-first production approach.
            </p>
          </div>
        )}

        {productionPlan.reuse_summary.reuse_percentage === 0 && contentMatrix.cells.length > 5 && (
          <div className="p-3 bg-amber-600/10 border border-amber-500/30 rounded-lg">
            <p className="text-amber-400 text-sm flex items-center gap-2">
              <WarningIcon />
              Low reuse. Consider consolidating message themes or formats.
            </p>
          </div>
        )}
      </div>

      {/* Module Types Required */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <h3 className="text-white font-medium mb-4">Module Types Required</h3>
        
        <div className="grid grid-cols-2 gap-4">
          {(Object.keys(MODULE_TYPE_LABELS) as ModuleType[]).map((type) => {
            const modules = modulesByType[type] || [];
            const totalVariants = modules.reduce((sum, m) => sum + m.estimated_variants, 0);
            
            return (
              <ModuleTypeCard
                key={type}
                type={type}
                label={MODULE_TYPE_LABELS[type]}
                moduleCount={modules.length}
                variantCount={totalVariants}
                modules={modules}
              />
            );
          })}
        </div>
      </div>

      {/* Source Type Breakdown */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <h3 className="text-white font-medium mb-4">Asset Source Assumptions</h3>
        
        <div className="space-y-3">
          {Object.entries(SOURCE_TYPE_LABELS).map(([key, label]) => {
            const count = productionPlan.modules.filter(
              (m) => m.source_type === key
            ).length;
            const percentage = productionPlan.modules.length > 0
              ? Math.round((count / productionPlan.modules.length) * 100)
              : 0;

            return (
              <div key={key} className="flex items-center gap-4">
                <div className="w-32 text-sm text-slate-400">{label}</div>
                <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${getSourceColor(key)}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="w-16 text-right text-sm text-slate-400">
                  {count} ({percentage}%)
                </div>
              </div>
            );
          })}
        </div>

        {productionPlan.modules.length === 0 && (
          <div className="text-center py-8">
            <p className="text-slate-500 text-sm">
              Module breakdown will populate based on Content Matrix
            </p>
          </div>
        )}
      </div>

      {/* Production Timeline Estimate */}
      {productionPlan.estimated_production_days && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
          <h3 className="text-white font-medium mb-4">Timeline Estimate</h3>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-600/20 flex items-center justify-center">
              <span className="text-2xl font-bold text-blue-400">
                {productionPlan.estimated_production_days}
              </span>
            </div>
            <div>
              <p className="text-white font-medium">Production Days</p>
              <p className="text-slate-400 text-sm">
                Based on {productionPlan.total_assets} assets at typical velocity
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Live Impact Note */}
      <div className="p-4 bg-blue-600/10 border border-blue-500/30 rounded-xl">
        <p className="text-blue-400 text-sm flex items-center gap-2">
          <RefreshIcon />
          Production impact updates live as you modify the Content Matrix
        </p>
      </div>
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
  warning,
  positive,
  variant,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  warning?: boolean;
  positive?: boolean;
  variant?: string;
}) {
  const getVariantColor = () => {
    if (variant === 'simple') return 'text-green-400';
    if (variant === 'moderate') return 'text-yellow-400';
    if (variant === 'heavy') return 'text-red-400';
    return 'text-white';
  };

  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-slate-400">{icon}</span>
        <span className="text-slate-400 text-sm">{label}</span>
      </div>
      <p className={`
        text-2xl font-bold capitalize
        ${warning ? 'text-amber-400' : ''}
        ${positive ? 'text-green-400' : ''}
        ${variant ? getVariantColor() : ''}
        ${!warning && !positive && !variant ? 'text-white' : ''}
      `}>
        {value}
      </p>
    </div>
  );
}

function ModuleTypeCard({
  type,
  label,
  moduleCount,
  variantCount,
  modules,
}: {
  type: ModuleType;
  label: string;
  moduleCount: number;
  variantCount: number;
  modules: ProductionModule[];
}) {
  const typeColors: Record<ModuleType, string> = {
    hook: 'bg-purple-600/20 border-purple-500/30 text-purple-400',
    cta: 'bg-blue-600/20 border-blue-500/30 text-blue-400',
    proof: 'bg-green-600/20 border-green-500/30 text-green-400',
    visual: 'bg-orange-600/20 border-orange-500/30 text-orange-400',
    audio: 'bg-pink-600/20 border-pink-500/30 text-pink-400',
    text: 'bg-slate-600/20 border-slate-500/30 text-slate-400',
  };

  return (
    <div className={`p-4 rounded-lg border ${typeColors[type]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium">{label}</span>
        <span className="text-xs opacity-70">{moduleCount} modules</span>
      </div>
      <p className="text-lg font-bold">{variantCount} variants</p>
      {modules.length > 0 && (
        <div className="mt-2 pt-2 border-t border-current/20">
          <p className="text-xs opacity-70">
            Avg complexity: {getAverageComplexity(modules)}
          </p>
        </div>
      )}
    </div>
  );
}

function getAverageComplexity(modules: ProductionModule[]): string {
  if (modules.length === 0) return 'N/A';
  const scores = { simple: 1, moderate: 2, heavy: 3 };
  const avg = modules.reduce((sum, m) => sum + scores[m.complexity], 0) / modules.length;
  if (avg < 1.5) return 'Simple';
  if (avg < 2.5) return 'Moderate';
  return 'Heavy';
}

function getSourceColor(source: string): string {
  switch (source) {
    case 'new_shoot': return 'bg-purple-500';
    case 'existing_asset': return 'bg-green-500';
    case 'ugc': return 'bg-blue-500';
    case 'stock': return 'bg-yellow-500';
    case 'generated': return 'bg-pink-500';
    default: return 'bg-slate-500';
  }
}

// ============================================================================
// ICONS
// ============================================================================

function ModulesIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
    </svg>
  );
}

function AssetsIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function ReuseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function ComplexityIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function WarningIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`w-4 h-4 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}
