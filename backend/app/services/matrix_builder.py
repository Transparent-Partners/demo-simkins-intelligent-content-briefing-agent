from __future__ import annotations

"""
Matrix Builder – Many-to-One ProductionJob grouper.

Given a set of selected specs and a creative concept, this service groups
redundant specs (same physical asset) into a single ProductionJob with
multiple DeliveryDestinations.
"""

from typing import Dict, List, Optional

from app.schemas.production_matrix import DeliveryDestination, ProductionJob


# File format mapping based on media type
FILE_FORMAT_MAP = {
    "video": "MP4",
    "image": "JPG/PNG",
    "image_or_video": "MP4/JPG",
    "html5": "HTML5",
    "image_or_html5": "HTML5/JPG",
    "video_or_image": "MP4/JPG",
}

# Audio spec defaults based on platform patterns
AUDIO_DEFAULTS = {
    "video": "Sound on recommended; ensure captions for accessibility",
    "image": None,
    "html5": None,
}


class MatrixBuilder:
    """
    Group flat spec selections into consolidated ProductionJob tickets.
    """

    def group_specs_by_creative(
        self,
        selected_specs: List[Dict],
        creative_concept: str,
        campaign_name: Optional[str] = None,
        single_minded_proposition: Optional[str] = None,
    ) -> List[ProductionJob]:
        """
        Input: A list of selected spec dicts (from spec library or UI).

        Expected keys (best-effort, falls back when missing):
          - dimensions (e.g. "1080x1920") or width/height
          - file_type or media_type
          - aspect_ratio or orientation
          - platform_name or platform
          - id (spec identifier)
          - format_name or placement
          - safe_zone_notes or notes or safe_zone
          - max_duration or max_duration_seconds (optional)
          
        Enhanced to populate production-critical fields:
          - production_notes (consolidated safe zone guidance)
          - max_duration_seconds
          - file_format, audio_spec
          - Brief context (campaign_name, SMP)
        """
        grouped_jobs: Dict[str, ProductionJob] = {}
        # Track safe zone notes per group for consolidation
        group_safe_zones: Dict[str, List[str]] = {}
        # Track duration constraints per group
        group_durations: Dict[str, List[int]] = {}

        for idx, spec in enumerate(selected_specs):
            # Normalise raw spec fields to a common shape
            dimensions = spec.get("dimensions")
            if not dimensions:
                w = spec.get("width")
                h = spec.get("height")
                if w and h:
                    dimensions = f"{w}x{h}"

            file_type = spec.get("file_type") or spec.get("media_type") or "asset"
            aspect_ratio = spec.get("aspect_ratio") or spec.get("orientation") or ""

            platform_name = spec.get("platform_name") or spec.get("platform") or "Unknown"
            spec_id = spec.get("id") or spec.get("spec_id") or f"SPEC-{idx+1}"
            format_name = spec.get("format_name") or spec.get("placement") or ""

            safe_notes = (
                spec.get("safe_zone_notes")
                or spec.get("notes")
                or spec.get("safe_zone")
                or ""
            )
            max_duration = spec.get("max_duration") or spec.get("max_duration_seconds")
            
            # Extract file size limit if present
            file_size_limit = spec.get("file_size_limit_kb")

            # Group key: physical asset (dimensions + file_type) + concept
            key_dimensions = dimensions or "GENERIC"
            key_file = file_type or "asset"
            group_key = f"{key_dimensions}_{key_file}_{creative_concept}"

            if group_key not in grouped_jobs:
                tech_parts = [key_dimensions]
                if max_duration:
                    tech_parts.append(f"{max_duration}s")
                tech_parts.append(file_type.upper())
                technical_summary = ", ".join(tech_parts)
                
                # Determine file format from media type
                base_type = file_type.lower().replace("_", " ").split()[0] if file_type else "asset"
                file_format = FILE_FORMAT_MAP.get(file_type.lower(), file_type.upper() if file_type else None)
                
                # Determine audio spec
                audio_spec = AUDIO_DEFAULTS.get(base_type)
                
                # Determine if video needs subtitles
                requires_subtitles = base_type == "video"

                grouped_jobs[group_key] = ProductionJob(
                    job_id=f"JOB-{len(grouped_jobs) + 1}",
                    creative_concept=creative_concept,
                    asset_type=f"{aspect_ratio or key_dimensions} {file_type}".strip(),
                    technical_summary=technical_summary,
                    destinations=[],
                    # Brief context
                    campaign_name=campaign_name,
                    single_minded_proposition=single_minded_proposition,
                    # File specifications
                    file_format=file_format,
                    audio_spec=audio_spec,
                    requires_subtitles=requires_subtitles,
                    codec="H.264" if base_type == "video" else None,
                    frame_rate="30fps" if base_type == "video" else None,
                    # Default workflow state
                    round_label="R1",
                    version_tag="v1",
                    priority="Medium",
                )
                group_safe_zones[group_key] = []
                group_durations[group_key] = []

            # Build enhanced destination with full spec details
            grouped_jobs[group_key].destinations.append(
                DeliveryDestination(
                    platform_name=platform_name,
                    spec_id=spec_id,
                    format_name=format_name or key_dimensions,
                    special_notes=safe_notes or "Standard",
                    max_duration_seconds=int(max_duration) if max_duration else None,
                    dimensions=dimensions,
                    aspect_ratio=aspect_ratio,
                    media_type=file_type,
                    file_size_limit_kb=int(file_size_limit) if file_size_limit else None,
                )
            )
            
            # Collect safe zone notes for consolidation
            if safe_notes and safe_notes.strip() and safe_notes != "Standard":
                note_with_platform = f"• {platform_name} ({format_name}): {safe_notes}"
                if note_with_platform not in group_safe_zones[group_key]:
                    group_safe_zones[group_key].append(note_with_platform)
            
            # Collect duration constraints
            if max_duration:
                group_durations[group_key].append(int(max_duration))

        # Post-process: consolidate production notes and set strictest duration
        for group_key, job in grouped_jobs.items():
            # Consolidate safe zone notes into production_notes
            safe_zone_list = group_safe_zones.get(group_key, [])
            if safe_zone_list:
                job.production_notes = "SAFE ZONE GUIDANCE:\n" + "\n".join(safe_zone_list)
            else:
                job.production_notes = "SAFE ZONE GUIDANCE:\n• Standard safe zones apply. Check platform specs before final delivery."
            
            # Set strictest duration constraint
            duration_list = group_durations.get(group_key, [])
            if duration_list:
                job.max_duration_seconds = min(duration_list)
                # Update technical summary with duration
                if job.max_duration_seconds:
                    job.technical_summary = f"{job.technical_summary.split(',')[0]}, max {job.max_duration_seconds}s"

        return list(grouped_jobs.values())


