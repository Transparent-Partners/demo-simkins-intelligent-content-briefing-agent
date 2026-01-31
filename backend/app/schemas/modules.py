"""
Module Library Schemas
For ModCon production automation and DCO platform handoff
"""
from __future__ import annotations

from typing import List, Optional, Dict, Any, Literal
from enum import Enum
from pydantic import BaseModel, Field


# ============================================================================
# MODULE TAXONOMY
# ============================================================================

class ModuleType(str, Enum):
    HOOK = "hook"
    VALUE_PROP = "value_prop"
    PROOF_POINT = "proof_point"
    PRODUCT = "product"
    OFFER = "offer"
    CTA = "cta"
    BACKGROUND = "background"
    LOGO = "logo"
    LEGAL = "legal"
    AUDIO = "audio"
    END_CARD = "end_card"
    TRANSITION = "transition"


class ModuleFormat(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    HTML5 = "html5"
    LOTTIE = "lottie"


class SourceType(str, Enum):
    NEW_SHOOT = "new_shoot"
    EXISTING_ASSET = "existing_asset"
    UGC = "ugc"
    STOCK = "stock"
    AI_GENERATED = "ai_generated"
    TEMPLATE = "template"


class FunnelStage(str, Enum):
    AWARENESS = "awareness"
    CONSIDERATION = "consideration"
    CONVERSION = "conversion"
    RETENTION = "retention"


class VariationStatus(str, Enum):
    PLANNED = "planned"
    IN_PRODUCTION = "in_production"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    LIVE = "live"


# ============================================================================
# MODULE VARIATION
# ============================================================================

class ModuleVariation(BaseModel):
    """A single variation of a module, potentially targeted to specific audiences."""
    
    id: str
    name: str
    description: Optional[str] = None
    
    # Targeting
    audience_ids: List[str] = Field(default_factory=list)
    funnel_stage: Optional[FunnelStage] = None
    trigger: Optional[str] = None
    
    # Content
    content_preview: Optional[str] = None
    asset_url: Optional[str] = None
    text_content: Optional[str] = None
    
    # Status
    status: VariationStatus = VariationStatus.PLANNED
    
    # Production linkage
    production_job_id: Optional[str] = None
    feed_row_ids: List[str] = Field(default_factory=list)


# ============================================================================
# MODULE SPECS
# ============================================================================

class ModuleSpecs(BaseModel):
    """Technical specifications for a module."""
    
    dimensions: Optional[str] = None
    duration: Optional[str] = None
    character_limit: Optional[int] = None
    file_size_limit: Optional[str] = None
    frame_rate: Optional[int] = None
    audio_specs: Optional[str] = None


# ============================================================================
# MODULE
# ============================================================================

class Module(BaseModel):
    """A reusable creative module in the library."""
    
    id: str
    type: ModuleType
    name: str
    description: str
    
    # Variations
    variations: List[ModuleVariation] = Field(default_factory=list)
    
    # Technical
    format: ModuleFormat
    specs: ModuleSpecs = Field(default_factory=ModuleSpecs)
    
    # Source and reuse
    source_type: SourceType = SourceType.NEW_SHOOT
    dam_reference: Optional[str] = None
    reuse_count: int = 0
    used_in_cells: List[str] = Field(default_factory=list)
    
    # Metadata
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    owner: Optional[str] = None
    notes: Optional[str] = None


# ============================================================================
# DECISIONING LOGIC
# ============================================================================

class ConditionType(str, Enum):
    AUDIENCE = "audience"
    FUNNEL_STAGE = "funnel_stage"
    TRIGGER = "trigger"
    PLATFORM = "platform"
    PLACEMENT = "placement"
    DAYPART = "daypart"
    GEO = "geo"
    WEATHER = "weather"
    CUSTOM = "custom"


class Operator(str, Enum):
    EQUALS = "equals"
    NOT_EQUALS = "not_equals"
    CONTAINS = "contains"
    NOT_CONTAINS = "not_contains"
    IN = "in"
    NOT_IN = "not_in"
    GREATER_THAN = "greater_than"
    LESS_THAN = "less_than"


class DecisionCondition(BaseModel):
    """A single condition in a decision rule."""
    
    type: ConditionType
    field: Optional[str] = None
    operator: Operator
    value: Any  # string, list, or number


class RuleAction(BaseModel):
    """What to show when a rule matches."""
    
    module_type: ModuleType
    module_id: str
    variation_id: str


class DecisionRule(BaseModel):
    """An IF/THEN rule for DCO decisioning."""
    
    id: str
    name: str
    description: Optional[str] = None
    priority: int = 100
    
    # Condition
    conditions: List[DecisionCondition] = Field(default_factory=list)
    condition_logic: Literal["AND", "OR"] = "AND"
    
    # Action
    action: RuleAction
    
    # Status
    is_active: bool = True


class DecisioningLogic(BaseModel):
    """Complete decisioning logic for a campaign."""
    
    rules: List[DecisionRule] = Field(default_factory=list)
    defaults: Dict[str, Dict[str, str]] = Field(default_factory=dict)
    has_orphan_rules: bool = False
    coverage_percentage: float = 0.0


# ============================================================================
# PLATFORM EXPORT
# ============================================================================

class PlatformId(str, Enum):
    FLASHTALKING = "flashtalking"
    INNOVID = "innovid"
    CLINCH = "clinch"
    CELTRA = "celtra"
    STORYTEQ = "storyteq"
    GOOGLE_STUDIO = "google_studio"
    SIZMEK = "sizmek"
    JIVOX = "jivox"
    ADFORM = "adform"


class FeedFormat(str, Enum):
    CSV = "csv"
    JSON = "json"
    XML = "xml"
    API_ONLY = "api_only"


class PlatformCapabilities(BaseModel):
    """Capabilities of a DCO/production automation platform."""
    
    id: PlatformId
    name: str
    
    # Supported formats
    supports_display: bool = False
    supports_video: bool = False
    supports_interactive: bool = False
    supports_ctv: bool = False
    supports_audio: bool = False
    supports_social: bool = False
    
    # Capabilities
    real_time_decisioning: bool = False
    sequential_messaging: bool = False
    ab_testing: bool = False
    feed_based_versioning: bool = False
    dynamic_text: bool = False
    dynamic_images: bool = False
    dynamic_video: bool = False
    
    # Constraints
    max_creative_weight: Optional[str] = None
    max_video_length: Optional[str] = None
    max_feed_rows: Optional[int] = None
    max_variations_per_asset: Optional[int] = None
    
    # Integration
    has_api: bool = False
    feed_format: FeedFormat = FeedFormat.CSV


# ============================================================================
# PRODUCTION TICKET (Enhanced)
# ============================================================================

class TicketPriority(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class TicketStatus(str, Enum):
    BACKLOG = "backlog"
    READY = "ready"
    IN_PROGRESS = "in_progress"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    DELIVERED = "delivered"


class OutputSpec(BaseModel):
    """Output specification for a production ticket."""
    
    format: str
    dimensions: str
    file_type: str
    color_space: Optional[str] = None
    max_file_size: Optional[str] = None


class FeedColumnMapping(BaseModel):
    """Maps production output to feed columns."""
    
    column_name: str
    maps_to: Literal["variation_id", "asset_url", "text_content", "custom"]
    custom_source: Optional[str] = None


class ProductionTicket(BaseModel):
    """Enhanced production ticket with full traceability."""
    
    id: str
    ticket_number: str
    
    # What to build
    module_id: str
    module_type: ModuleType
    module_name: str
    variations_to_create: List[str] = Field(default_factory=list)
    
    # Context
    campaign_id: Optional[str] = None
    campaign_name: Optional[str] = None
    audience_context: List[str] = Field(default_factory=list)
    placement_context: List[str] = Field(default_factory=list)
    
    # Output specifications
    output_specs: List[OutputSpec] = Field(default_factory=list)
    
    # Priority and timeline
    priority: TicketPriority = TicketPriority.MEDIUM
    due_date: Optional[str] = None
    estimated_hours: Optional[float] = None
    
    # Workflow
    status: TicketStatus = TicketStatus.BACKLOG
    assignee: Optional[str] = None
    reviewer: Optional[str] = None
    
    # Downstream destination
    destination_platform: Optional[PlatformId] = None
    feed_column_mapping: List[FeedColumnMapping] = Field(default_factory=list)
    
    # Traceability
    feed_row_ids: List[str] = Field(default_factory=list)
    concept_ids: List[str] = Field(default_factory=list)
    
    # Metadata
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    created_by: Optional[str] = None
    notes: Optional[str] = None


# ============================================================================
# FEED STRUCTURE
# ============================================================================

class FeedColumnType(str, Enum):
    TEXT = "text"
    URL = "url"
    NUMBER = "number"
    DATE = "date"
    BOOLEAN = "boolean"


class FeedColumnSource(str, Enum):
    MODULE = "module"
    AUDIENCE = "audience"
    PLACEMENT = "placement"
    RULE = "rule"
    STATIC = "static"
    FORMULA = "formula"


class FeedColumn(BaseModel):
    """Definition of a column in the feed export."""
    
    id: str
    name: str
    display_name: str
    type: FeedColumnType = FeedColumnType.TEXT
    is_required: bool = False
    is_dynamic: bool = True
    source: FeedColumnSource = FeedColumnSource.MODULE
    source_reference: Optional[str] = None
    default_value: Optional[str] = None
    validation_pattern: Optional[str] = None


class FeedStructure(BaseModel):
    """Structure definition for platform-specific feed export."""
    
    id: str
    name: str
    target_platform: PlatformId
    
    columns: List[FeedColumn] = Field(default_factory=list)
    
    # Row generation
    row_per: Literal["audience", "placement", "audience_x_placement", "cell"] = "audience_x_placement"
    include_defaults: bool = True
    
    # Validation
    estimated_row_count: int = 0
    validation_errors: List[str] = Field(default_factory=list)


# ============================================================================
# MODULE LIBRARY STATE
# ============================================================================

class ModuleLibraryState(BaseModel):
    """Complete state of the module library for a campaign."""
    
    modules: List[Module] = Field(default_factory=list)
    decisioning: DecisioningLogic = Field(default_factory=DecisioningLogic)
    target_platforms: List[PlatformId] = Field(default_factory=list)
    feed_structures: List[FeedStructure] = Field(default_factory=list)
    production_tickets: List[ProductionTicket] = Field(default_factory=list)


# ============================================================================
# PLATFORM EXPORT TEMPLATES
# ============================================================================

class ExportRow(BaseModel):
    """Generic export row that can be formatted per platform."""
    
    row_id: str
    creative_id: str
    creative_name: str
    
    # Module content
    modules: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    
    # Targeting
    audience_id: Optional[str] = None
    audience_name: Optional[str] = None
    funnel_stage: Optional[FunnelStage] = None
    placement_id: Optional[str] = None
    placement_name: Optional[str] = None
    geo_targeting: Optional[str] = None
    
    # Decisioning
    rules_applied: List[str] = Field(default_factory=list)
    is_default: bool = False
    
    # Technical
    dimensions: Optional[str] = None
    format: Optional[str] = None
    
    # Tracking
    destination_url: Optional[str] = None
    utm_params: Optional[str] = None
    
    # Traceability
    production_job_id: Optional[str] = None
    concept_id: Optional[str] = None


class PlatformExport(BaseModel):
    """Complete export package for a DCO platform."""
    
    platform: PlatformId
    export_format: FeedFormat
    exported_at: str
    
    # Content
    rows: List[ExportRow] = Field(default_factory=list)
    decisioning_rules: List[DecisionRule] = Field(default_factory=list)
    
    # Validation
    total_rows: int = 0
    validation_passed: bool = False
    validation_errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    
    # Metadata
    campaign_name: Optional[str] = None
    version: str = "1.0"
