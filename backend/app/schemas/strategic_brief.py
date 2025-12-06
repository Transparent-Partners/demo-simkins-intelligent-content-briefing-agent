from typing import List, Optional
from pydantic import BaseModel, Field

class AssetRequirement(BaseModel):
    asset_id: str = Field(description="Unique ID for the asset (e.g., VID-001)")
    format: str = Field(description="Format required (e.g., 9:16 Video, 1:1 Image)")
    concept: str = Field(description="Creative focus of this specific asset")
    source_type: str = Field(description="E.g., 'Stock', 'New Shoot', 'Existing Asset'")
    specs: str = Field(description="Technical specs (e.g., 1080x1920, max 15s)")

class LogicRule(BaseModel):
    condition: str = Field(description="The trigger (e.g., IF Audience = 'Retargeting')")
    action: str = Field(description="The result (e.g., SHOW 'Discount' Variant)")

class ProductionMasterPlan(BaseModel):
    campaign_name: str = Field(description="Name of the campaign")
    single_minded_proposition: str = Field(description="The one key message")
    primary_audience: str = Field(description="Target audience definition")
    
    # The Bill of Materials
    bill_of_materials: List[AssetRequirement] = Field(description="List of all raw ingredients needed")
    
    # The Logic Map
    logic_map: List[LogicRule] = Field(description="Rules for dynamic assembly")
    
    production_notes: Optional[str] = Field(description="Guardrails and constraints")

