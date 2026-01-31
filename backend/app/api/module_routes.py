"""
Module Library and Platform Export API Routes
"""
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.schemas.modules import (
    Module, ModuleType, ModuleVariation, ModuleLibraryState,
    DecisionRule, DecisioningLogic, ProductionTicket, TicketStatus,
    PlatformId, PlatformExport, ExportRow, FeedStructure
)
from app.services.platform_export import (
    generate_platform_export, convert_feed_rows_to_export_rows
)
from app.schemas.feed import AssetFeedRow
from app.services.feed_validator import validate_feed, ValidationResult


router = APIRouter(prefix="/modules", tags=["modules"])


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class CreateModuleRequest(BaseModel):
    type: ModuleType
    name: str
    description: str
    format: str = "image"
    source_type: str = "new_shoot"


class UpdateModuleRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    variations: Optional[List[ModuleVariation]] = None


class CreateRuleRequest(BaseModel):
    name: str
    description: Optional[str] = None
    priority: int = 100
    conditions: List[dict]
    condition_logic: str = "AND"
    action: dict


class ExportRequest(BaseModel):
    platform: PlatformId
    campaign_name: str
    feed_rows: List[dict]
    rules: Optional[List[dict]] = None
    concept_map: Optional[dict] = None
    production_job_map: Optional[dict] = None


class ExportResponse(BaseModel):
    platform: str
    format: str
    filename: str
    content: str
    row_count: int
    validation_passed: bool
    validation_errors: List[str] = []
    warnings: List[str] = []


# ============================================================================
# MODULE LIBRARY ENDPOINTS
# ============================================================================

@router.get("/library")
async def get_module_library() -> dict:
    """Get the full module library with taxonomy."""
    
    return {
        "taxonomy": {
            "hook": {
                "label": "Hook",
                "description": "Opening attention-grabber in first 3 seconds",
                "color": "purple",
                "typical_duration": "2-3s",
                "common_variations": ["Emotional", "Question", "Statistic", "Problem", "Bold claim"],
            },
            "value_prop": {
                "label": "Value Proposition",
                "description": "Core benefit or differentiator",
                "color": "blue",
                "common_variations": ["Functional", "Emotional", "Social", "Financial"],
            },
            "proof_point": {
                "label": "Proof Point",
                "description": "Evidence, testimonials, or social proof",
                "color": "green",
                "common_variations": ["Testimonial", "Statistic", "Award", "Review", "Case study"],
            },
            "product": {
                "label": "Product",
                "description": "Product visualization or demonstration",
                "color": "orange",
                "common_variations": ["Hero shot", "In-use", "Detail", "Comparison", "Unboxing"],
            },
            "offer": {
                "label": "Offer",
                "description": "Promotional offer, pricing, or incentive",
                "color": "red",
                "common_variations": ["Discount", "Bundle", "Free trial", "Limited time", "Exclusive"],
            },
            "cta": {
                "label": "CTA",
                "description": "Call to action driving next step",
                "color": "pink",
                "common_variations": ["Shop now", "Learn more", "Sign up", "Get started", "Book now"],
            },
            "background": {
                "label": "Background",
                "description": "Visual backdrop or environment",
                "color": "slate",
                "common_variations": ["Solid", "Gradient", "Lifestyle", "Abstract", "Brand pattern"],
            },
            "logo": {
                "label": "Logo",
                "description": "Brand logo treatment",
                "color": "slate",
                "common_variations": ["Primary", "Reversed", "Stacked", "Horizontal", "Animated"],
            },
            "legal": {
                "label": "Legal",
                "description": "Disclaimers and compliance text",
                "color": "slate",
                "common_variations": ["Standard", "Industry-specific", "Promotional", "Financial"],
            },
            "audio": {
                "label": "Audio",
                "description": "Voiceover, music, or sound effects",
                "color": "cyan",
                "common_variations": ["Voiceover", "Music bed", "SFX", "Sonic logo"],
            },
            "end_card": {
                "label": "End Card",
                "description": "Closing frame with brand lockup",
                "color": "indigo",
                "typical_duration": "2-3s",
                "common_variations": ["Standard", "With offer", "With CTA", "Animated"],
            },
            "transition": {
                "label": "Transition",
                "description": "Motion between content modules",
                "color": "violet",
                "typical_duration": "0.5-1s",
                "common_variations": ["Cut", "Fade", "Wipe", "Zoom", "Slide"],
            },
        },
        "formats": ["text", "image", "video", "audio", "html5", "lottie"],
        "source_types": ["new_shoot", "existing_asset", "ugc", "stock", "ai_generated", "template"],
        "funnel_stages": ["awareness", "consideration", "conversion", "retention"],
    }


