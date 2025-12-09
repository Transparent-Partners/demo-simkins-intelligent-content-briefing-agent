from __future__ import annotations

from typing import Any, Dict, Optional
from uuid import uuid4

from pydantic import BaseModel, Field


class ProductionBatch(BaseModel):
    """
    Groups all assets for a specific Strategy + Concept combination.

    This is a lightweight Pydantic model for the POC. In a full implementation,
    it would back a persistent database table.
    """

    id: str = Field(default_factory=lambda: str(uuid4()))
    campaign_id: str
    strategy_segment_id: str
    concept_id: str
    batch_name: str


class ProductionAsset(BaseModel):
    """
    Represents one file to be built in production – a single 'kitchen ticket'.
    """

    id: str = Field(default_factory=lambda: str(uuid4()))
    batch_id: str

    # Human-readable identity
    asset_name: str

    # Spec integration
    platform: str
    placement: str
    spec_dimensions: str
    spec_details: Dict[str, Any]

    # Workflow status
    status: str = Field(
        default="Todo",
        description="Workflow status: Todo, In_Progress, Review, Approved.",
    )
    assignee: Optional[str] = None

    # Creative directives
    asset_type: str = Field(
        default="static",
        description="High-level asset type: static, copy, html5, video, audio.",
    )
    visual_directive: str
    copy_headline: str
    source_asset_requirements: Optional[str] = None
    adaptation_instruction: Optional[str] = None

    # Final file reference (optional at creation time)
    file_url: Optional[str] = None


