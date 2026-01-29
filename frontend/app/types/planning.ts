// ModCon Planning Tool - Core Types
// Aligned with the 5 Planning Artifacts approach

// ============================================================================
// ROLE LENSES
// ============================================================================

export type RoleLens = 'all' | 'creative' | 'production' | 'media';

export type RoleLensConfig = {
  id: RoleLens;
  label: string;
  description: string;
  emphasizedFields: string[];
  warnings: string[];
};

export const ROLE_LENS_CONFIGS: Record<RoleLens, RoleLensConfig> = {
  all: {
    id: 'all',
    label: 'All',
    description: 'Complete planning view for all stakeholders',
    emphasizedFields: [],
    warnings: [],
  },
  creative: {
    id: 'creative',
    label: 'Creative',
    description: 'Narrative, message themes, and creative variants',
    emphasizedFields: [
      'narrative_brief',
      'single_minded_proposition',
      'message_themes',
      'visual_direction',
      'tone_guardrails',
      'creative_variants',
    ],
    warnings: ['High variant count may strain creative resources'],
  },
  production: {
    id: 'production',
    label: 'Production',
    description: 'Volume, formats, reuse opportunities, and complexity',
    emphasizedFields: [
      'asset_count',
      'format_requirements',
      'reuse_opportunities',
      'complexity_score',
      'module_types',
      'production_timeline',
    ],
    warnings: ['Production impact exceeds typical capacity'],
  },
  media: {
    id: 'media',
    label: 'Media',
    description: 'Placements, formats, flighting, and targeting',
    emphasizedFields: [
      'placements',
      'platform_environments',
      'flighting_assumptions',
      'rotation_strategy',
      'audience_targeting',
      'format_requirements',
    ],
    warnings: ['Format requirements exceed platform support'],
  },
};

// ============================================================================
// ARTIFACT 1: ACTIVATION BRIEF (Strategic Truth)
// ============================================================================

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type BriefField = {
  key: string;
  label: string;
  value: string;
  required: boolean;
  multiline?: boolean;
  confidenceLevel?: ConfidenceLevel;
  aiWarning?: string;
};

export type ActivationBrief = {
  // Core Strategic Fields
  campaign_name: string;
  objective: string;
  kpi: string;
  primary_audience: string;
  secondary_audiences: string[];
  single_minded_proposition: string;
  success_definition: string;
  known_constraints: string[];
  
  // Narrative Brief (rich text)
  narrative_brief: string;
  
  // Brand System
  brand_voice_summary?: string;
  brand_visual_guidelines?: string;
  
  // Flight Dates
  flight_start?: string;
  flight_end?: string;
  
  // Dynamic fields
  custom_fields: Record<string, string>;
  
  // Metadata
  confidence_score: number; // 0-100
  completion_score: number; // 0-100
  last_updated: string;
  version: number;
};

// ============================================================================
// ARTIFACT 2: AUDIENCE & SIGNAL MAP
// ============================================================================

export type AudienceCard = {
  id: string;
  segment_name: string;
  segment_id: string;
  segment_source: string;
  segment_size: string;
  priority_level: 'tier1' | 'tier2' | 'tier3';
  
  // Who they are
  description: string;
  
  // Why they matter
  key_insight: string;
  current_perception: string;
  desired_perception: string;
  
  // How they differ
  differentiators: string[];
  
  // Signals for media
  behavioral_signals: string[];
  contextual_triggers: string[];
  platform_affinities: string[];
  
  // Notes
  notes?: string;
};

export type AudienceSignalMap = {
  audiences: AudienceCard[];
  total_reach_estimate: string;
  overlap_warnings: string[];
};

// ============================================================================
// ARTIFACT 3: CONTENT SCOPE MATRIX (Heart of ModCon)
// ============================================================================

export type MatrixCell = {
  id: string;
  audience_id: string;
  funnel_stage: 'awareness' | 'consideration' | 'conversion' | 'retention';
  message_theme: string;
  format: string;
  placement: string;
  planned_variants: number;
  
  // Auto-calculated
  production_units: number;
  reuse_group?: string;
  
  // Status
  status: 'planned' | 'in_production' | 'complete';
  notes?: string;
};

export type ContentScopeMatrix = {
  cells: MatrixCell[];
  
  // Summary metrics (auto-calculated)
  total_unique_modules: number;
  total_variants: number;
  reuse_opportunities: number;
  
  // Warnings
  warnings: MatrixWarning[];
};

export type MatrixWarning = {
  type: 'high_volume' | 'low_reuse' | 'format_mismatch' | 'missing_coverage';
  message: string;
  severity: 'info' | 'warning' | 'error';
  affectedCells: string[];
};

// ============================================================================
// ARTIFACT 4: PRODUCTION PLAN
// ============================================================================

export type ModuleType = 'hook' | 'cta' | 'proof' | 'visual' | 'audio' | 'text';

