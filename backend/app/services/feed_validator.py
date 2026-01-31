"""
Feed Validator Service
Validates feed data against platform-specific schemas
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from enum import Enum


class ValidationSeverity(str, Enum):
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


class ValidationIssue(BaseModel):
    """A single validation issue."""
    row_id: str
    field: str
    severity: ValidationSeverity
    message: str
    suggestion: Optional[str] = None


class ValidationResult(BaseModel):
    """Complete validation result for a feed."""
    is_valid: bool
    total_rows: int
    errors: int
    warnings: int
    issues: List[ValidationIssue]
    platform: str
    summary: str


# ============================================================================
# PLATFORM-SPECIFIC CONSTRAINTS
# ============================================================================

PLATFORM_CONSTRAINTS = {
    "flashtalking": {
        "max_headline_length": 40,
        "max_body_length": 90,
        "max_cta_length": 25,
        "required_fields": ["creative_id", "creative_name", "headline", "click_url"],
        "image_formats": ["jpg", "jpeg", "png", "gif"],
        "video_formats": ["mp4", "webm"],
        "max_file_size_kb": 200,
    },
    "innovid": {
        "max_headline_length": 50,
        "max_body_length": 120,
        "max_cta_length": 30,
        "required_fields": ["creative_id", "creative_name", "click_through_url"],
        "image_formats": ["jpg", "jpeg", "png"],
        "video_formats": ["mp4"],
        "max_video_length_seconds": 60,
    },
    "celtra": {
        "max_headline_length": 45,
        "max_body_length": 100,
        "max_cta_length": 20,
        "required_fields": ["feedId", "creativeName"],
        "image_formats": ["jpg", "jpeg", "png", "gif", "svg"],
        "max_file_size_kb": 300,
    },
    "storyteq": {
        "max_headline_length": 60,
        "max_body_length": 150,
        "max_cta_length": 30,
        "required_fields": ["template_id", "output_name"],
        "image_formats": ["jpg", "jpeg", "png"],
        "video_formats": ["mp4", "mov"],
    },
    "google_studio": {
        "max_headline_length": 30,
        "max_body_length": 90,
        "max_cta_length": 15,
        "required_fields": ["Creative Name", "Exit URL"],
        "image_formats": ["jpg", "jpeg", "png", "gif"],
        "max_file_size_kb": 150,
    },
}


# ============================================================================
# VALIDATION FUNCTIONS
# ============================================================================

def validate_text_length(
    text: str, 
    max_length: int, 
    field_name: str, 
    row_id: str
) -> Optional[ValidationIssue]:
    """Validate text field length."""
    if not text:
        return None
    
    if len(text) > max_length:
        return ValidationIssue(
            row_id=row_id,
            field=field_name,
            severity=ValidationSeverity.ERROR,
            message=f"{field_name} exceeds maximum length of {max_length} characters (current: {len(text)})",
            suggestion=f"Shorten to {max_length} characters or less"
        )
    
    if len(text) > max_length * 0.9:
        return ValidationIssue(
            row_id=row_id,
            field=field_name,
            severity=ValidationSeverity.WARNING,
            message=f"{field_name} is close to maximum length ({len(text)}/{max_length})",
            suggestion="Consider shortening for readability"
        )
    
    return None


def validate_url(
    url: str, 
    field_name: str, 
    row_id: str,
    required: bool = False
) -> Optional[ValidationIssue]:
    """Validate URL format."""
    if not url:
        if required:
            return ValidationIssue(
                row_id=row_id,
                field=field_name,
                severity=ValidationSeverity.ERROR,
                message=f"{field_name} is required but missing",
                suggestion="Add a valid URL"
            )
        return None
    
    if not url.startswith(("http://", "https://")):
        return ValidationIssue(
            row_id=row_id,
            field=field_name,
            severity=ValidationSeverity.ERROR,
            message=f"{field_name} must start with http:// or https://",
            suggestion="Add protocol prefix to URL"
        )
    
    return None


def validate_image_format(
    url: str,
    allowed_formats: List[str],
    field_name: str,
    row_id: str
) -> Optional[ValidationIssue]:
    """Validate image file format."""
    if not url:
        return None
    
    extension = url.split(".")[-1].lower().split("?")[0]
    if extension not in allowed_formats:
        return ValidationIssue(
            row_id=row_id,
            field=field_name,
            severity=ValidationSeverity.WARNING,
            message=f"Image format '.{extension}' may not be supported. Allowed: {', '.join(allowed_formats)}",
            suggestion=f"Use one of: {', '.join(allowed_formats)}"
        )
    
    return None


def validate_color_hex(
    color: str,
    field_name: str,
    row_id: str
) -> Optional[ValidationIssue]:
    """Validate hex color format."""
    if not color:
        return None
    
    # Remove # if present
    color = color.lstrip("#")
    
    if len(color) not in [3, 6]:
        return ValidationIssue(
            row_id=row_id,
            field=field_name,
            severity=ValidationSeverity.ERROR,
            message=f"Invalid hex color format: {color}",
            suggestion="Use format #RRGGBB or #RGB"
        )
    
    try:
        int(color, 16)
    except ValueError:
        return ValidationIssue(
            row_id=row_id,
            field=field_name,
            severity=ValidationSeverity.ERROR,
            message=f"Invalid hex color characters: {color}",
            suggestion="Use only hexadecimal characters (0-9, A-F)"
        )
    
    return None


# ============================================================================
# MAIN VALIDATION FUNCTION
# ============================================================================

def validate_feed(
    rows: List[Dict[str, Any]],
    platform: str
) -> ValidationResult:
    """Validate a feed against platform-specific constraints."""
    
    if platform not in PLATFORM_CONSTRAINTS:
        return ValidationResult(
            is_valid=False,
            total_rows=len(rows),
            errors=1,
            warnings=0,
            issues=[ValidationIssue(
                row_id="",
                field="platform",
                severity=ValidationSeverity.ERROR,
                message=f"Unknown platform: {platform}",
                suggestion=f"Use one of: {', '.join(PLATFORM_CONSTRAINTS.keys())}"
            )],
            platform=platform,
            summary=f"Unknown platform: {platform}"
        )
    
    constraints = PLATFORM_CONSTRAINTS[platform]
    issues: List[ValidationIssue] = []
    
    for row in rows:
        row_id = row.get("row_id") or row.get("creative_id") or row.get("feedId") or str(rows.index(row))
        
        # Check required fields
        for field in constraints.get("required_fields", []):
            if not row.get(field):
                issues.append(ValidationIssue(
                    row_id=row_id,
                    field=field,
                    severity=ValidationSeverity.ERROR,
                    message=f"Required field '{field}' is missing",
                    suggestion=f"Add value for {field}"
                ))
        
        # Validate text lengths
        headline_fields = ["headline", "Headline", "copy_slot_a_text"]
        for field in headline_fields:
            if field in row:
                issue = validate_text_length(
                    row[field],
                    constraints.get("max_headline_length", 50),
                    field,
                    row_id
                )
                if issue:
                    issues.append(issue)
        
        body_fields = ["body", "description", "Body Copy", "copy_slot_b_text"]
        for field in body_fields:
            if field in row:
                issue = validate_text_length(
                    row[field],
                    constraints.get("max_body_length", 120),
                    field,
                    row_id
                )
                if issue:
                    issues.append(issue)
        
        cta_fields = ["cta", "cta_text", "CTA", "cta_button_text", "ctaLabel"]
        for field in cta_fields:
            if field in row:
                issue = validate_text_length(
                    row[field],
                    constraints.get("max_cta_length", 25),
                    field,
                    row_id
                )
                if issue:
                    issues.append(issue)
        
        # Validate URLs
        url_fields = [
            "click_url", "Click URL", "destination_url", "clickUrl",
            "click_through_url", "Exit URL"
        ]
        for field in url_fields:
            if field in row:
                is_required = field in constraints.get("required_fields", [])
                issue = validate_url(row[field], field, row_id, required=is_required)
                if issue:
                    issues.append(issue)
        
        # Validate image URLs
        image_fields = [
            "asset_slot_a_path", "asset_slot_b_path", "asset_slot_c_path",
            "Image 1 URL", "Image 2 URL", "heroImage", "image_1", "image_2"
        ]
        for field in image_fields:
            if field in row and row[field]:
                issue = validate_image_format(
                    row[field],
                    constraints.get("image_formats", ["jpg", "png"]),
                    field,
                    row_id
                )
                if issue:
                    issues.append(issue)
        
        # Validate colors
        color_fields = [
            "font_color_hex", "cta_bg_color_hex", "background_color_hex",
            "Background Color", "Font Color", "textColor", "backgroundColor"
        ]
        for field in color_fields:
            if field in row and row[field]:
                issue = validate_color_hex(row[field], field, row_id)
                if issue:
                    issues.append(issue)
    
    # Calculate summary
    errors = len([i for i in issues if i.severity == ValidationSeverity.ERROR])
    warnings = len([i for i in issues if i.severity == ValidationSeverity.WARNING])
    
    if errors == 0 and warnings == 0:
        summary = f"Feed is valid for {platform}. {len(rows)} rows passed all checks."
    elif errors == 0:
        summary = f"Feed is valid with {warnings} warnings. Review recommended."
    else:
        summary = f"Feed has {errors} errors that must be fixed before export."
    
    return ValidationResult(
        is_valid=errors == 0,
        total_rows=len(rows),
        errors=errors,
        warnings=warnings,
        issues=issues,
        platform=platform,
        summary=summary
    )
