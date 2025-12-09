from typing import List, Dict, Any
from uuid import uuid4

from app.schemas.feed import AssetFeedRow


def _normalise_key(name: str) -> str:
    """Return a lowercase, underscore variant of a column name for fuzzy matching."""
    return name.strip().lower().replace(" ", "_")


def generate_dco_feed(
    audience_strategy: List[Dict[str, Any]],
    asset_list: List[Dict[str, Any]],
    media_plan_rows: List[Dict[str, Any]],
) -> List[AssetFeedRow]:
    """
    Generate a simple DCO feed that connects strategy + concepts + media.

    This deliberately stays schema-light so we can evolve the upstream data
    structures (AudienceStrategy, AssetList, MediaPlanRows) without having to
    constantly rework the core loop.

    Expected (but not strictly required) shapes:
      - audience_strategy: [{ "audience": "Prospects", "headline": "..." }, ...]
      - asset_list:       [{ "audience": "Prospects", "image_url": "...", "exit_url": "..." }, ...]
      - media_plan_rows:  [{ "Placement ID": "123", "Target Audience": "Prospects", ... }, ...]

    The function:
      - walks each media row
      - finds a matching strategy row by audience -> headline
      - finds a matching asset row by audience -> image_url / exit_url
      - returns rows shaped like the Toyota-style feed:
          { "Unique_ID", "Headline", "Image_URL", "Exit_URL" }
    """

    # Build simple lookup tables keyed by normalised audience name
    strategy_by_audience: Dict[str, Dict[str, Any]] = {}
    for s in audience_strategy:
        audience = s.get("audience") or s.get("Audience") or s.get("target_audience")
        if not isinstance(audience, str):
            continue
        strategy_by_audience[_normalise_key(audience)] = s

    assets_by_audience: Dict[str, Dict[str, Any]] = {}
    for a in asset_list:
        audience = a.get("audience") or a.get("Audience") or a.get("target_audience")
        if not isinstance(audience, str):
            continue
        assets_by_audience[_normalise_key(audience)] = a

    feed: List[AssetFeedRow] = []

    for idx, row in enumerate(media_plan_rows):
        # Try a couple of common audience column names
        audience = (
            row.get("Target Audience")
            or row.get("Audience")
            or row.get("audience")
            or row.get("Segment")
            or row.get("segment")
        )

        norm_aud = _normalise_key(audience) if isinstance(audience, str) else ""

        strategy = strategy_by_audience.get(norm_aud, {})
        asset = assets_by_audience.get(norm_aud, {})

        headline = (
            strategy.get("headline")
            or strategy.get("Headline")
            or strategy.get("message")
            or strategy.get("Message")
            or ""
        )

        image_url = (
            asset.get("image_url")
            or asset.get("Image_URL")
            or asset.get("asset_url")
            or asset.get("Asset_URL")
            or ""
        )

        exit_url = (
            asset.get("exit_url")
            or asset.get("Exit_URL")
            or asset.get("click_url")
            or asset.get("Click_URL")
            or ""
        )

        # Identity & taxonomy
        row_id = str(uuid4())

        # Simple creative taxonomy slug
        base_concept = (strategy.get("concept_slug") or strategy.get("audience") or audience or "Concept").replace(
            " ", ""
        )
        msg_slug = (headline or "Message").replace(" ", "")
        dimension = row.get("Size") or row.get("Dimension") or ""
        fmt = row.get("Format") or "DC"
        creative_filename = f"{base_concept}_{msg_slug}_{dimension or 'NA'}_{fmt}_v1"

        reporting_label = f"Audience: {audience or 'N/A'} | Msg: {headline or 'N/A'}"

        # Visual & copy slots
        asset_slot_a_path = image_url or exit_url or ""
        asset_slot_b_path = ""
        asset_slot_c_path = ""

        copy_slot_a_text = headline or ""
        copy_slot_b_text = strategy.get("subhead") or ""
        copy_slot_c_text = strategy.get("cta_copy") or ""

        # Style defaults (can be overridden later)
        cta_button_text = strategy.get("cta_label") or "Learn More"
        font_color_hex = "#FFFFFF"
        cta_bg_color_hex = "#14b8a6"
        background_color_hex = "#020617"

        # Technical specs – best-effort from media row
        platform_id = row.get("Platform") or "META"
        placement_dimension = dimension or row.get("Placement") or ""
        asset_format_type = (
            row.get("Asset_Type")
            or asset.get("asset_type")
            or ("VIDEO" if "video" in (fmt or "").lower() else "STATIC")
        )

        # Targeting
        audience_id = audience if isinstance(audience, str) else None
        geo_targeting = row.get("Geo") or ""
        trigger_condition = row.get("Trigger") or ""

        destination_url = exit_url or ""
        utm_suffix = row.get("UTM") or ""

        feed.append(
            AssetFeedRow(
                row_id=row_id,
                creative_filename=creative_filename,
                reporting_label=reporting_label,
                is_default=(idx == 0),
                asset_slot_a_path=asset_slot_a_path,
                asset_slot_b_path=asset_slot_b_path,
                asset_slot_c_path=asset_slot_c_path,
                logo_asset_path=None,
                copy_slot_a_text=copy_slot_a_text,
                copy_slot_b_text=copy_slot_b_text,
                copy_slot_c_text=copy_slot_c_text,
                legal_disclaimer_text=strategy.get("legal_disclaimer") or "",
                cta_button_text=cta_button_text,
                font_color_hex=font_color_hex,
                cta_bg_color_hex=cta_bg_color_hex,
                background_color_hex=background_color_hex,
                platform_id=str(platform_id),
                placement_dimension=str(placement_dimension),
                asset_format_type=str(asset_format_type),
                audience_id=audience_id,
                geo_targeting=str(geo_targeting),
                date_start=str(row.get("Start_Date") or ""),
                date_end=str(row.get("End_Date") or ""),
                trigger_condition=str(trigger_condition),
                destination_url=str(destination_url),
                utm_suffix=str(utm_suffix),
            )
        )

    return feed


