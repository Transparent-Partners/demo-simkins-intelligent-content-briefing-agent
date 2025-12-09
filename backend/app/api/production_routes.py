from typing import List

from fastapi import APIRouter, HTTPException, Path
from pydantic import BaseModel

from app.models.production_matrix import ProductionAsset, ProductionBatch
from app.schemas.concepts import CreativeConcept
from app.schemas.strategic_matrix import StrategicMatrixRow
from app.services.matrix_generator import (
    generate_production_plan,
    get_batch,
    update_asset_status,
)


router = APIRouter()


class GenerateProductionRequest(BaseModel):
    campaign_id: str
    strategy: StrategicMatrixRow
    concept: CreativeConcept
    batch_name: str | None = None
    source_asset_requirements: str | None = None
    adaptation_instruction: str | None = None


class GenerateProductionResponse(BaseModel):
    batch: ProductionBatch
    assets: List[ProductionAsset]


class BatchResponse(BaseModel):
    batch: ProductionBatch
    assets: List[ProductionAsset]


class UpdateStatusRequest(BaseModel):
    status: str


class UpdateStatusResponse(BaseModel):
    asset: ProductionAsset


@router.post("/generate", response_model=GenerateProductionResponse)
async def generate_production(request: GenerateProductionRequest) -> GenerateProductionResponse:
    """
    Trigger the Production Matrix 'explosion' for a given Strategy row + Concept.
    """
    try:
        batch, assets = generate_production_plan(
            campaign_id=request.campaign_id,
            strategy=request.strategy,
            concept=request.concept,
            batch_name=request.batch_name,
            source_asset_requirements=request.source_asset_requirements,
            adaptation_instruction=request.adaptation_instruction,
        )
        return GenerateProductionResponse(batch=batch, assets=assets)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/batch/{batch_id}", response_model=BatchResponse)
async def get_production_batch(batch_id: str = Path(..., description="ID of the production batch")) -> BatchResponse:
    """
    Return a ProductionBatch and all associated ProductionAssets.
    """
    batch, assets = get_batch(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return BatchResponse(batch=batch, assets=assets)


@router.patch("/asset/{asset_id}/status", response_model=UpdateStatusResponse)
async def patch_asset_status(
    asset_id: str = Path(..., description="ID of the production asset to update"),
    payload: UpdateStatusRequest = ...,
) -> UpdateStatusResponse:
    """
    Update the workflow status for a ProductionAsset (e.g., Todo -> In_Progress).
    """
    asset = update_asset_status(asset_id, payload.status)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return UpdateStatusResponse(asset=asset)


