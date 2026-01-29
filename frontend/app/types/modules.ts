// ============================================================================
// MODULE SYSTEM TYPES
// For production handoff to DCO/automation platforms
// (Flashtalking, Innovid, Clinch, Celtra, Storyteq, etc.)
// ============================================================================

// ============================================================================
// MODULE TAXONOMY
// ============================================================================

export type ModuleType = 
  | 'hook'          // Opening attention-grabber (first 3 seconds)
  | 'value_prop'    // Core value proposition
  | 'proof_point'   // Social proof, testimonials, data points
  | 'product'       // Product shot, demo, feature highlight
  | 'offer'         // Promotional offer, pricing
  | 'cta'           // Call to action (button, end card)
  | 'background'    // Visual background, texture, environment
  | 'logo'          // Brand logo treatment
  | 'legal'         // Disclaimers, terms, fine print
  | 'audio'         // Voiceover, music, SFX
  | 'end_card'      // Closing frame, brand lockup
  | 'transition';   // Motion between modules

export const MODULE_TYPE_CONFIG: Record<ModuleType, {
  label: string;
  description: string;
  color: string;
  icon: string;
  typical_duration?: string;
  common_variations: string[];
}> = {
  hook: {
    label: 'Hook',
    description: 'Opening attention-grabber in first 3 seconds',
    color: 'purple',
    icon: '🎯',
    typical_duration: '2-3s',
    common_variations: ['Emotional', 'Question', 'Statistic', 'Problem', 'Bold claim'],
  },
  value_prop: {
    label: 'Value Proposition',
    description: 'Core benefit or differentiator',
    color: 'blue',
    icon: '💎',
    common_variations: ['Functional', 'Emotional', 'Social', 'Financial'],
  },
  proof_point: {
    label: 'Proof Point',
    description: 'Evidence, testimonials, or social proof',
    color: 'green',
    icon: '✓',
    common_variations: ['Testimonial', 'Statistic', 'Award', 'Review', 'Case study'],
  },
  product: {
    label: 'Product',
    description: 'Product visualization or demonstration',
    color: 'orange',
    icon: '📦',
    common_variations: ['Hero shot', 'In-use', 'Detail', 'Comparison', 'Unboxing'],
  },
  offer: {
    label: 'Offer',
    description: 'Promotional offer, pricing, or incentive',
    color: 'red',
    icon: '🏷️',
    common_variations: ['Discount', 'Bundle', 'Free trial', 'Limited time', 'Exclusive'],
  },
  cta: {
    label: 'CTA',
    description: 'Call to action driving next step',
    color: 'pink',
    icon: '👆',
    common_variations: ['Shop now', 'Learn more', 'Sign up', 'Get started', 'Book now'],
  },
  background: {
    label: 'Background',
    description: 'Visual backdrop or environment',
    color: 'slate',
    icon: '🖼️',
    common_variations: ['Solid', 'Gradient', 'Lifestyle', 'Abstract', 'Brand pattern'],
  },
  logo: {
    label: 'Logo',
    description: 'Brand logo treatment',
    color: 'slate',
    icon: '®',
    common_variations: ['Primary', 'Reversed', 'Stacked', 'Horizontal', 'Animated'],
  },
  legal: {
    label: 'Legal',
    description: 'Disclaimers and compliance text',
    color: 'slate',
    icon: '⚖️',
    common_variations: ['Standard', 'Industry-specific', 'Promotional', 'Financial'],
  },
  audio: {
    label: 'Audio',
    description: 'Voiceover, music, or sound effects',
    color: 'cyan',
    icon: '🔊',
    common_variations: ['Voiceover', 'Music bed', 'SFX', 'Sonic logo'],
  },
  end_card: {
    label: 'End Card',
    description: 'Closing frame with brand lockup',
    color: 'indigo',
    icon: '🎬',
    typical_duration: '2-3s',
    common_variations: ['Standard', 'With offer', 'With CTA', 'Animated'],
  },
  transition: {
    label: 'Transition',
    description: 'Motion between content modules',
    color: 'violet',
    icon: '↔️',
    typical_duration: '0.5-1s',
    common_variations: ['Cut', 'Fade', 'Wipe', 'Zoom', 'Slide'],
  },
};

// ============================================================================
// MODULE DEFINITION
// ============================================================================

export type ModuleFormat = 'text' | 'image' | 'video' | 'audio' | 'html5' | 'lottie';
export type SourceType = 'new_shoot' | 'existing_asset' | 'ugc' | 'stock' | 'ai_generated' | 'template';

