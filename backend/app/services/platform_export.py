"""
Platform Export Service
Generates exports for DCO and production automation platforms
"""
from typing import List, Dict, Any, Optional
from datetime import datetime
import json
import csv
import io

from app.schemas.modules import (
    PlatformId, FeedFormat, ExportRow, PlatformExport, DecisionRule,
    ModuleLibraryState, FunnelStage
)
from app.schemas.feed import AssetFeedRow


# ============================================================================
# PLATFORM-SPECIFIC COLUMN MAPPINGS
# ============================================================================

FLASHTALKING_COLUMNS = [
    "Creative ID", "Creative Name", "Version", "Audience", "Placement",
    "Headline", "Body Copy", "CTA", "Image 1 URL", "Image 2 URL",
    "Video URL", "Logo URL", "Background Color", "Font Color",
    "Click URL", "Impression Tracker", "Click Tracker"
]

INNOVID_COLUMNS = [
    "creative_id", "creative_name", "version_id", "audience_segment",
    "placement_id", "headline", "description", "cta_text",
    "primary_asset_url", "secondary_asset_url", "logo_url",
    "background_color", "text_color", "click_through_url"
]

CELTRA_COLUMNS = [
    "feedId", "creativeName", "variantName", "audienceId",
    "placementId", "headline", "subhead", "ctaLabel",
    "heroImage", "logoImage", "backgroundColor", "textColor",
    "clickUrl", "customData"
]

STORYTEQ_COLUMNS = [
    "template_id", "output_name", "variant", "audience",
    "headline", "body", "cta", "image_1", "image_2",
    "logo", "background", "font_color", "destination_url"
]

GOOGLE_STUDIO_COLUMNS = [
    "Creative Name", "Reporting Label", "Exit URL", "Audience ID",
    "Headline", "Description Line 1", "Description Line 2", "CTA Text",
    "Image Asset 1", "Image Asset 2", "Video Asset", "Logo Asset",
    "Primary Color", "Secondary Color"
]


# ============================================================================
# EXPORT GENERATORS
# ============================================================================

def generate_flashtalking_export(
    rows: List[ExportRow],
    rules: List[DecisionRule],
    campaign_name: str
) -> Dict[str, Any]:
    """Generate Flashtalking CSV export."""
    
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=FLASHTALKING_COLUMNS)
    writer.writeheader()
    
    for row in rows:
        modules = row.modules or {}
        
        csv_row = {
            "Creative ID": row.creative_id,
            "Creative Name": row.creative_name,
            "Version": row.row_id,
            "Audience": row.audience_name or row.audience_id or "",
            "Placement": row.placement_name or row.placement_id or "",
            "Headline": modules.get("hook", {}).get("text", "") or modules.get("value_prop", {}).get("text", ""),
            "Body Copy": modules.get("value_prop", {}).get("text", "") or modules.get("proof_point", {}).get("text", ""),
            "CTA": modules.get("cta", {}).get("text", ""),
            "Image 1 URL": modules.get("product", {}).get("asset_url", "") or modules.get("background", {}).get("asset_url", ""),
            "Image 2 URL": modules.get("proof_point", {}).get("asset_url", ""),
            "Video URL": modules.get("hook", {}).get("asset_url", "") if modules.get("hook", {}).get("format") == "video" else "",
            "Logo URL": modules.get("logo", {}).get("asset_url", ""),
            "Background Color": modules.get("background", {}).get("color", "#FFFFFF"),
            "Font Color": modules.get("value_prop", {}).get("color", "#000000"),
            "Click URL": row.destination_url or "",
            "Impression Tracker": "",
            "Click Tracker": "",
        }
        writer.writerow(csv_row)
    
    return {
        "format": "csv",
        "content": output.getvalue(),
        "filename": f"{campaign_name}_flashtalking_feed.csv",
        "row_count": len(rows),
    }