export type ProductionModule = {
  id: string;
  type: ModuleType;
  name: string;
  description: string;
  source_type: 'new_shoot' | 'existing_asset' | 'ugc' | 'stock' | 'generated';
  complexity: 'simple' | 'moderate' | 'heavy';
  estimated_variants: number;
  reuse_count: number;
};

export type ProductionPlan = {
  // Module breakdown
  modules: ProductionModule[];
  
  // Summary
  total_modules: number;
  total_assets: number;
  
  // Complexity assessment
  complexity_score: 'simple' | 'moderate' | 'heavy';
  complexity_factors: string[];
  
  // Reuse analysis
  reuse_summary: {
    reusable_modules: number;
    unique_modules: number;
    reuse_percentage: number;
  };
  
  // Resource estimates
  estimated_production_days?: number;
  
  // Warnings
  capacity_warnings: string[];
};

// ============================================================================
// ARTIFACT 5: MEDIA ALIGNMENT PLAN
// ============================================================================

export type PlacementSpec = {
  id: string;
  platform: string;
  placement: string;
  format: string;
  dimensions: string;
  duration?: string;
  
  // Flighting
  flight_start?: string;
  flight_end?: string;
  
  // Rotation
  rotation_strategy: 'static' | 'modular' | 'sequential' | 'dynamic';
  
  // Notes
  special_requirements?: string;
};

export type MediaAlignmentPlan = {
  // Planned placements
  placements: PlacementSpec[];
  
  // Format requirements summary
  format_requirements: {
    format: string;
    count: number;
    platforms: string[];
  }[];
  
  // Flighting assumptions
  flighting_summary: string;
  
  // Rotation expectations
  rotation_strategy: 'static' | 'modular' | 'sequential' | 'mixed';
  rotation_rationale: string;
  
  // Platform breakdown
  platform_breakdown: {
    platform: string;
    placements: number;
    formats: string[];
  }[];
};

// ============================================================================
// ALIGNMENT CHECKPOINTS
// ============================================================================

export type AlignmentStatus = 'pending' | 'approved' | 'revision_requested';

export type AlignmentCheckpoint = {
  id: string;
  role: 'creative' | 'production' | 'media';
  artifact: 'brief' | 'audience_map' | 'content_matrix' | 'production_plan' | 'media_plan';
  status: AlignmentStatus;
  approver_name?: string;
  approved_at?: string;
  comment?: string;
  version_approved: number;
};

export type AlignmentState = {
  checkpoints: AlignmentCheckpoint[];
  is_plan_locked: boolean;
  last_revision_at?: string;
};

// ============================================================================
// PLANNING PACKAGES (Export)
// ============================================================================

export type PlanningPackageType = 
  | 'creative_planning_pack'
  | 'production_scope_pack'
  | 'media_activation_pack'
  | 'full_modcon_plan';

export type PlanningPackage = {
  type: PlanningPackageType;
  name: string;
  description: string;
  included_artifacts: string[];
  generated_at: string;
  version: number;
  owner?: string;
};

// ============================================================================
// COMPLETE PLANNING STATE
// ============================================================================

export type PlanningState = {
  // The 5 Artifacts
  activationBrief: ActivationBrief;
  audienceMap: AudienceSignalMap;
  contentMatrix: ContentScopeMatrix;
  productionPlan: ProductionPlan;
  mediaAlignmentPlan: MediaAlignmentPlan;
  
  // Alignment
  alignment: AlignmentState;
  
  // Meta
  campaign_id: string;
  created_at: string;
  updated_at: string;
  version: number;
};

// ============================================================================
// WORKFLOW STAGES
// ============================================================================

export type WorkflowStage = 
  | 'brief'
  | 'audiences'
  | 'content_matrix'
  | 'production'
  | 'media';

export type WorkflowStageConfig = {
  id: WorkflowStage;
  label: string;
  artifact: string;
  description: string;
  requiredForNext: boolean;
};

export const WORKFLOW_STAGES: WorkflowStageConfig[] = [
  {
    id: 'brief',
    label: 'Activation Brief',
    artifact: 'activationBrief',
    description: 'Define strategic objectives, audiences, and proposition',
    requiredForNext: true,
  },
  {
    id: 'audiences',
    label: 'Audience Map',
    artifact: 'audienceMap',
    description: 'Map audiences with signals and targeting assumptions',
    requiredForNext: true,
  },
  {
    id: 'content_matrix',
    label: 'Content Scope',
    artifact: 'contentMatrix',
    description: 'Define content matrix with variants and placements',
    requiredForNext: true,
  },
  {
    id: 'production',
    label: 'Production Plan',
    artifact: 'productionPlan',
    description: 'Assess production feasibility and module breakdown',
    requiredForNext: false,
  },
  {
    id: 'media',
    label: 'Media Alignment',
    artifact: 'mediaAlignmentPlan',
    description: 'Align media placements and flighting assumptions',
    requiredForNext: false,
  },
];
