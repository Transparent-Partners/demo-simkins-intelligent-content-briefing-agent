import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  ActivationBrief,
  AudienceSignalMap,
  AudienceCard,
  ContentScopeMatrix,
  MatrixCell,
  ProductionPlan,
  MediaAlignmentPlan,
  AlignmentState,
  AlignmentCheckpoint,
  AlignmentStatus,
  MatrixWarning,
} from '../types/planning';

// ============================================================================
// INITIAL STATE FACTORIES
// ============================================================================

const createInitialBrief = (): ActivationBrief => ({
  campaign_name: '',
  objective: '',
  kpi: '',
  primary_audience: '',
  secondary_audiences: [],
  single_minded_proposition: '',
  success_definition: '',
  known_constraints: [],
  narrative_brief: '',
  custom_fields: {},
  confidence_score: 0,
  completion_score: 0,
  last_updated: new Date().toISOString(),
  version: 1,
});

const createInitialAudienceMap = (): AudienceSignalMap => ({
  audiences: [],
  total_reach_estimate: '',
  overlap_warnings: [],
});

const createInitialContentMatrix = (): ContentScopeMatrix => ({
  cells: [],
  total_unique_modules: 0,
  total_variants: 0,
  reuse_opportunities: 0,
  warnings: [],
});

const createInitialProductionPlan = (): ProductionPlan => ({
  modules: [],
  total_modules: 0,
  total_assets: 0,
  complexity_score: 'simple',
  complexity_factors: [],
  reuse_summary: {
    reusable_modules: 0,
    unique_modules: 0,
    reuse_percentage: 0,
  },
  capacity_warnings: [],
});

const createInitialMediaPlan = (): MediaAlignmentPlan => ({
  placements: [],
  format_requirements: [],
  flighting_summary: '',
  rotation_strategy: 'static',
  rotation_rationale: '',
  platform_breakdown: [],
});

const createInitialAlignment = (): AlignmentState => ({
  checkpoints: [],
  is_plan_locked: false,
});

// ============================================================================
// STORE TYPES
// ============================================================================

interface PlanningStore {
  // State
  activationBrief: ActivationBrief;
  audienceMap: AudienceSignalMap;
  contentMatrix: ContentScopeMatrix;
  productionPlan: ProductionPlan;
  mediaAlignmentPlan: MediaAlignmentPlan;
  alignment: AlignmentState;
  
  // Meta
  campaignId: string;
  isDirty: boolean;
  lastSaved: string | null;
  
  // Brief Actions
  updateBrief: (updates: Partial<ActivationBrief>) => void;
  setBriefField: (key: string, value: string) => void;
  calculateBriefConfidence: () => void;
  
  // Audience Actions
  addAudience: (audience: AudienceCard) => void;
  updateAudience: (id: string, updates: Partial<AudienceCard>) => void;
  removeAudience: (id: string) => void;
  reorderAudiences: (audienceIds: string[]) => void;
  
  // Content Matrix Actions
  addMatrixCell: (cell: MatrixCell) => void;
  updateMatrixCell: (id: string, updates: Partial<MatrixCell>) => void;
  removeMatrixCell: (id: string) => void;
  updateVariantCount: (id: string, count: number) => void;
  recalculateMatrixMetrics: () => void;
  
  // Production Plan Actions
  updateProductionPlan: (updates: Partial<ProductionPlan>) => void;
  recalculateProductionImpact: () => void;
  
  // Media Plan Actions
  updateMediaPlan: (updates: Partial<MediaAlignmentPlan>) => void;
  addPlacement: (placement: MediaAlignmentPlan['placements'][0]) => void;
  removePlacement: (id: string) => void;
  
  // Alignment Actions
  updateCheckpoint: (
    role: AlignmentCheckpoint['role'],
    artifact: AlignmentCheckpoint['artifact'],
    status: AlignmentStatus,
    comment?: string
  ) => void;
  lockPlan: () => void;
  unlockPlan: () => void;
  
  // Utility Actions
  resetPlan: () => void;
  importPlan: (plan: Partial<PlanningStore>) => void;
  markSaved: () => void;
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const usePlanningStore = create<PlanningStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial State
        activationBrief: createInitialBrief(),
        audienceMap: createInitialAudienceMap(),
        contentMatrix: createInitialContentMatrix(),
        productionPlan: createInitialProductionPlan(),
        mediaAlignmentPlan: createInitialMediaPlan(),
        alignment: createInitialAlignment(),
        campaignId: '',
        isDirty: false,
        lastSaved: null,

        // ========================================================================
        // BRIEF ACTIONS
        // ========================================================================
        
        updateBrief: (updates) => set((state) => ({
          activationBrief: {
            ...state.activationBrief,
            ...updates,
            last_updated: new Date().toISOString(),
            version: state.activationBrief.version + 1,
          },
          isDirty: true,
        })),

        setBriefField: (key, value) => set((state) => {
          const brief = { ...state.activationBrief };
          if (key in brief) {
            (brief as any)[key] = value;
          } else {
            brief.custom_fields = { ...brief.custom_fields, [key]: value };
          }
          brief.last_updated = new Date().toISOString();
          return { activationBrief: brief, isDirty: true };
        }),

