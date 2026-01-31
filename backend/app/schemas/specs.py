from typing import Any, Dict, Optional

from pydantic import BaseModel


class Spec(BaseModel):
    id: str
    platform: str
    placement: str
    width: int
    height: int
    orientation: str
    media_type: str
    notes: str | None = None
    
    # Enhanced production fields
    max_duration_seconds: int | None = None  # e.g., 15, 60, 6 for bumpers
    min_duration_seconds: int | None = None  # e.g., 3 for some formats
    file_size_limit_kb: int | None = None  # e.g., 150 for display ads
    aspect_ratio: str | None = None  # e.g., "9:16", "16:9", "1:1"
    
    # Audio guidance
    audio_guidance: str | None = None  # e.g., "Sound on", "Sound off/captions", "Optional"


class SpecCreate(BaseModel):
    platform: str
    placement: str
    width: int
    height: int
    orientation: str
    media_type: str
    notes: str | None = None
    id: str | None = None
    
    # Enhanced production fields
    max_duration_seconds: int | None = None
    min_duration_seconds: int | None = None
    file_size_limit_kb: int | None = None
    aspect_ratio: str | None = None
    audio_guidance: str | None = None


