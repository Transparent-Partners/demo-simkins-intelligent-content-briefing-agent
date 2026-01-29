'use client';

import { useState } from 'react';
import { usePlanningStore } from '../../stores/planningStore';
import { useToast, Button, Modal } from '../ui';
import type { PlanningPackageType } from '../../types/planning';

// ============================================================================
// PLANNING PACKAGES - Export role-specific bundles
// ============================================================================

const PACKAGE_CONFIGS: Record<PlanningPackageType, {
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  artifacts: string[];
  whatItIs: string[];
  whatItIsNot: string[];
}> = {
  creative_planning_pack: {
    name: 'Creative Planning Pack',
    description: 'For creative teams: narrative, audiences, and message themes',
    icon: <CreativeIcon />,
    color: 'purple',
    artifacts: ['Activation Brief', 'Audience Map', 'Content Matrix (Message Themes)'],
    whatItIs: [
      'Single-minded proposition and narrative',
      'Audience insights and perceptions',
      'Message themes by funnel stage',
      'Creative variant requirements',
    ],
    whatItIsNot: [
      'Production specifications',
      'Media buying details',
      'Technical file requirements',
    ],
  },
  production_scope_pack: {
    name: 'Production Scope Pack',
    description: 'For production teams: volume, formats, and complexity',
    icon: <ProductionIcon />,
    color: 'orange',
    artifacts: ['Content Matrix (Formats)', 'Production Plan', 'Module Breakdown'],
    whatItIs: [
      'Total asset count and variants',
      'Format and dimension requirements',
      'Complexity assessment',
      'Reuse opportunities',
    ],
    whatItIsNot: [
      'Creative direction details',
      'Audience targeting specs',
      'Media flighting schedules',
    ],
  },
  media_activation_pack: {
    name: 'Media Activation Pack',
    description: 'For media teams: placements, formats, and flighting intent',
    icon: <MediaIcon />,
    color: 'green',
    artifacts: ['Audience Map (Signals)', 'Content Matrix (Placements)', 'Media Alignment Plan'],
    whatItIs: [
      'Platform and placement requirements',
      'Format compatibility needs',
      'Rotation strategy assumptions',
      'Flighting intent and windows',
    ],
    whatItIsNot: [
      'Budget allocations',
      'Trafficking instructions',
      'Ad server configurations',
    ],
  },
  full_modcon_plan: {
    name: 'Full ModCon Plan',
    description: 'Complete planning package with all artifacts',
    icon: <FullPlanIcon />,
    color: 'blue',
    artifacts: ['All 5 Planning Artifacts', 'Alignment Status', 'Version History'],
    whatItIs: [
      'Complete activation planning document',
      'Cross-functional alignment record',
      'Single source of truth',
    ],
    whatItIsNot: [
      'Execution/trafficking document',
      'Creative assets or files',
      'Media buy or insertion order',
    ],
  },
};

