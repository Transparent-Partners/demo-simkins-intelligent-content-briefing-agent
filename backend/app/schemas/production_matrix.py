from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel


class DeliveryDestination(BaseModel):
    """
    One downstream delivery endpoint for a master production asset.
    """

    platform_name: str  # e.g., "TikTok"
    spec_id: str  # Reference into the spec library / environment ID
    format_name: str  # e.g., "In-Feed Video"
    special_notes: str  # e.g., "Strict Safe Zone bottom 150px"
    
    # Enhanced spec details for production clarity
    max_duration_seconds: int | None = None  # e.g., 15, 60, 6
    dimensions: str | None = None  # e.g., "1080x1920"
    aspect_ratio: str | None = None  # e.g., "9:16", "16:9"
    media_type: str | None = None  # e.g., "video", "image", "html5"
    file_size_limit_kb: int | None = None  # e.g., 150 for display ads


class ProductionJob(BaseModel):
    """
    Represents ONE unique asset to be produced, which may serve multiple partners.

    This is the Many-to-One "master ticket" that collapses redundant specs
    (e.g., TikTok + Reels + Shorts all using the same 9:16 master edit).
    """

    job_id: str  # e.g., "JOB-2025-001"
    creative_concept: str  # e.g., "Summer Sale - High Energy"
    asset_type: str  # e.g., "Vertical Video (9:16)"

    # Grouped downstream endpoints that share this master asset
    destinations: List[DeliveryDestination]

    # Production + operational metadata
    technical_summary: str  # e.g., "1080x1920, 15s, MP4"
    status: str = "Pending"  # Pending, In-Production, Approved, Delivered
    source_type: str | None = None  # e.g., "New Shoot", "Stock", "Reuse", "UGC", "AI Generated"
    shoot_code: str | None = None  # Link to shoot or kit (e.g., "SHOOT-ABC-2025")
    version_tag: str | None = None  # e.g., "v1", "v1.1_localized"
    owner: str | None = None  # Producer / editor responsible
    due_date: str | None = None  # ISO date string for POC
    round_label: str | None = None  # e.g., "R1", "R2", "Final"
    asset_feed_row_ids: list[str] | None = None  # Optional linkage into the asset feed
    
    # === NEW PRODUCTION ENGINEERING FIELDS ===
    
    # Brief context (for traceability)
    campaign_name: str | None = None  # From brief
    single_minded_proposition: str | None = None  # Core message from brief
    
    # Production notes consolidating safe zones and platform guidance
    production_notes: str | None = None  # Consolidated safe zone & platform guidance
    
    # Duration constraints
    max_duration_seconds: int | None = None  # e.g., 15, 6, 60
    min_duration_seconds: int | None = None  # e.g., 3 for some formats
    
    # File specifications
    file_format: str | None = None  # e.g., "MP4", "MOV", "HTML5", "JPG"
    codec: str | None = None  # e.g., "H.264", "H.265"
    audio_spec: str | None = None  # e.g., "Sound on", "Sound off / captions required"
    frame_rate: str | None = None  # e.g., "30fps", "24fps"
    file_size_limit_mb: float | None = None  # e.g., 4.0, 150 (for display)
    
    # Localization
    language: str | None = None  # e.g., "EN-US", "Multi-market"
    requires_subtitles: bool | None = None
    localization_notes: str | None = None
    
    # Compliance
    legal_disclaimer_required: bool | None = None
    talent_usage_rights: str | None = None  # e.g., "In perpetuity", "6 months", "Check with legal"
    music_licensing_status: str | None = None  # e.g., "Licensed", "Needs clearance", "Stock only"
    
    # Priority and estimation
    priority: str | None = None  # e.g., "High", "Medium", "Low", "Urgent"
    estimated_hours: float | None = None
    estimated_cost: float | None = None