        calculateBriefConfidence: () => set((state) => {
          const brief = state.activationBrief;
          const requiredFields = [
            'campaign_name',
            'objective',
            'kpi',
            'primary_audience',
            'single_minded_proposition',
          ];
          
          const filledRequired = requiredFields.filter(
            (f) => (brief as any)[f] && (brief as any)[f].trim() !== ''
          ).length;
          
          const completion_score = Math.round((filledRequired / requiredFields.length) * 100);
          
          // Confidence is completion + quality heuristics
          let confidence_score = completion_score;
          
          // Penalize vague objectives
          if (brief.objective && /awareness|engagement/i.test(brief.objective) && !brief.kpi) {
            confidence_score = Math.max(0, confidence_score - 20);
          }
          
          // Boost if SMP is specific (has numbers, specifics)
          if (brief.single_minded_proposition && brief.single_minded_proposition.length > 50) {
            confidence_score = Math.min(100, confidence_score + 10);
          }
          
          return {
            activationBrief: {
              ...state.activationBrief,
              completion_score,
              confidence_score,
            },
          };
        }),

        // ========================================================================
        // AUDIENCE ACTIONS
        // ========================================================================
        
        addAudience: (audience) => set((state) => ({
          audienceMap: {
            ...state.audienceMap,
            audiences: [...state.audienceMap.audiences, audience],
          },
          isDirty: true,
        })),

        updateAudience: (id, updates) => set((state) => ({
          audienceMap: {
            ...state.audienceMap,
            audiences: state.audienceMap.audiences.map((a) =>
              a.id === id ? { ...a, ...updates } : a
            ),
          },
          isDirty: true,
        })),

        removeAudience: (id) => set((state) => ({
          audienceMap: {
            ...state.audienceMap,
            audiences: state.audienceMap.audiences.filter((a) => a.id !== id),
          },
          isDirty: true,
        })),

        reorderAudiences: (audienceIds) => set((state) => {
          const audienceMap = new Map(state.audienceMap.audiences.map((a) => [a.id, a]));
          const reordered = audienceIds
            .map((id) => audienceMap.get(id))
            .filter(Boolean) as AudienceCard[];
          return {
            audienceMap: {
              ...state.audienceMap,
              audiences: reordered,
            },
            isDirty: true,
          };
        }),

        // ========================================================================
        // CONTENT MATRIX ACTIONS
        // ========================================================================
        
        addMatrixCell: (cell) => set((state) => {
          const newCells = [...state.contentMatrix.cells, cell];
          return {
            contentMatrix: {
              ...state.contentMatrix,
              cells: newCells,
            },
            isDirty: true,
          };
        }),

        updateMatrixCell: (id, updates) => set((state) => ({
          contentMatrix: {
            ...state.contentMatrix,
            cells: state.contentMatrix.cells.map((c) =>
              c.id === id ? { ...c, ...updates } : c
            ),
          },
          isDirty: true,
        })),

        removeMatrixCell: (id) => set((state) => ({
          contentMatrix: {
            ...state.contentMatrix,
            cells: state.contentMatrix.cells.filter((c) => c.id !== id),
          },
          isDirty: true,
        })),

        updateVariantCount: (id, count) => set((state) => ({
          contentMatrix: {
            ...state.contentMatrix,
            cells: state.contentMatrix.cells.map((c) =>
              c.id === id
                ? { ...c, planned_variants: count, production_units: count }
                : c
            ),
          },
          isDirty: true,
        })),

        recalculateMatrixMetrics: () => set((state) => {
          const cells = state.contentMatrix.cells;
          
          // Calculate totals
          const total_variants = cells.reduce((sum, c) => sum + c.planned_variants, 0);
          
          // Find reuse opportunities (same format + message_theme)
          const reuseGroups = new Map<string, string[]>();
          cells.forEach((c) => {
            const key = `${c.format}::${c.message_theme}`;
            const existing = reuseGroups.get(key) || [];
            existing.push(c.id);
            reuseGroups.set(key, existing);
          });
          
          const reuse_opportunities = Array.from(reuseGroups.values())
            .filter((group) => group.length > 1)
            .reduce((sum, group) => sum + group.length - 1, 0);
          
          const total_unique_modules = cells.length - reuse_opportunities;
          
          // Generate warnings
          const warnings: MatrixWarning[] = [];
          
          if (total_variants > 48) {
            warnings.push({
              type: 'high_volume',
              message: `This plan requires ${total_variants} unique modules`,
              severity: 'warning',
              affectedCells: [],
            });
          }
          
          if (reuse_opportunities > 0) {
            warnings.push({
              type: 'low_reuse',
              message: `High reuse opportunity across ${reuse_opportunities + 1} placements`,
              severity: 'info',
              affectedCells: [],
            });
          }
          
          return {
            contentMatrix: {
              ...state.contentMatrix,
              total_unique_modules,
              total_variants,
              reuse_opportunities,
              warnings,
            },
          };
        }),