@router.post("/create")
async def create_module(request: CreateModuleRequest) -> Module:
    """Create a new module in the library."""
    
    import uuid
    from datetime import datetime
    
    module = Module(
        id=str(uuid.uuid4()),
        type=request.type,
        name=request.name,
        description=request.description,
        format=request.format,
        source_type=request.source_type,
        variations=[],
        specs={},
        reuse_count=0,
        used_in_cells=[],
        created_at=datetime.now().isoformat(),
        updated_at=datetime.now().isoformat(),
    )
    
    return module


# ============================================================================
# DECISIONING LOGIC ENDPOINTS
# ============================================================================

@router.get("/decisioning/operators")
async def get_decisioning_operators() -> dict:
    """Get available operators and condition types for decisioning rules."""
    
    return {
        "condition_types": [
            {"id": "audience", "label": "Audience Segment", "description": "Target specific audience segments"},
            {"id": "funnel_stage", "label": "Funnel Stage", "description": "Awareness, Consideration, Conversion, Retention"},
            {"id": "trigger", "label": "Contextual Trigger", "description": "Context-based triggers"},
            {"id": "platform", "label": "Platform", "description": "Media platform (Meta, Google, etc.)"},
            {"id": "placement", "label": "Placement", "description": "Ad placement type"},
            {"id": "daypart", "label": "Daypart", "description": "Time of day targeting"},
            {"id": "geo", "label": "Geography", "description": "Location-based targeting"},
            {"id": "weather", "label": "Weather", "description": "Weather-based triggers"},
            {"id": "custom", "label": "Custom", "description": "Custom data field"},
        ],
        "operators": [
            {"id": "equals", "label": "Equals", "description": "Exact match"},
            {"id": "not_equals", "label": "Not Equals", "description": "Does not match"},
            {"id": "contains", "label": "Contains", "description": "Contains substring"},
            {"id": "not_contains", "label": "Does Not Contain", "description": "Does not contain substring"},
            {"id": "in", "label": "In List", "description": "Value is in list"},
            {"id": "not_in", "label": "Not In List", "description": "Value is not in list"},
            {"id": "greater_than", "label": "Greater Than", "description": "Numeric comparison"},
            {"id": "less_than", "label": "Less Than", "description": "Numeric comparison"},
        ],
        "logic_options": ["AND", "OR"],
    }


@router.post("/decisioning/validate")
async def validate_decisioning_rules(rules: List[dict]) -> dict:
    """Validate a set of decisioning rules."""
    
    errors = []
    warnings = []
    
    for i, rule in enumerate(rules):
        if not rule.get("name"):
            errors.append(f"Rule {i+1}: Missing name")
        if not rule.get("conditions"):
            errors.append(f"Rule {i+1}: No conditions defined")
        if not rule.get("action"):
            errors.append(f"Rule {i+1}: No action defined")
        
        # Check for duplicate priorities
        priorities = [r.get("priority", 100) for r in rules]
        if priorities.count(rule.get("priority", 100)) > 1:
            warnings.append(f"Rule {i+1}: Duplicate priority {rule.get('priority', 100)}")
    
    return {
        "is_valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "rule_count": len(rules),
    }


# ============================================================================
# PLATFORM EXPORT ENDPOINTS
# ============================================================================

@router.get("/platforms")
async def get_available_platforms() -> dict:
    """Get available DCO and production automation platforms."""
    
    return {
        "platforms": [
            {
                "id": "flashtalking",
                "name": "Flashtalking",
                "category": "dco",
                "feed_format": "csv",
                "supports": ["display", "video", "ctv", "social"],
                "capabilities": ["real_time_decisioning", "sequential_messaging", "ab_testing"],
            },
            {
                "id": "innovid",
                "name": "Innovid",
                "category": "dco",
                "feed_format": "json",
                "supports": ["display", "video", "ctv", "audio"],
                "capabilities": ["real_time_decisioning", "sequential_messaging", "ab_testing"],
            },
            {
                "id": "clinch",
                "name": "Clinch",
                "category": "dco",
                "feed_format": "csv",
                "supports": ["display", "video", "ctv", "social"],
                "capabilities": ["real_time_decisioning", "sequential_messaging"],
            },
            {
                "id": "celtra",
                "name": "Celtra",
                "category": "production_automation",
                "feed_format": "json",
                "supports": ["display", "video", "ctv", "social"],
                "capabilities": ["feed_based_versioning", "dynamic_text", "dynamic_images"],
            },
            {
                "id": "storyteq",
                "name": "Storyteq",
                "category": "production_automation",
                "feed_format": "csv",
                "supports": ["display", "video", "social"],
                "capabilities": ["feed_based_versioning", "dynamic_video"],
            },
            {
                "id": "google_studio",
                "name": "Google Creative Studio",
                "category": "production_automation",
                "feed_format": "csv",
                "supports": ["display", "video"],
                "capabilities": ["feed_based_versioning", "dynamic_text", "dynamic_images"],
            },
        ],
        "categories": {
            "dco": "Dynamic Creative Optimization - Real-time decisioning and personalization",
            "production_automation": "Production Automation - Feed-based asset generation at scale",
        }
    }