def generate_innovid_export(
    rows: List[ExportRow],
    rules: List[DecisionRule],
    campaign_name: str
) -> Dict[str, Any]:
    """Generate Innovid JSON export."""
    
    innovid_data = {
        "campaign": campaign_name,
        "exported_at": datetime.now().isoformat(),
        "creatives": []
    }
    
    for row in rows:
        modules = row.modules or {}
        
        creative = {
            "creative_id": row.creative_id,
            "creative_name": row.creative_name,
            "version_id": row.row_id,
            "targeting": {
                "audience_segment": row.audience_id,
                "audience_name": row.audience_name,
                "placement_id": row.placement_id,
                "placement_name": row.placement_name,
                "geo": row.geo_targeting,
            },
            "content": {
                "headline": modules.get("hook", {}).get("text", "") or modules.get("value_prop", {}).get("text", ""),
                "description": modules.get("value_prop", {}).get("text", ""),
                "cta_text": modules.get("cta", {}).get("text", ""),
            },
            "assets": {
                "primary_asset_url": modules.get("product", {}).get("asset_url", ""),
                "secondary_asset_url": modules.get("proof_point", {}).get("asset_url", ""),
                "logo_url": modules.get("logo", {}).get("asset_url", ""),
                "video_url": modules.get("hook", {}).get("asset_url", "") if modules.get("hook", {}).get("format") == "video" else None,
            },
            "styling": {
                "background_color": modules.get("background", {}).get("color", "#FFFFFF"),
                "text_color": modules.get("value_prop", {}).get("color", "#000000"),
            },
            "tracking": {
                "click_through_url": row.destination_url,
                "utm_params": row.utm_params,
            },
            "metadata": {
                "funnel_stage": row.funnel_stage.value if row.funnel_stage else None,
                "is_default": row.is_default,
                "rules_applied": row.rules_applied,
                "production_job_id": row.production_job_id,
            }
        }
        innovid_data["creatives"].append(creative)
    
    # Add decisioning rules
    if rules:
        innovid_data["decisioning"] = {
            "rules": [
                {
                    "id": rule.id,
                    "name": rule.name,
                    "priority": rule.priority,
                    "conditions": [
                        {
                            "type": cond.type.value,
                            "operator": cond.operator.value,
                            "value": cond.value
                        }
                        for cond in rule.conditions
                    ],
                    "condition_logic": rule.condition_logic,
                    "action": {
                        "module_type": rule.action.module_type.value,
                        "module_id": rule.action.module_id,
                        "variation_id": rule.action.variation_id,
                    }
                }
                for rule in rules if rule.is_active
            ]
        }
    
    return {
        "format": "json",
        "content": json.dumps(innovid_data, indent=2),
        "filename": f"{campaign_name}_innovid_feed.json",
        "row_count": len(rows),
    }


def generate_celtra_export(
    rows: List[ExportRow],
    rules: List[DecisionRule],
    campaign_name: str
) -> Dict[str, Any]:
    """Generate Celtra JSON feed export."""
    
    celtra_data = {
        "feedName": f"{campaign_name} Feed",
        "exportedAt": datetime.now().isoformat(),
        "items": []
    }
    
    for row in rows:
        modules = row.modules or {}
        
        item = {
            "feedId": row.row_id,
            "creativeName": row.creative_name,
            "variantName": f"{row.audience_name or 'Default'} - {row.placement_name or 'All'}",
            "audienceId": row.audience_id,
            "audienceName": row.audience_name,
            "placementId": row.placement_id,
            "headline": modules.get("hook", {}).get("text", ""),
            "subhead": modules.get("value_prop", {}).get("text", ""),
            "ctaLabel": modules.get("cta", {}).get("text", ""),
            "heroImage": modules.get("product", {}).get("asset_url", ""),
            "logoImage": modules.get("logo", {}).get("asset_url", ""),
            "backgroundColor": modules.get("background", {}).get("color", "#FFFFFF"),
            "textColor": modules.get("value_prop", {}).get("color", "#000000"),
            "clickUrl": row.destination_url,
            "customData": {
                "funnel_stage": row.funnel_stage.value if row.funnel_stage else None,
                "concept_id": row.concept_id,
                "production_job_id": row.production_job_id,
            }
        }
        celtra_data["items"].append(item)
    
    return {
        "format": "json",
        "content": json.dumps(celtra_data, indent=2),
        "filename": f"{campaign_name}_celtra_feed.json",
        "row_count": len(rows),
    }


def generate_storyteq_export(
    rows: List[ExportRow],
    rules: List[DecisionRule],
    campaign_name: str
) -> Dict[str, Any]:
    """Generate Storyteq CSV export."""
    
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=STORYTEQ_COLUMNS)
    writer.writeheader()
    
    for row in rows:
        modules = row.modules or {}
        
        csv_row = {
            "template_id": row.creative_id,
            "output_name": row.creative_name,
            "variant": row.row_id,
            "audience": row.audience_name or row.audience_id or "Default",
            "headline": modules.get("hook", {}).get("text", ""),
            "body": modules.get("value_prop", {}).get("text", ""),
            "cta": modules.get("cta", {}).get("text", ""),
            "image_1": modules.get("product", {}).get("asset_url", ""),
            "image_2": modules.get("proof_point", {}).get("asset_url", ""),
            "logo": modules.get("logo", {}).get("asset_url", ""),
            "background": modules.get("background", {}).get("color", "#FFFFFF"),
            "font_color": modules.get("value_prop", {}).get("color", "#000000"),
            "destination_url": row.destination_url or "",
        }
        writer.writerow(csv_row)
    
    return {
        "format": "csv",
        "content": output.getvalue(),
        "filename": f"{campaign_name}_storyteq_feed.csv",
        "row_count": len(rows),
    }