        // ========================================================================
        // PRODUCTION PLAN ACTIONS
        // ========================================================================
        
        updateProductionPlan: (updates) => set((state) => ({
          productionPlan: {
            ...state.productionPlan,
            ...updates,
          },
          isDirty: true,
        })),

        recalculateProductionImpact: () => set((state) => {
          const matrix = state.contentMatrix;
          const total_assets = matrix.total_variants;
          const total_modules = matrix.total_unique_modules;
          
          // Determine complexity
          let complexity_score: ProductionPlan['complexity_score'] = 'simple';
          const complexity_factors: string[] = [];
          
          if (total_assets > 50) {
            complexity_score = 'heavy';
            complexity_factors.push('High asset volume (50+)');
          } else if (total_assets > 20) {
            complexity_score = 'moderate';
            complexity_factors.push('Moderate asset volume (20-50)');
          }
          
          // Check format diversity
          const formats = new Set(matrix.cells.map((c) => c.format));
          if (formats.size > 5) {
            complexity_score = 'heavy';
            complexity_factors.push('High format diversity (5+ formats)');
          }
          
          // Calculate reuse
          const reuse_percentage = total_modules > 0
            ? Math.round((matrix.reuse_opportunities / total_modules) * 100)
            : 0;
          
          // Capacity warnings
          const capacity_warnings: string[] = [];
          if (total_assets > 100) {
            capacity_warnings.push('Production volume exceeds typical sprint capacity');
          }
          
          return {
            productionPlan: {
              ...state.productionPlan,
              total_modules,
              total_assets,
              complexity_score,
              complexity_factors,
              reuse_summary: {
                reusable_modules: matrix.reuse_opportunities,
                unique_modules: total_modules,
                reuse_percentage,
              },
              capacity_warnings,
            },
          };
        }),

        // ========================================================================
        // MEDIA PLAN ACTIONS
        // ========================================================================
        
        updateMediaPlan: (updates) => set((state) => ({
          mediaAlignmentPlan: {
            ...state.mediaAlignmentPlan,
            ...updates,
          },
          isDirty: true,
        })),

        addPlacement: (placement) => set((state) => ({
          mediaAlignmentPlan: {
            ...state.mediaAlignmentPlan,
            placements: [...state.mediaAlignmentPlan.placements, placement],
          },
          isDirty: true,
        })),

        removePlacement: (id) => set((state) => ({
          mediaAlignmentPlan: {
            ...state.mediaAlignmentPlan,
            placements: state.mediaAlignmentPlan.placements.filter((p) => p.id !== id),
          },
          isDirty: true,
        })),

        // ========================================================================
        // ALIGNMENT ACTIONS
        // ========================================================================
        
        updateCheckpoint: (role, artifact, status, comment) => set((state) => {
          const checkpointId = `${role}-${artifact}`;
          const existing = state.alignment.checkpoints.find((c) => c.id === checkpointId);
          
          const checkpoint: AlignmentCheckpoint = {
            id: checkpointId,
            role,
            artifact,
            status,
            comment,
            approved_at: status === 'approved' ? new Date().toISOString() : undefined,
            version_approved: state.activationBrief.version,
          };
          
          const checkpoints = existing
            ? state.alignment.checkpoints.map((c) =>
                c.id === checkpointId ? checkpoint : c
              )
            : [...state.alignment.checkpoints, checkpoint];
          
          return {
            alignment: {
              ...state.alignment,
              checkpoints,
            },
            isDirty: true,
          };
        }),

        lockPlan: () => set((state) => ({
          alignment: {
            ...state.alignment,
            is_plan_locked: true,
          },
        })),

        unlockPlan: () => set((state) => ({
          alignment: {
            ...state.alignment,
            is_plan_locked: false,
            last_revision_at: new Date().toISOString(),
          },
        })),

        // ========================================================================
        // UTILITY ACTIONS
        // ========================================================================
        
        resetPlan: () => set({
          activationBrief: createInitialBrief(),
          audienceMap: createInitialAudienceMap(),
          contentMatrix: createInitialContentMatrix(),
          productionPlan: createInitialProductionPlan(),
          mediaAlignmentPlan: createInitialMediaPlan(),
          alignment: createInitialAlignment(),
          campaignId: '',
          isDirty: false,
          lastSaved: null,
        }),

        importPlan: (plan) => set((state) => ({
          ...state,
          ...plan,
          isDirty: true,
        })),

        markSaved: () => set({
          isDirty: false,
          lastSaved: new Date().toISOString(),
        }),
      }),
      {
        name: 'modcon-planning-store',
        partialize: (state) => ({
          activationBrief: state.activationBrief,
          audienceMap: state.audienceMap,
          contentMatrix: state.contentMatrix,
          productionPlan: state.productionPlan,
          mediaAlignmentPlan: state.mediaAlignmentPlan,
          alignment: state.alignment,
          campaignId: state.campaignId,
        }),
      }
    ),
    { name: 'PlanningStore' }
  )
);
