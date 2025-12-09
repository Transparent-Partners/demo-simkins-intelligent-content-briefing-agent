from __future__ import annotations

import json
import os
from typing import List

from app.schemas.specs import Spec, SpecCreate


def _custom_specs_path() -> str:
    """Path for user-defined / custom specs."""
    here = os.path.dirname(__file__)
    return os.path.join(here, "..", "data", "specs.json")


def _platform_specs_path() -> str:
    """Path for the canonical platform spec library."""
    here = os.path.dirname(__file__)
    return os.path.join(here, "..", "data", "platform_specs.json")


def load_specs() -> dict:
    """Loads the full platform spec library into memory."""
    path = _platform_specs_path()
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {"platforms": {}}


def get_platform_constraints(platform_id: str, format_id: str | None = None) -> str:
    """
    Returns a human-readable string of constraints for the AI or strategist.

    Example:
      "SPEC: Reels 9:16 Vertical Video (9:16). Res: 1080x1920. SAFETY: Bottom 350px dead zone."
    """
    data = load_specs()
    platform = data.get("platforms", {}).get(platform_id)

    if not platform:
        return f"Generic Spec: Use standard high-res assets for {platform_id}."

    # If specific format requested, find it.
    if format_id:
        for fmt in platform.get("formats", []):
            if fmt.get("id") == format_id:
                safe_zone = (
                    fmt.get("safe_zones", {}).get("instruction", "Standard safe zones.")
                )
                return (
                    f"SPEC: {fmt.get('name')} ({fmt.get('ratio', 'N/A')}). "
                    f"Res: {fmt.get('resolution_recommended', 'High')}. "
                    f"SAFETY: {safe_zone}"
                )

    # Default: Return list of available formats.
    available = ", ".join([f.get("name", "") for f in platform.get("formats", [])])
    return f"Platform: {platform.get('name', platform_id)}. Available Formats: {available}"


def _flatten_platform_specs() -> List[Spec]:
    """
    Flatten the nested platform_specs.json structure into Spec rows
    suitable for UI tables and feed builders.
    """
    data = load_specs()
    platforms = data.get("platforms", {})
    flattened: List[Spec] = []

    for platform_id, platform in platforms.items():
        for fmt in platform.get("formats", []):
            res = fmt.get("resolution_recommended", "")
            width = height = 0
            if isinstance(res, str) and "x" in res:
                try:
                    w_str, h_str = res.lower().split("x")
                    width = int(w_str)
                    height = int(h_str)
                except Exception:
                    width = height = 0

            spec_id = f"{platform_id}_{fmt.get('id', '')}".upper()

            flattened.append(
                Spec(
                    id=spec_id,
                    platform=platform.get("name", platform_id),
                    placement=fmt.get("name", fmt.get("id", "")),
                    width=width,
                    height=height,
                    orientation=fmt.get("ratio", ""),
                    media_type=fmt.get("media_type", "image_or_video"),
                    notes=fmt.get("safe_zones", {}).get("instruction"),
                )
            )

    return flattened


def get_all_specs() -> List[Spec]:
    """
    Return the full spec library: canonical platform specs + any custom specs.
    """
    flattened = _flatten_platform_specs()

    # Append any custom specs stored in specs.json, if present.
    path = _custom_specs_path()
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            try:
                raw = json.load(f)
            except Exception:
                raw = []
        for item in raw or []:
            try:
                flattened.append(Spec(**item))
            except Exception:
                continue

    return flattened


def save_spec(spec_data: SpecCreate) -> Spec:
    """
    Append a new custom spec to the JSON file (POC-only; no concurrency control).
    """
    path = _custom_specs_path()
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            try:
                raw = json.load(f)
            except Exception:
                raw = []
    else:
        raw = []

    specs = [Spec(**item) for item in raw]

    # Auto-generate an ID if not provided.
    if spec_data.id:
        new_id = spec_data.id
    else:
        base = f"{spec_data.platform}_{spec_data.placement}".upper().replace(" ", "_")
        new_id = base
        existing_ids = {s.id for s in specs}
        suffix = 1
        while new_id in existing_ids:
            new_id = f"{base}_{suffix}"
            suffix += 1

    new_spec = Spec(id=new_id, **spec_data.model_dump(exclude={"id"}))
    specs.append(new_spec)

    with open(path, "w", encoding="utf-8") as f:
        json.dump([s.model_dump() for s in specs], f, indent=2)

    return new_spec