def generate_google_studio_export(
    rows: List[ExportRow],
    rules: List[DecisionRule],
    campaign_name: str
) -> Dict[str, Any]:
    """Generate Google Creative Studio CSV export."""
    
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=GOOGLE_STUDIO_COLUMNS)
    writer.writeheader()
    
    for row in rows:
        modules = row.modules or {}
        
        csv_row = {
            "Creative Name": row.creative_name,
            "Reporting Label": f"{row.audience_name or 'Default'}_{row.placement_name or 'All'}",
            "Exit URL": row.destination_url or "",
            "Audience ID": row.audience_id or "",
            "Headline": modules.get("hook", {}).get("text", ""),
            "Description Line 1": modules.get("value_prop", {}).get("text", ""),
            "Description Line 2": modules.get("proof_point", {}).get("text", ""),
            "CTA Text": modules.get("cta", {}).get("text", ""),
            "Image Asset 1": modules.get("product", {}).get("asset_url", ""),
            "Image Asset 2": modules.get("background", {}).get("asset_url", ""),
            "Video Asset": modules.get("hook", {}).get("asset_url", "") if modules.get("hook", {}).get("format") == "video" else "",
            "Logo Asset": modules.get("logo", {}).get("asset_url", ""),
            "Primary Color": modules.get("background", {}).get("color", "#FFFFFF"),
            "Secondary Color": modules.get("value_prop", {}).get("color", "#000000"),
        }
        writer.writerow(csv_row)
    
    return {
        "format": "csv",
        "content": output.getvalue(),
        "filename": f"{campaign_name}_google_studio_feed.csv",
        "row_count": len(rows),
    }


# ============================================================================
# MAIN EXPORT FUNCTION
# ============================================================================

def generate_platform_export(
    platform: PlatformId,
    rows: List[ExportRow],
    rules: List[DecisionRule],
    campaign_name: str
) -> PlatformExport:
    """Generate export for a specific platform."""
    
    # Get platform-specific format
    platform_formats = {
        PlatformId.FLASHTALKING: (FeedFormat.CSV, generate_flashtalking_export),
        PlatformId.INNOVID: (FeedFormat.JSON, generate_innovid_export),
        PlatformId.CELTRA: (FeedFormat.JSON, generate_celtra_export),
        PlatformId.STORYTEQ: (FeedFormat.CSV, generate_storyteq_export),
        PlatformId.GOOGLE_STUDIO: (FeedFormat.CSV, generate_google_studio_export),
        PlatformId.CLINCH: (FeedFormat.CSV, generate_flashtalking_export),  # Similar format
        PlatformId.SIZMEK: (FeedFormat.CSV, generate_flashtalking_export),  # Similar format
        PlatformId.JIVOX: (FeedFormat.JSON, generate_innovid_export),  # Similar format
        PlatformId.ADFORM: (FeedFormat.CSV, generate_flashtalking_export),  # Similar format
    }
    
    if platform not in platform_formats:
        raise ValueError(f"Unsupported platform: {platform}")
    
    feed_format, generator_func = platform_formats[platform]
    
    # Validate rows
    validation_errors = []
    warnings = []
    
    for i, row in enumerate(rows):
        if not row.creative_id:
            validation_errors.append(f"Row {i+1}: Missing creative_id")
        if not row.creative_name:
            validation_errors.append(f"Row {i+1}: Missing creative_name")
        if not row.modules:
            warnings.append(f"Row {i+1}: No modules defined")
    
    # Generate export
    export_result = generator_func(rows, rules, campaign_name)
    
    return PlatformExport(
        platform=platform,
        export_format=feed_format,
        exported_at=datetime.now().isoformat(),
        rows=rows,
        decisioning_rules=rules,
        total_rows=len(rows),
        validation_passed=len(validation_errors) == 0,
        validation_errors=validation_errors,
        warnings=warnings,
        campaign_name=campaign_name,
    )


def convert_feed_rows_to_export_rows(
    feed_rows: List[AssetFeedRow],
    concept_map: Dict[str, str] = None,
    production_job_map: Dict[str, str] = None
) -> List[ExportRow]:
    """Convert internal feed rows to export-ready rows."""
    
    export_rows = []
    
    for feed_row in feed_rows:
        export_row = ExportRow(
            row_id=feed_row.row_id,
            creative_id=feed_row.creative_filename.split('.')[0] if feed_row.creative_filename else feed_row.row_id,
            creative_name=feed_row.reporting_label or feed_row.creative_filename,
            modules={
                "hook": {"text": feed_row.copy_slot_a_text, "asset_url": feed_row.asset_slot_a_path},
                "value_prop": {"text": feed_row.copy_slot_b_text, "asset_url": feed_row.asset_slot_b_path},
                "proof_point": {"text": feed_row.copy_slot_c_text, "asset_url": feed_row.asset_slot_c_path},
                "cta": {"text": feed_row.cta_button_text},
                "logo": {"asset_url": feed_row.logo_asset_path},
                "background": {"color": feed_row.background_color_hex},
                "legal": {"text": feed_row.legal_disclaimer_text},
            },
            audience_id=feed_row.audience_id,
            geo_targeting=feed_row.geo_targeting,
            placement_id=feed_row.platform_id,
            placement_name=feed_row.placement_dimension,
            dimensions=feed_row.placement_dimension,
            format=feed_row.asset_format_type,
            destination_url=feed_row.destination_url,
            utm_params=feed_row.utm_suffix,
            is_default=feed_row.is_default,
            concept_id=concept_map.get(feed_row.row_id) if concept_map else None,
            production_job_id=production_job_map.get(feed_row.row_id) if production_job_map else None,
        )
        export_rows.append(export_row)
    
    return export_rows
