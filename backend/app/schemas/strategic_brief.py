from typing import List, Optional
from pydantic import BaseModel, Field


class AssetRequirement(BaseModel):
    asset_id: str = Field(description="Unique ID for the asset (e.g., VID-001)")
    format: str = Field(description="Format required (e.g., 9:16 Video, 1:1 Image)")
    concept: str = Field(description="Creative focus of this specific asset")
    source_type: str = Field(description="E.g., 'Stock', 'New Shoot', 'Existing Asset'")
    specs: str = Field(description="Technical specs (e.g., 1080x1920, max 15s)")


class LogicRule(BaseModel):
    condition: str = Field(description="The trigger (e.g., IF Audience = 'Retargeting')")
    action: str = Field(description="The result (e.g., SHOW 'Discount' Variant)")


class AudienceRow(BaseModel):
    segment: Optional[str] = Field(
        default=None,
        description="Audience or persona label (e.g., 'Prospect', 'Loyalty', 'CFO Decision Maker')",
    )
    stage: Optional[str] = Field(
        default=None,
        description="Funnel stage or lifecycle (e.g., 'Awareness', 'Retargeting', 'Loyalty')",
    )
    trigger: Optional[str] = Field(
        default=None,
        description="Trigger condition for this audience row (e.g., 'Cart Abandon', 'Visited Pricing Page')",
    )
    channel: Optional[str] = Field(
        default=None,
        description="Primary channel or placement (e.g., 'Meta Reels', 'YouTube In-Stream', 'Email')",
    )
    notes: Optional[str] = Field(
        default=None,
        description="Additional notes about this audience row",
    )


class ChannelSpec(BaseModel):
    channel: str = Field(description="Channel or platform (e.g., 'Meta Reels', 'YouTube', 'Display')")
    format: str = Field(description="Creative format (e.g., '9:16 Video', '1:1 Image')")
    max_duration_seconds: Optional[int] = Field(
        default=None,
        description="Maximum allowed duration for video assets in seconds",
    )
    aspect_ratio: Optional[str] = Field(
        default=None,
        description="Recommended aspect ratio (e.g., '9:16', '1:1', '16:9')",
    )
    safe_zone_notes: Optional[str] = Field(
        default=None,
        description="Any safe-zone or UI-overlay notes for this placement",
    )
    copy_limit_chars: Optional[int] = Field(
        default=None,
        description="Recommended or enforced character limit for primary copy",
    )
    additional_notes: Optional[str] = Field(
        default=None,
        description="Other relevant production considerations for this channel/format",
    )


class ContentMatrixRow(BaseModel):
    asset_id: str = Field(description="ID linking back to the bill_of_materials / production tracker")
    audience_segment: Optional[str] = Field(
        default=None,
        description="Audience segment this asset is designed for",
    )
    funnel_stage: Optional[str] = Field(
        default=None,
        description="Funnel stage or lifecycle moment",
    )
    trigger: Optional[str] = Field(
        default=None,
        description="Trigger condition (e.g., 'Cart Abandon', 'Viewed Product Page')",
    )
    channel: Optional[str] = Field(
        default=None,
        description="Channel / placement this asset will run in",
    )
    format: Optional[str] = Field(
        default=None,
        description="Format of the asset (e.g., '9:16 Video', '4:5 Static')",
    )
    message: Optional[str] = Field(
        default=None,
        description="Short description of the core message or angle",
    )
    variant: Optional[str] = Field(
        default=None,
        description="Variant label (e.g., 'FOMO', 'Social Proof', 'Offer')",
    )
    source_type: Optional[str] = Field(
        default=None,
        description="Source of this asset (e.g., 'New Shoot', 'Stock', 'Existing Library')",
    )
    specs: Optional[str] = Field(
        default=None,
        description="Any overriding specs specific to this asset/placement",
    )
    notes: Optional[str] = Field(
        default=None,
        description="Additional execution notes for production teams",
    )


class ProductionMasterPlan(BaseModel):
    # Core brief
    campaign_name: str = Field(description="Name of the campaign")
    single_minded_proposition: str = Field(description="The one key message")
    primary_audience: str = Field(description="Target audience definition")
    narrative_brief: Optional[str] = Field(
        default=None,
        description="Written narrative brief a creative director could review and approve",
    )

    # Audience + channel context
    audience_matrix: Optional[List[AudienceRow]] = Field(
        default=None,
        description="Structured audience matrix derived from uploads and Q&A",
    )
    channel_specs: Optional[List[ChannelSpec]] = Field(
        default=None,
        description="Channel and format-specific production specifications",
    )

    # The Bill of Materials
    bill_of_materials: List[AssetRequirement] = Field(
        description="List of all raw assets needed for the campaign",
    )

    # Logic / Content Matrix
    logic_map: List[LogicRule] = Field(
        description="High-level rules for dynamic assembly and decisioning",
    )
    content_matrix: Optional[List[ContentMatrixRow]] = Field(
        default=None,
        description="Execution-ready content matrix for production and trafficking",
    )

    production_notes: Optional[str] = Field(
        default=None,
        description="Additional guardrails and constraints",
    )