export interface ModuleVariation {
  id: string;
  name: string;
  description?: string;
  
  // Targeting (optional - what triggers this variation)
  audience_id?: string;
  funnel_stage?: 'awareness' | 'consideration' | 'conversion' | 'retention';
  trigger?: string;
  
  // Content preview
  content_preview?: string;        // Text or description
  asset_url?: string;              // Preview image/video URL
  
  // Status
  status: 'planned' | 'in_production' | 'in_review' | 'approved' | 'live';
}

export interface Module {
  id: string;
  type: ModuleType;
  name: string;
  description: string;
  
  // Variations
  variations: ModuleVariation[];
  
  // Technical specifications
  format: ModuleFormat;
  specs: {
    dimensions?: string;           // e.g., "1080x1920"
    duration?: string;             // e.g., "3s"
    character_limit?: number;      // For text modules
    file_size_limit?: string;      // e.g., "2MB"
    frame_rate?: number;           // For video
    audio_specs?: string;          // e.g., "44.1kHz stereo"
  };
  
  // Source and reuse
  source_type: SourceType;
  dam_reference?: string;          // Link to DAM asset
  reuse_count: number;             // How many cells use this module
  used_in_cells: string[];         // Content matrix cell IDs
  
  // Metadata
  created_at: string;
  updated_at: string;
  owner?: string;
  notes?: string;
}

// ============================================================================
// DECISIONING LOGIC
// ============================================================================

export type ConditionType = 'audience' | 'funnel_stage' | 'trigger' | 'platform' | 'placement' | 'daypart' | 'geo' | 'weather' | 'custom';
export type Operator = 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'in' | 'not_in' | 'greater_than' | 'less_than';

export interface DecisionCondition {
  type: ConditionType;
  field?: string;                  // For custom conditions
  operator: Operator;
  value: string | string[] | number;
}

export interface DecisionRule {
  id: string;
  name: string;
  description?: string;
  priority: number;                // Evaluation order (lower = higher priority)
  
  // Condition (when to apply this rule)
  conditions: DecisionCondition[];
  condition_logic: 'AND' | 'OR';   // How to combine multiple conditions
  
  // Action (what to show)
  action: {
    module_type: ModuleType;
    module_id: string;
    variation_id: string;
  };
  
  // Status
  is_active: boolean;
}

export interface DecisioningLogic {
  rules: DecisionRule[];
  
  // Default path (fallback when no rules match)
  defaults: {
    [key in ModuleType]?: {
      module_id: string;
      variation_id: string;
    };
  };
  
  // Validation
  has_orphan_rules: boolean;
  coverage_percentage: number;     // % of matrix cells covered by rules
}

// ============================================================================
// PLATFORM COMPATIBILITY
// ============================================================================

export type PlatformId = 
  | 'flashtalking'
  | 'innovid'
  | 'clinch'
  | 'celtra'
  | 'storyteq'
  | 'google_studio'
  | 'sizmek'
  | 'jivox'
  | 'adform'
  | 'mediamath_creative';

export interface PlatformCapabilities {
  id: PlatformId;
  name: string;
  
  // Supported formats
  supports_display: boolean;
  supports_video: boolean;
  supports_interactive: boolean;
  supports_ctv: boolean;
  supports_audio: boolean;
  supports_social: boolean;
  
  // Capabilities
  real_time_decisioning: boolean;
  sequential_messaging: boolean;
  ab_testing: boolean;
  feed_based_versioning: boolean;
  dynamic_text: boolean;
  dynamic_images: boolean;
  dynamic_video: boolean;
  
  // Constraints
  max_creative_weight?: string;    // e.g., "200KB"
  max_video_length?: string;       // e.g., "60s"
  max_feed_rows?: number;
  max_variations_per_asset?: number;
  
  // Integration
  has_api: boolean;
  feed_format: 'csv' | 'json' | 'xml' | 'api_only';
}

