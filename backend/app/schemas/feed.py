from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class AssetFeedRow(BaseModel):
    """
    Final Asset Feed row – the creative-first, spec-aware manifest.
    """

    # Block 1: Identity & Taxonomy
    row_id: str
    creative_filename: str
    reporting_label: str
    is_default: bool = False

    # Block 2: Visual Assets
    asset_slot_a_path: Optional[str] = None
    asset_slot_b_path: Optional[str] = None
    asset_slot_c_path: Optional[str] = None
    logo_asset_path: Optional[str] = None

    # Block 3: Copy & Messaging
    copy_slot_a_text: Optional[str] = None
    copy_slot_b_text: Optional[str] = None
    copy_slot_c_text: Optional[str] = None
    legal_disclaimer_text: Optional[str] = None

    # Block 4: Design & Style Variables
    cta_button_text: Optional[str] = None
    font_color_hex: Optional[str] = None
    cta_bg_color_hex: Optional[str] = None
    background_color_hex: Optional[str] = None

    # Block 5: Technical Specifications
    platform_id: str
    placement_dimension: str
    asset_format_type: str

    # Block 6: Media Targeting Logic
    audience_id: Optional[str] = None
    geo_targeting: Optional[str] = None
    date_start: Optional[str] = None  # ISO date string
    date_end: Optional[str] = None    # ISO date string
    trigger_condition: Optional[str] = None

    # Block 7: Destination & Tracking
    destination_url: Optional[str] = None
    utm_suffix: Optional[str] = None


