from fastapi import FastAPI, HTTPException, UploadFile, File, Response
from pydantic import BaseModel
from typing import List, Dict, Any, Optional, Literal
from app.agent_core import process_message
from app.feed_generator import generate_dco_feed
from app.api.brief_routes import router as brief_router
from app.api.matrix_routes import router as matrix_router
from app.api.concept_routes import router as concept_router
from app.api.spec_routes import router as spec_router
from app.api.production_routes import router as production_router
from app.schemas.feed import AssetFeedRow
from fastapi.middleware.cors import CORSMiddleware
import aiofiles
import os
import json
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
import io
import csv
from io import StringIO

app = FastAPI(title="Intelligent Briefing Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(brief_router, prefix="/brief", tags=["brief"])
app.include_router(matrix_router, prefix="/matrix", tags=["matrix"])
app.include_router(concept_router, prefix="/concepts", tags=["concepts"])
app.include_router(spec_router, prefix="/specs", tags=["specs"])
app.include_router(production_router, prefix="/production", tags=["production"])


@app.get("/")
async def root():
  """
  Lightweight root so hitting the base URL doesn't return 404.
  """
  return {
    "service": "Intelligent Briefing Agent",
    "status": "ok",
    "endpoints": ["/docs", "/chat", "/brief/chat", "/matrix", "/concepts", "/specs", "/production"],
  }

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    history: List[ChatMessage]
    current_plan: Dict[str, Any] = {}

class ExportRequest(BaseModel):
    plan: Dict[str, Any]


class GenerateAssetRequest(BaseModel):
    kind: Literal["image", "video", "copy"]
    prompt: str
    # In a future iteration we could also accept campaign / brand context here
    # and use it to condition the image / video generation call.


class GenerateAssetResponse(BaseModel):
    kind: Literal["image", "video", "copy"]
    prompt: str
    status: str
    # Placeholder for future URLs or IDs returned from GCP creative services.
    asset_url: Optional[str] = None
    job_id: Optional[str] = None
    error: Optional[str] = None


class CheckVideoJobRequest(BaseModel):
    job_id: str


class CheckVideoJobResponse(BaseModel):
    status: str
    asset_url: Optional[str] = None
    job_id: str
    error: Optional[str] = None


class GenerateFeedRequest(BaseModel):
    audience_strategy: List[Dict[str, Any]]
    asset_list: List[Dict[str, Any]]
    media_plan_rows: List[Dict[str, Any]]


class GenerateFeedResponse(BaseModel):
    feed: List[AssetFeedRow]

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        reply = await process_message(
            [msg.dict() for msg in request.history], 
            request.current_plan
        )
        return {"reply": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate-asset", response_model=GenerateAssetResponse)
async def generate_asset(request: GenerateAssetRequest):
    """
    Generate images or videos using Google Cloud Vertex AI (Imagen for images, Veo for videos).
    
    This endpoint connects to Vertex AI to generate creative assets based on prompts
    from the concept canvas.
    """
    try:
        from app.services.asset_generator import generate_image, generate_video
        
        if request.kind == "image":
            result = generate_image(prompt=request.prompt)
            return GenerateAssetResponse(
                kind=request.kind,
                prompt=request.prompt,
                status=result.get("status", "error"),
                asset_url=result.get("asset_url"),
            )
        elif request.kind == "video":
            result = generate_video(prompt=request.prompt)
            return GenerateAssetResponse(
                kind=request.kind,
                prompt=request.prompt,
                status=result.get("status", "error"),
                asset_url=result.get("asset_url"),
                job_id=result.get("job_id"),
                error=result.get("error"),
            )
        else:
            # For "copy" or other types, return as-is (no generation needed)
            return GenerateAssetResponse(
                kind=request.kind,
                prompt=request.prompt,
                status="completed",
                asset_url=None,
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/check-video-job", response_model=CheckVideoJobResponse)
async def check_video_job(request: CheckVideoJobRequest):
    """
    Check the status of a video generation job.
    
    Video generation is asynchronous and may take several minutes.
    Use this endpoint to poll for completion.
    """
    try:
        from app.services.asset_generator import check_video_job_status
        
        result = check_video_job_status(request.job_id)
        return CheckVideoJobResponse(
            status=result.get("status", "error"),
            asset_url=result.get("asset_url"),
            job_id=request.job_id,
            error=result.get("error"),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate-feed", response_model=GenerateFeedResponse)
async def generate_feed(request: GenerateFeedRequest) -> GenerateFeedResponse:
    """
    Turn strategy + concepts + media plan rows into a structured DCO feed.

    This is intentionally simple: it walks the media rows and, for each one,
    looks up the best-matching headline (from `audience_strategy`) and image /
    exit URL (from `asset_list`) by audience. The exact shapes of those inputs
    can evolve over time as long as they expose reasonable `audience` /
    `headline` / `image_url` / `exit_url` style keys.
    """
    try:
        feed_rows = generate_dco_feed(
            audience_strategy=request.audience_strategy,
            asset_list=request.asset_list,
            media_plan_rows=request.media_plan_rows,
        )
        return GenerateFeedResponse(feed=feed_rows)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        raw_bytes = await file.read()
        filename = file.filename or "uploaded_file"
        lower_name = filename.lower()

        # Text and markdown files – simple text content
        if lower_name.endswith(".txt") or lower_name.endswith(".md"):
            content = raw_bytes.decode("utf-8", errors="ignore")
            # Truncate to keep payloads small
            return {
                "filename": filename,
                "kind": "text",
                "content": content[:5000],
            }

        # CSV files – treat as structured audience matrix
        if lower_name.endswith(".csv"):
            text = raw_bytes.decode("utf-8", errors="ignore")
            f = StringIO(text)
            reader = csv.reader(f)
            headers = next(reader, [])

            rows: List[Dict[str, Any]] = []
            for row in reader:
                # Skip completely empty rows
                if not any(cell.strip() for cell in row):
                    continue
                row_dict: Dict[str, Any] = {}
                for idx, value in enumerate(row):
                    key = headers[idx] if idx < len(headers) else f"col_{idx}"
                    row_dict[key] = value
                rows.append(row_dict)

            return {
                "filename": filename,
                "kind": "audience_matrix",
                "headers": headers,
                "rows": rows,
                # Short preview string the frontend can show/send to the agent
                "content": text[:5000],
            }

        # Fallback for other file types – binary placeholder for now
        content = f"[File Uploaded: {filename}] (Content extraction pending integration)"
        return {
            "filename": filename,
            "kind": "unknown",
            "content": content,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/export/pdf")
async def export_pdf(request: ExportRequest):
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    y = height - 50
    
    p.setFont("Helvetica-Bold", 16)
    p.drawString(50, y, f"Production Master Plan: {request.plan.get('campaign_name', 'Untitled')}")
    y -= 30
    
    p.setFont("Helvetica", 12)
    
    def draw_text(text, x, y_pos):
        # Simple text wrapping could be added here
        p.drawString(x, y_pos, str(text))
        return y_pos - 15

    if 'single_minded_proposition' in request.plan:
        y = draw_text(f"SMP: {request.plan['single_minded_proposition']}", 50, y)
        y -= 10
        
    if 'bill_of_materials' in request.plan:
        p.setFont("Helvetica-Bold", 14)
        y = draw_text("Bill of Materials:", 50, y)
        p.setFont("Helvetica", 12)
        for item in request.plan['bill_of_materials']:
            y = draw_text(f"- {item.get('asset_id')}: {item.get('concept')} ({item.get('format')})", 70, y)
            if y < 50:
                p.showPage()
                y = height - 50
    
    p.save()
    buffer.seek(0)
    return Response(content=buffer.getvalue(), media_type="application/pdf", headers={"Content-Disposition": "attachment; filename=brief.pdf"})

@app.post("/export/txt")
async def export_txt(request: ExportRequest):
    plan = request.plan
    lines: list[str] = []

    lines.append(f"Production Master Plan: {plan.get('campaign_name', 'Untitled')}")
    lines.append("=" * 50)
    lines.append("")

    lines.append(f"SMP: {plan.get('single_minded_proposition', 'N/A')}")
    lines.append("")

    narrative = plan.get("narrative_brief")
    if narrative:
        lines.append("Narrative Brief:")
        lines.append(narrative)
        lines.append("")

    lines.append("Bill of Materials:")
    for item in plan.get("bill_of_materials", []):
        lines.append(f"- {item.get('asset_id')}: {item.get('concept')} ({item.get('format')})")
    lines.append("")

    # Optional content matrix section for production teams
    matrix = plan.get("content_matrix") or []
    if matrix:
        lines.append("Content Matrix (rows map assets to audience / triggers / channels):")
        for row in matrix:
            summary = (
                f"- asset={row.get('asset_id')} | "
                f"audience={row.get('audience_segment')} | "
                f"stage={row.get('funnel_stage')} | "
                f"trigger={row.get('trigger')} | "
                f"channel={row.get('channel')} | "
                f"format={row.get('format')} | "
                f"message={row.get('message')}"
            )
            lines.append(summary)

    content = "\n".join(lines) + "\n"
    return Response(content=content, media_type="text/plain", headers={"Content-Disposition": "attachment; filename=brief.txt"})