@router.post("/export")
async def export_to_platform(request: ExportRequest) -> ExportResponse:
    """Generate a platform-specific export."""
    
    # Convert feed rows to export rows
    feed_rows = [AssetFeedRow(**row) for row in request.feed_rows]
    export_rows = convert_feed_rows_to_export_rows(
        feed_rows,
        concept_map=request.concept_map,
        production_job_map=request.production_job_map
    )
    
    # Parse rules if provided
    rules = []
    if request.rules:
        from app.schemas.modules import DecisionRule, DecisionCondition, RuleAction, ConditionType, Operator, ModuleType
        for rule_data in request.rules:
            conditions = [
                DecisionCondition(
                    type=ConditionType(c["type"]),
                    operator=Operator(c["operator"]),
                    value=c["value"],
                    field=c.get("field")
                )
                for c in rule_data.get("conditions", [])
            ]
            action_data = rule_data.get("action", {})
            action = RuleAction(
                module_type=ModuleType(action_data.get("module_type", "hook")),
                module_id=action_data.get("module_id", ""),
                variation_id=action_data.get("variation_id", "")
            )
            rules.append(DecisionRule(
                id=rule_data.get("id", ""),
                name=rule_data.get("name", ""),
                description=rule_data.get("description"),
                priority=rule_data.get("priority", 100),
                conditions=conditions,
                condition_logic=rule_data.get("condition_logic", "AND"),
                action=action,
                is_active=rule_data.get("is_active", True)
            ))
    
    # Generate export
    export = generate_platform_export(
        platform=request.platform,
        rows=export_rows,
        rules=rules,
        campaign_name=request.campaign_name
    )
    
    # Get export content
    from app.services.platform_export import (
        generate_flashtalking_export, generate_innovid_export,
        generate_celtra_export, generate_storyteq_export, generate_google_studio_export
    )
    
    generators = {
        PlatformId.FLASHTALKING: generate_flashtalking_export,
        PlatformId.INNOVID: generate_innovid_export,
        PlatformId.CELTRA: generate_celtra_export,
        PlatformId.STORYTEQ: generate_storyteq_export,
        PlatformId.GOOGLE_STUDIO: generate_google_studio_export,
        PlatformId.CLINCH: generate_flashtalking_export,
        PlatformId.SIZMEK: generate_flashtalking_export,
        PlatformId.JIVOX: generate_innovid_export,
        PlatformId.ADFORM: generate_flashtalking_export,
    }
    
    generator = generators.get(request.platform)
    if not generator:
        raise HTTPException(status_code=400, detail=f"Unsupported platform: {request.platform}")
    
    result = generator(export_rows, rules, request.campaign_name)
    
    return ExportResponse(
        platform=request.platform.value,
        format=result["format"],
        filename=result["filename"],
        content=result["content"],
        row_count=result["row_count"],
        validation_passed=export.validation_passed,
        validation_errors=export.validation_errors,
        warnings=export.warnings,
    )


# ============================================================================
# PRODUCTION TICKET ENDPOINTS
# ============================================================================