export function PlanningPackages() {
  const [selectedPackage, setSelectedPackage] = useState<PlanningPackageType | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const toast = useToast();

  const handleExport = async (packageType: PlanningPackageType, format: 'pdf' | 'json') => {
    setIsExporting(true);
    
    // Simulate export
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    // In real implementation, call API to generate package
    toast.success(
      'Export complete',
      `${PACKAGE_CONFIGS[packageType].name} exported as ${format.toUpperCase()}`
    );
    
    setIsExporting(false);
    setSelectedPackage(null);
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <h3 className="text-white font-medium mb-2">Planning Packages</h3>
        <p className="text-slate-400 text-sm mb-6">
          Export role-specific planning bundles with clear context and assumptions.
        </p>

        <div className="grid grid-cols-2 gap-4">
          {(Object.keys(PACKAGE_CONFIGS) as PlanningPackageType[]).map((type) => {
            const config = PACKAGE_CONFIGS[type];
            
            return (
              <PackageCard
                key={type}
                type={type}
                config={config}
                isSelected={selectedPackage === type}
                onSelect={() => setSelectedPackage(type)}
              />
            );
          })}
        </div>
      </div>

      {/* Export Modal */}
      {selectedPackage && (
        <ExportModal
          packageType={selectedPackage}
          config={PACKAGE_CONFIGS[selectedPackage]}
          isExporting={isExporting}
          onExport={(format) => handleExport(selectedPackage, format)}
          onClose={() => setSelectedPackage(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// PACKAGE CARD
// ============================================================================

function PackageCard({
  type,
  config,
  isSelected,
  onSelect,
}: {
  type: PlanningPackageType;
  config: (typeof PACKAGE_CONFIGS)[PlanningPackageType];
  isSelected: boolean;
  onSelect: () => void;
}) {
  const getColorClasses = () => {
    switch (config.color) {
      case 'purple':
        return 'hover:border-purple-500/50 hover:bg-purple-600/5';
      case 'orange':
        return 'hover:border-orange-500/50 hover:bg-orange-600/5';
      case 'green':
        return 'hover:border-green-500/50 hover:bg-green-600/5';
      case 'blue':
        return 'hover:border-blue-500/50 hover:bg-blue-600/5';
      default:
        return '';
    }
  };

  return (
    <button
      onClick={onSelect}
      className={`
        p-4 rounded-xl border border-slate-700 text-left transition-all
        ${getColorClasses()}
        ${isSelected ? 'ring-2 ring-blue-500' : ''}
      `}
    >
      <div className="flex items-start gap-3">
        <div className={`
          w-10 h-10 rounded-lg flex items-center justify-center
          ${config.color === 'purple' ? 'bg-purple-600/20 text-purple-400' : ''}
          ${config.color === 'orange' ? 'bg-orange-600/20 text-orange-400' : ''}
          ${config.color === 'green' ? 'bg-green-600/20 text-green-400' : ''}
          ${config.color === 'blue' ? 'bg-blue-600/20 text-blue-400' : ''}
        `}>
          {config.icon}
        </div>
        <div className="flex-1">
          <p className="text-white font-medium">{config.name}</p>
          <p className="text-slate-400 text-sm mt-1">{config.description}</p>
          <div className="flex flex-wrap gap-1 mt-3">
            {config.artifacts.slice(0, 2).map((artifact, i) => (
              <span
                key={i}
                className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded text-xs"
              >
                {artifact}
              </span>
            ))}
            {config.artifacts.length > 2 && (
              <span className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded text-xs">
                +{config.artifacts.length - 2} more
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// EXPORT MODAL
// ============================================================================

function ExportModal({
  packageType,
  config,
  isExporting,
  onExport,
  onClose,
}: {
  packageType: PlanningPackageType;
  config: (typeof PACKAGE_CONFIGS)[PlanningPackageType];
  isExporting: boolean;
  onExport: (format: 'pdf' | 'json') => void;
  onClose: () => void;
}) {
  const { activationBrief, alignment } = usePlanningStore();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 w-full max-w-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className={`
            w-12 h-12 rounded-lg flex items-center justify-center
            ${config.color === 'purple' ? 'bg-purple-600/20 text-purple-400' : ''}
            ${config.color === 'orange' ? 'bg-orange-600/20 text-orange-400' : ''}
            ${config.color === 'green' ? 'bg-green-600/20 text-green-400' : ''}
            ${config.color === 'blue' ? 'bg-blue-600/20 text-blue-400' : ''}
          `}>
            {config.icon}
          </div>
          <div>
            <h3 className="text-white font-medium">{config.name}</h3>
            <p className="text-slate-400 text-sm">{config.description}</p>
          </div>
        </div>

        {/* Package Contents */}
        <div className="mb-6">
          <p className="text-slate-400 text-sm mb-2">Included Artifacts:</p>
          <div className="flex flex-wrap gap-2">
            {config.artifacts.map((artifact, i) => (
              <span
                key={i}
                className="px-3 py-1 bg-slate-800 text-white rounded-lg text-sm"
              >
                {artifact}
              </span>
            ))}
          </div>
        </div>

        {/* What This Is / Is Not */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-3 bg-green-600/10 border border-green-500/30 rounded-lg">
            <p className="text-green-400 text-xs font-medium mb-2">What This Is</p>
            <ul className="text-slate-300 text-xs space-y-1">
              {config.whatItIs.map((item, i) => (
                <li key={i}>• {item}</li>
              ))}
            </ul>
          </div>
          <div className="p-3 bg-red-600/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-xs font-medium mb-2">What This Is Not</p>
            <ul className="text-slate-300 text-xs space-y-1">
              {config.whatItIsNot.map((item, i) => (
                <li key={i}>• {item}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Metadata */}
        <div className="p-3 bg-slate-800 rounded-lg mb-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-400">Campaign</p>
              <p className="text-white">{activationBrief.campaign_name || 'Untitled'}</p>
            </div>
            <div>
              <p className="text-slate-400">Version</p>
              <p className="text-white">v{activationBrief.version}</p>
            </div>
            <div>
              <p className="text-slate-400">Last Updated</p>
              <p className="text-white">
                {new Date(activationBrief.last_updated).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-slate-400">Status</p>
              <p className={`${alignment.is_plan_locked ? 'text-green-400' : 'text-amber-400'}`}>
                {alignment.is_plan_locked ? 'Locked' : 'In Progress'}
              </p>
            </div>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 text-slate-400 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onExport('json')}
            disabled={isExporting}
            className="flex-1 py-2.5 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isExporting ? <Spinner /> : <JsonIcon />}
            Export JSON
          </button>
          <button
            onClick={() => onExport('pdf')}
            disabled={isExporting}
            className={`
              flex-1 py-2.5 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2
              ${config.color === 'purple' ? 'bg-purple-600 hover:bg-purple-700' : ''}
              ${config.color === 'orange' ? 'bg-orange-600 hover:bg-orange-700' : ''}
              ${config.color === 'green' ? 'bg-green-600 hover:bg-green-700' : ''}
              ${config.color === 'blue' ? 'bg-blue-600 hover:bg-blue-700' : ''}
            `}
          >
            {isExporting ? <Spinner /> : <PdfIcon />}
            Export PDF
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ICONS
// ============================================================================

function CreativeIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
    </svg>
  );
}

function ProductionIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  );
}

function MediaIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function FullPlanIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function JsonIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}
