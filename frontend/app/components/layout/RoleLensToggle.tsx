'use client';

import { useUIStore } from '../../stores/uiStore';
import { ROLE_LENS_CONFIGS, type RoleLens } from '../../types/planning';

// ============================================================================
// ROLE LENS TOGGLE - Switch between Creative, Production, Media, All views
// ============================================================================

export function RoleLensToggle() {
  const { roleLens, setRoleLens } = useUIStore();

  const lenses: RoleLens[] = ['all', 'creative', 'production', 'media'];

  return (
    <div className="flex items-center gap-1 p-1 bg-slate-800 rounded-xl">
      {lenses.map((lens) => {
        const config = ROLE_LENS_CONFIGS[lens];
        const isActive = roleLens === lens;

        return (
          <button
            key={lens}
            onClick={() => setRoleLens(lens)}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
              ${isActive
                ? getLensActiveStyle(lens)
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }
            `}
            title={config.description}
          >
            <span className="flex items-center gap-2">
              {getLensIcon(lens)}
              {config.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// COMPACT VERSION FOR HEADER
// ============================================================================

export function RoleLensToggleCompact() {
  const { roleLens, setRoleLens } = useUIStore();

  const lenses: RoleLens[] = ['all', 'creative', 'production', 'media'];

  return (
    <div className="flex items-center gap-0.5 p-0.5 bg-slate-800/50 rounded-lg">
      {lenses.map((lens) => {
        const config = ROLE_LENS_CONFIGS[lens];
        const isActive = roleLens === lens;

        return (
          <button
            key={lens}
            onClick={() => setRoleLens(lens)}
            className={`
              px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150
              ${isActive
                ? getLensActiveStyleCompact(lens)
                : 'text-slate-500 hover:text-slate-300'
              }
            `}
            title={config.description}
          >
            {config.label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getLensActiveStyle(lens: RoleLens): string {
  switch (lens) {
    case 'all':
      return 'bg-slate-700 text-white';
    case 'creative':
      return 'bg-purple-600 text-white';
    case 'production':
      return 'bg-orange-600 text-white';
    case 'media':
      return 'bg-green-600 text-white';
    default:
      return 'bg-slate-700 text-white';
  }
}

function getLensActiveStyleCompact(lens: RoleLens): string {
  switch (lens) {
    case 'all':
      return 'bg-slate-700 text-white';
    case 'creative':
      return 'bg-purple-600/20 text-purple-400 border border-purple-500/30';
    case 'production':
      return 'bg-orange-600/20 text-orange-400 border border-orange-500/30';
    case 'media':
      return 'bg-green-600/20 text-green-400 border border-green-500/30';
    default:
      return 'bg-slate-700 text-white';
  }
}

function getLensIcon(lens: RoleLens) {
  switch (lens) {
    case 'all':
      return <AllIcon />;
    case 'creative':
      return <CreativeIcon />;
    case 'production':
      return <ProductionIcon />;
    case 'media':
      return <MediaIcon />;
    default:
      return null;
  }
}

// ============================================================================
// ICONS
// ============================================================================

function AllIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

function CreativeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
    </svg>
  );
}

function ProductionIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  );
}

function MediaIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}