@router.get("/tickets/statuses")
async def get_ticket_statuses() -> dict:
    """Get available production ticket statuses and workflow."""
    
    return {
        "statuses": [
            {"id": "backlog", "label": "Backlog", "color": "slate", "description": "Not yet started"},
            {"id": "ready", "label": "Ready", "color": "blue", "description": "Ready to begin production"},
            {"id": "in_progress", "label": "In Progress", "color": "amber", "description": "Currently being worked on"},
            {"id": "in_review", "label": "In Review", "color": "purple", "description": "Awaiting approval"},
            {"id": "approved", "label": "Approved", "color": "green", "description": "Approved for delivery"},
            {"id": "delivered", "label": "Delivered", "color": "emerald", "description": "Delivered to platform"},
        ],
        "workflow": {
            "backlog": ["ready"],
            "ready": ["in_progress", "backlog"],
            "in_progress": ["in_review", "ready"],
            "in_review": ["approved", "in_progress"],
            "approved": ["delivered", "in_review"],
            "delivered": [],
        },
        "priorities": [
            {"id": "critical", "label": "Critical", "color": "red"},
            {"id": "high", "label": "High", "color": "orange"},
            {"id": "medium", "label": "Medium", "color": "yellow"},
            {"id": "low", "label": "Low", "color": "slate"},
        ]
    }


@router.get("/funnel-stages")
async def get_funnel_stages() -> dict:
    """Get funnel stages for audience mapping."""
    
    return {
        "stages": [
            {
                "id": "awareness",
                "label": "Awareness",
                "description": "Building brand/product awareness",
                "color": "purple",
                "typical_content": ["Hook", "Brand story", "Problem statement"],
                "typical_ctas": ["Learn More", "Watch Video", "Discover"],
            },
            {
                "id": "consideration",
                "label": "Consideration",
                "description": "Educating and nurturing interest",
                "color": "blue",
                "typical_content": ["Value proposition", "Features", "Social proof"],
                "typical_ctas": ["Compare", "See How It Works", "Read Reviews"],
            },
            {
                "id": "conversion",
                "label": "Conversion",
                "description": "Driving action and purchase",
                "color": "green",
                "typical_content": ["Offer", "Urgency", "Trust signals"],
                "typical_ctas": ["Buy Now", "Sign Up", "Get Started", "Book Now"],
            },
            {
                "id": "retention",
                "label": "Retention",
                "description": "Retaining and re-engaging customers",
                "color": "amber",
                "typical_content": ["Cross-sell", "Loyalty", "Updates"],
                "typical_ctas": ["Upgrade", "Refer a Friend", "Renew"],
            },
        ]
    }


# ============================================================================
# FEED VALIDATION ENDPOINTS
# ============================================================================

class ValidateFeedRequest(BaseModel):
    platform: str
    feed_rows: List[dict]


class ValidationIssueResponse(BaseModel):
    row_id: str
    field: str
    severity: str
    message: str
    suggestion: Optional[str] = None


class ValidateFeedResponse(BaseModel):
    is_valid: bool
    total_rows: int
    errors: int
    warnings: int
    issues: List[ValidationIssueResponse]
    platform: str
    summary: str


@router.post("/feed/validate")
async def validate_feed_endpoint(request: ValidateFeedRequest) -> ValidateFeedResponse:
    """Validate a feed against platform-specific constraints."""
    
    result = validate_feed(request.feed_rows, request.platform)
    
    return ValidateFeedResponse(
        is_valid=result.is_valid,
        total_rows=result.total_rows,
        errors=result.errors,
        warnings=result.warnings,
        issues=[
            ValidationIssueResponse(
                row_id=i.row_id,
                field=i.field,
                severity=i.severity.value,
                message=i.message,
                suggestion=i.suggestion
            )
            for i in result.issues
        ],
        platform=result.platform,
        summary=result.summary
    )


@router.get("/feed/constraints/{platform}")
async def get_platform_constraints(platform: str) -> dict:
    """Get the validation constraints for a specific platform."""
    
    from app.services.feed_validator import PLATFORM_CONSTRAINTS
    
    if platform not in PLATFORM_CONSTRAINTS:
        raise HTTPException(status_code=404, detail=f"Unknown platform: {platform}")
    
    constraints = PLATFORM_CONSTRAINTS[platform]
    
    return {
        "platform": platform,
        "constraints": constraints,
        "fields": {
            "text_limits": {
                "headline": constraints.get("max_headline_length"),
                "body": constraints.get("max_body_length"),
                "cta": constraints.get("max_cta_length"),
            },
            "required_fields": constraints.get("required_fields", []),
            "allowed_formats": {
                "image": constraints.get("image_formats", []),
                "video": constraints.get("video_formats", []),
            },
            "file_limits": {
                "max_size_kb": constraints.get("max_file_size_kb"),
                "max_video_length_seconds": constraints.get("max_video_length_seconds"),
            }
        }
    }
