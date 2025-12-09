from __future__ import annotations

"""
Module 4 – Spec Library (Strategy / Production Bridge)

This is a static, in-memory "truth table" of popular ad environment specs.
It is intentionally focused on the production layer (what needs to be built),
not on media planning or trafficking.
"""

from typing import Any, Dict


SPEC_LIBRARY: Dict[str, Dict[str, Any]] = {
    "META_STORY": {
        "platform": "Meta",
        "placement": "Stories / Reels",
        "format_name": "9:16 Vertical Video",
        "dimensions": "1080x1920",
        "aspect_ratio": "9:16",
        "max_duration": 15,
        "file_type": "mp4",
        "asset_type": "video",
        "safe_zone": "Leave ~250px at top and bottom free of text and critical UI.",
    },
    "META_FEED": {
        "platform": "Meta",
        "placement": "Feed / Carousel",
        "format_name": "4:5 Vertical",
        "dimensions": "1080x1350",
        "aspect_ratio": "4:5",
        "max_duration": 60,
        "file_type": "mp4/jpg",
        "asset_type": "static",
        "safe_zone": "No strict safe zone, but design for thumb-stopping legibility.",
    },
    "DISPLAY_MPU": {
        "platform": "Google Display",
        "placement": "MPU",
        "format_name": "Medium Rectangle",
        "dimensions": "300x250",
        "aspect_ratio": "1.2:1",
        "max_duration": 0,
        "file_type": "html5/jpg",
        "asset_type": "html5",
        "safe_zone": "None; keep copy large and minimal given limited area.",
    },
    "DISPLAY_LEADERBOARD": {
        "platform": "Google Display",
        "placement": "Leaderboard",
        "format_name": "728x90 Banner",
        "dimensions": "728x90",
        "aspect_ratio": "8:1",
        "max_duration": 0,
        "file_type": "html5/jpg",
        "asset_type": "html5",
        "safe_zone": "Very limited height; prioritize logo + single line CTA.",
    },
    "YOUTUBE_SHORTS": {
        "platform": "YouTube",
        "placement": "Shorts",
        "format_name": "9:16 Vertical Video",
        "dimensions": "1080x1920",
        "aspect_ratio": "9:16",
        "max_duration": 60,
        "file_type": "mp4",
        "asset_type": "video",
        "safe_zone": "Avoid UI overlays at bottom and right-hand side.",
    },
    "LINKEDIN_FEED": {
        "platform": "LinkedIn",
        "placement": "Feed",
        "format_name": "1:1 / 4:5 Image or Video",
        "dimensions": "1200x1200 or 1080x1350",
        "aspect_ratio": "1:1 / 4:5",
        "max_duration": 60,
        "file_type": "mp4/jpg",
        "asset_type": "static",
        "safe_zone": "B2B context; favor clarity, legible charts, and restrained motion.",
    },
}


def get_spec_by_id(spec_id: str) -> Dict[str, Any] | None:
    """
    Return a spec profile by its environment / format ID.

    Example IDs:
      - META_STORY
      - META_FEED
      - DISPLAY_MPU
    """
    return SPEC_LIBRARY.get(spec_id)


