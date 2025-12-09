from typing import List

from pydantic import BaseModel, Field


class StrategicMatrixRow(BaseModel):
    """
    One 'Strategy Card' for an audience segment.
    Defines WHO they are, WHY they matter, and WHAT we should say.
    """

    # --- 1. IDENTITY BLOCK (The "Who") ---

    segment_source: str = Field(
        ...,
        description=(
            "Source of the audience (e.g., '1st Party (CRM/Email List)', "
            "'Retargeting (Pixel Data)', 'Lookalike (1% - 5%)', '3rd Party Interest', "
            "'Broad / Prospecting')."
        ),
    )

    segment_id: str = Field(
        ...,
        description="System-generated UUID or unique key for this segment.",
    )

    segment_name: str = Field(
        ...,
        description="Short human-readable name for the segment (e.g., 'High-Value Loyalists').",
    )

    segment_size: str = Field(
        ...,
        description="Approximate audience size (e.g., '50k', '1.2M').",
    )

    priority_level: str = Field(
        ...,
        description=(
            "Priority tier for this segment (e.g., 'Tier 1 (Bespoke)', "
            "'Tier 2 (Stock/Mix)', 'Tier 3 (Automated Adaptation)')."
        ),
    )

    # --- 2. STRATEGIC CORE (The "Why") ---

    segment_description: str = Field(
        ...,
        description="Who they are as humans; qualitative description of this audience.",
    )

    key_insight: str = Field(
        ...,
        description="Deep truth or friction point this strategy is solving.",
    )

    current_perception: str = Field(
        ...,
        description="What they believe or feel about the brand today.",
    )

    desired_perception: str = Field(
        ...,
        description="What we want them to believe or feel after exposure.",
    )

    # --- 3. MESSAGE ARCHITECTURE (The "What") ---

    primary_message_pillar: str = Field(
        ...,
        description="Primary message angle for this segment (e.g., 'Reliability > Speed').",
    )

    call_to_action_objective: str = Field(
        ...,
        description=(
            "Desired behavioral objective for the CTA "
            "(e.g., 'Shop Now', 'Learn More', 'Sign Up', 'Watch Video', 'Get Quote')."
        ),
    )

    tone_guardrails: str = Field(
        ...,
        description="Tone and voice constraints (e.g., 'Serious, Technical, No fluff').",
    )

    # --- 4. CHANNEL & FORMAT SELECTION (The "Where") ---

    platform_environments: List[str] = Field(
        ...,
        description=(
            "List of platform environments selected for this segment "
            "(e.g., ['Meta: Stories/Reels (9:16)', 'TikTok: In-Feed (9:16)'])."
        ),
    )

    contextual_triggers: str = Field(
        ...,
        description="Context/behavior triggers for this strategy (e.g., 'Abandoned Cart', 'Weather = Rain').",
    )

    # --- SYSTEM FIELDS (Auto / Hidden) ---

    asset_id: str | None = Field(
        default=None,
        description="Optional system asset ID for downstream mapping.",
    )

    specs_lookup_key: str | None = Field(
        default=None,
        description="Optional key into the spec library used for downstream build.",
    )

    notes: str | None = Field(
        default=None,
        description="System or strategist notes that do not need to show in every UI.",
    )


class AudienceContentMatrix(BaseModel):
    """
    The full output object containing the list of strategic decisions.
    """

    campaign_name: str
    decision_rows: List[StrategicMatrixRow]


