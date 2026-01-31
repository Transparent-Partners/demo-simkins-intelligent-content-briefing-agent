from typing import List

from fastapi import APIRouter, HTTPException, Path
from pydantic import BaseModel

from app.models.production_matrix import ProductionAsset, ProductionBatch
from app.schemas.concepts import CreativeConcept
from app.schemas.production_matrix import ProductionJob
from app.schemas.strategic_matrix import StrategicMatrixRow
from app.services.matrix_builder import MatrixBuilder
from app.services.matrix_generator import (
    generate_production_plan,
    get_batch,
    update_asset_status,
)
from app.services.spec_service import get_all_specs


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


class MatrixBuilderRequest(BaseModel):
    """
    Frontend payload for the Production Matrix Builder.

    The UI selects one creative concept label and a set of spec IDs
    (from the spec library). The backend then groups those specs into
    consolidated ProductionJob tickets.
    """

    creative_concept: str
    spec_ids: List[str]
    
    # Optional brief context for production traceability
    campaign_name: str | None = None
    single_minded_proposition: str | None = None
    
    # Optional source type override for all jobs
    source_type: str | None = None  # "New Shoot", "Stock", "Existing", "UGC", "AI Generated"


class MatrixBuilderResponse(BaseModel):
    jobs: List[ProductionJob]
    
    # Summary for production planning
    total_jobs: int = 0
    total_destinations: int = 0
    consolidated_formats: List[str] = []


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


@router.post("/builder/jobs", response_model=MatrixBuilderResponse)
async def build_production_jobs(payload: MatrixBuilderRequest) -> MatrixBuilderResponse:
    """
    Production Matrix Builder endpoint.

    - Looks up the selected specs from the Spec Library (by ID).
    - Uses MatrixBuilder to collapse redundant specs into master ProductionJobs.
    - Returns the consolidated job list for display in the UI.
    - Now includes brief context (campaign name, SMP) for production traceability.
    - Consolidates safe zone guidance into production_notes field.

    Note: For this POC, jobs are not persisted to a real database; the
    frontend treats the response as the current working plan.
    """
    try:
        all_specs = get_all_specs()
        spec_by_id = {spec.id: spec for spec in all_specs}

        selected_specs: List[dict] = []
        for sid in payload.spec_ids:
            spec = spec_by_id.get(sid)
            if spec:
                selected_specs.append(spec.model_dump())

        if not selected_specs:
            raise HTTPException(status_code=400, detail="No valid specs found for the provided spec_ids.")

        builder = MatrixBuilder()
        jobs = builder.group_specs_by_creative(
            selected_specs=selected_specs,
            creative_concept=payload.creative_concept,
            campaign_name=payload.campaign_name,
            single_minded_proposition=payload.single_minded_proposition,
        )
        
        # Apply source_type override if provided
        if payload.source_type:
            for job in jobs:
                job.source_type = payload.source_type
        
        # Calculate summary metrics
        total_destinations = sum(len(job.destinations) for job in jobs)
        consolidated_formats = list(set(job.asset_type for job in jobs))
        
        return MatrixBuilderResponse(
            jobs=jobs,
            total_jobs=len(jobs),
            total_destinations=total_destinations,
            consolidated_formats=consolidated_formats,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