export const PLATFORM_LIBRARY: PlatformCapabilities[] = [
  {
    id: 'flashtalking',
    name: 'Flashtalking',
    supports_display: true,
    supports_video: true,
    supports_interactive: true,
    supports_ctv: true,
    supports_audio: false,
    supports_social: true,
    real_time_decisioning: true,
    sequential_messaging: true,
    ab_testing: true,
    feed_based_versioning: true,
    dynamic_text: true,
    dynamic_images: true,
    dynamic_video: true,
    max_creative_weight: '200KB',
    max_video_length: '120s',
    has_api: true,
    feed_format: 'csv',
  },
  {
    id: 'innovid',
    name: 'Innovid',
    supports_display: true,
    supports_video: true,
    supports_interactive: true,
    supports_ctv: true,
    supports_audio: true,
    supports_social: false,
    real_time_decisioning: true,
    sequential_messaging: true,
    ab_testing: true,
    feed_based_versioning: true,
    dynamic_text: true,
    dynamic_images: true,
    dynamic_video: true,
    max_video_length: '60s',
    has_api: true,
    feed_format: 'json',
  },
  {
    id: 'clinch',
    name: 'Clinch',
    supports_display: true,
    supports_video: true,
    supports_interactive: true,
    supports_ctv: true,
    supports_audio: false,
    supports_social: true,
    real_time_decisioning: true,
    sequential_messaging: true,
    ab_testing: true,
    feed_based_versioning: true,
    dynamic_text: true,
    dynamic_images: true,
    dynamic_video: true,
    has_api: true,
    feed_format: 'csv',
  },
  {
    id: 'celtra',
    name: 'Celtra',
    supports_display: true,
    supports_video: true,
    supports_interactive: true,
    supports_ctv: true,
    supports_audio: false,
    supports_social: true,
    real_time_decisioning: true,
    sequential_messaging: true,
    ab_testing: true,
    feed_based_versioning: true,
    dynamic_text: true,
    dynamic_images: true,
    dynamic_video: true,
    max_creative_weight: '300KB',
    has_api: true,
    feed_format: 'json',
  },
  {
    id: 'storyteq',
    name: 'Storyteq',
    supports_display: true,
    supports_video: true,
    supports_interactive: false,
    supports_ctv: true,
    supports_audio: true,
    supports_social: true,
    real_time_decisioning: false,
    sequential_messaging: true,
    ab_testing: true,
    feed_based_versioning: true,
    dynamic_text: true,
    dynamic_images: true,
    dynamic_video: true,
    has_api: true,
    feed_format: 'csv',
  },
];

// ============================================================================
// PRODUCTION TICKET
// ============================================================================

export type TicketPriority = 'critical' | 'high' | 'medium' | 'low';
export type TicketStatus = 'backlog' | 'ready' | 'in_progress' | 'in_review' | 'approved' | 'delivered';

export interface ProductionTicket {
  id: string;
  ticket_number: string;           // e.g., "PROD-2026-001"
  
  // What to build
  module_id: string;
  module_type: ModuleType;
  module_name: string;
  variations_to_create: string[];  // Variation IDs
  
  // Context
  campaign_id: string;
  campaign_name: string;
  audience_context: string[];
  placement_context: string[];
  
  // Output specifications
  output_specs: {
    format: string;
    dimensions: string;
    file_type: string;
    color_space?: string;
    max_file_size?: string;
  }[];
  
  // Priority and timeline
  priority: TicketPriority;
  due_date?: string;
  estimated_hours?: number;
  
  // Workflow
  status: TicketStatus;
  assignee?: string;
  reviewer?: string;
  
  // Downstream destination
  destination_platform?: PlatformId;
  feed_column_mapping?: {
    column_name: string;
    maps_to: 'variation_id' | 'asset_url' | 'text_content' | 'custom';
    custom_source?: string;
  }[];
  
  // Metadata
  created_at: string;
  updated_at: string;
  created_by?: string;
  notes?: string;
}

// ============================================================================
// FEED STRUCTURE
// ============================================================================

export interface FeedColumn {
  id: string;
  name: string;
  display_name: string;
  type: 'text' | 'url' | 'number' | 'date' | 'boolean';
  is_required: boolean;
  is_dynamic: boolean;              // Does this vary per row?
  source: 'module' | 'audience' | 'placement' | 'rule' | 'static' | 'formula';
  source_reference?: string;        // Module ID, audience field, etc.
  default_value?: string;
  validation_pattern?: string;
}

export interface FeedStructure {
  id: string;
  name: string;
  target_platform: PlatformId;
  
  columns: FeedColumn[];
  
  // Row generation rules
  row_per: 'audience' | 'placement' | 'audience_x_placement' | 'cell';
  include_defaults: boolean;
  
  // Validation
  estimated_row_count: number;
  validation_errors: string[];
}

// ============================================================================
// MODULE LIBRARY STATE
// ============================================================================

export interface ModuleLibraryState {
  modules: Module[];
  decisioning: DecisioningLogic;
  target_platforms: PlatformId[];
  feed_structures: FeedStructure[];
  production_tickets: ProductionTicket[];
}
