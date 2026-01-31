from typing import List, Optional, Dict, Any
from enum import Enum

from pydantic import BaseModel, Field


class FunnelStage(str, Enum):
    """Buyer journey funnel stage."""
    AWARENESS = "awareness"
    CONSIDERATION = "consideration"
    CONVERSION = "conversion"
    RETENTION = "retention"


class AssetComponent(BaseModel):
    """One visual component in a concept, typically mapped to a DAM asset."""

    role: str  # e.g. "Background", "Primary Visual", "Logo Lockup"
    asset_type: str  # e.g. "image", "video", "logo"
    dam_url: Optional[str] = None
    dam_id: Optional[str] = None
    
    # Module library integration
    module_type: Optional[str] = None  # Link to module taxonomy
    module_id: Optional[str] = None


class ConceptVariation(BaseModel):
    """A variation of a concept for a specific audience or context."""
    
    id: str
    name: str
    description: Optional[str] = None
    
    # Targeting
    audience_ids: List[str] = Field(default_factory=list)
    funnel_stage: Optional[FunnelStage] = None
    trigger: Optional[str] = None
    
    # Content overrides
    headline: Optional[str] = None
    body_copy: Optional[str] = None
    cta: Optional[str] = None
    visual_override: Optional[str] = None
    
    # Status
    status: str = "planned"  # planned, in_production, approved, live
    
    # Production linkage
    production_job_id: Optional[str] = None


class CreativeConcept(BaseModel):
    """A modular creative concept that can be wired into assets later."""

    id: str
    name: str
    visual_description: str
    components: List[AssetComponent] = Field(default_factory=list)
    
    # Audience mapping
    audience_ids: List[str] = Field(default_factory=list)
    funnel_stages: List[FunnelStage] = Field(default_factory=list)
    
    # Variations for different audiences/contexts
    variations: List[ConceptVariation] = Field(default_factory=list)
    
    # Messaging
    headline: Optional[str] = None
    body_copy: Optional[str] = None
    cta: Optional[str] = None
    
    # Module library integration
    module_ids: List[str] = Field(default_factory=list)
    
    # Production traceability
    production_job_ids: List[str] = Field(default_factory=list)
    feed_row_ids: List[str] = Field(default_factory=list)
    
    # Metadata
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    status: str = "draft"  # draft, approved, in_production, live
    approval_notes: Optional[str] = None


class ConceptState(BaseModel):
    """State container for all concepts in a campaign."""
    
    concepts: List[CreativeConcept] = Field(default_factory=list)
    
    # Concept-audience mapping summary
    audience_concept_map: Dict[str, List[str]] = Field(default_factory=dict)  # audience_id -> concept_ids
    funnel_concept_map: Dict[str, List[str]] = Field(default_factory=dict)  # funnel_stage -> concept_ids


