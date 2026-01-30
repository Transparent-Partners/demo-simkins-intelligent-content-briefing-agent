from fastapi import FastAPI, HTTPException, UploadFile, File, Response, Form, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, field_validator
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
import asyncio
import os
import json
import logging
import time
import uuid
import re
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
import io
import csv
from io import StringIO

# ============================================================================
# SENTRY ERROR MONITORING
# ============================================================================
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

SENTRY_DSN = os.getenv("SENTRY_DSN")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        environment=ENVIRONMENT,
        integrations=[
            StarletteIntegration(transaction_style="endpoint"),
            FastApiIntegration(transaction_style="endpoint"),
        ],
        traces_sample_rate=0.1 if ENVIRONMENT == "production" else 1.0,
        profiles_sample_rate=0.1 if ENVIRONMENT == "production" else 1.0,
        send_default_pii=False,  # Don't send PII to Sentry
    )

app = FastAPI(
    title="Intelligent Briefing Agent",
    version=os.getenv("APP_VERSION", "1.0.0"),
    docs_url="/docs" if ENVIRONMENT != "production" else None,  # Disable docs in production
    redoc_url="/redoc" if ENVIRONMENT != "production" else None,
)

# Use structured logging in production
from app.utils.logging import logger as structured_logger, log_request
logger = logging.getLogger("app")

RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))
RATE_LIMIT_MAX_REQUESTS = int(os.getenv("RATE_LIMIT_MAX_REQUESTS", "120"))
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "10"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

_rate_limit_lock = asyncio.Lock()
_rate_limit_buckets: dict[str, dict[str, float | int]] = {}


def _error_payload(code: str, message: str, request_id: str, details: Any | None = None) -> dict:
    payload = {"error": {"code": code, "message": message, "request_id": request_id}}
    if details is not None:
        payload["error"]["details"] = details
    return payload


@app.middleware("http")
async def request_context_and_rate_limit(request: Request, call_next):
    request_id = uuid.uuid4().hex
    request.state.request_id = request_id
    start_time = time.perf_counter()

    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "")
    now = time.time()

    async with _rate_limit_lock:
        bucket = _rate_limit_buckets.get(client_ip)
        if not bucket or now - float(bucket["start"]) >= RATE_LIMIT_WINDOW_SECONDS:
            bucket = {"start": now, "count": 0}
            _rate_limit_buckets[client_ip] = bucket

        bucket["count"] = int(bucket["count"]) + 1
        if int(bucket["count"]) > RATE_LIMIT_MAX_REQUESTS:
            return JSONResponse(
                status_code=429,
                content=_error_payload(
                    code="rate_limited",
                    message="Rate limit exceeded. Please retry shortly.",
                    request_id=request_id,
                ),
                headers={"X-Request-ID": request_id},
            )

    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    
    # Log request (skip health checks to reduce noise)
    if request.url.path not in ["/health", "/ready", "/"]:
        duration_ms = (time.perf_counter() - start_time) * 1000
        log_request(
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=duration_ms,
            client_ip=client_ip,
            user_agent=user_agent,
        )
    
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    request_id = getattr(request.state, "request_id", None) or uuid.uuid4().hex
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_payload(code="http_error", message=str(exc.detail), request_id=request_id),
        headers={"X-Request-ID": request_id},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", None) or uuid.uuid4().hex
    logger.exception("Unhandled error", extra={"request_id": request_id})
    return JSONResponse(
        status_code=500,
        content=_error_payload(code="internal_error", message="Unexpected error.", request_id=request_id),
        headers={"X-Request-ID": request_id},
    )

# Production-aware CORS configuration
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "").split(",") if os.getenv("ALLOWED_ORIGINS") else ["*"]
IS_PRODUCTION = os.getenv("ENVIRONMENT", "development") == "production"

if IS_PRODUCTION and ALLOWED_ORIGINS == ["*"]:
    logger.warning("Running in production with wildcard CORS - consider restricting origins")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Request-ID"],
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
    "version": os.getenv("APP_VERSION", "1.0.0"),
    "environment": os.getenv("ENVIRONMENT", "development"),
    "endpoints": ["/docs", "/health", "/ready", "/chat", "/brief/chat", "/matrix", "/concepts", "/specs", "/production"],
  }


@app.get("/health")
async def health_check():
    """
    Liveness probe - indicates the service is running.
    Used by load balancers and orchestrators for basic health checks.
    """
    return {
        "status": "healthy",
        "service": "Intelligent Briefing Agent",
        "timestamp": time.time(),
    }


@app.get("/ready")
async def readiness_check():
    """
    Readiness probe - indicates the service is ready to accept traffic.
    Checks critical dependencies before confirming readiness.
    """
    checks = {
        "api": True,
        "rate_limiter": True,
    }
    
    # Check if AI model key is configured
    gemini_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    checks["ai_model"] = bool(gemini_key)
    
    all_ready = all(checks.values())
    
    return {
        "status": "ready" if all_ready else "degraded",
        "checks": checks,
        "timestamp": time.time(),
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
    # Optional: base64 encoded image for image-to-image or vision analysis
    image_data: Optional[str] = None
    image_mime_type: Optional[str] = None
    use_gemini: Optional[bool] = False  # If True, use Gemini vision; if False, use Imagen image-to-image
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
    # For Gemini vision responses (text analysis of images)
    response: Optional[str] = None


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
    
    Supports:
    - Text-to-image: Standard image generation from text prompt
    - Image-to-image: Generate new image based on input image + prompt (Imagen)
    - Image analysis: Analyze/describe image using Gemini vision
    
    This endpoint connects to Vertex AI to generate creative assets based on prompts
    from the concept canvas.
    """
    try:
        import base64
        from app.services.asset_generator import (
            generate_image, 
            generate_video,
            prompt_image_with_gemini,
            generate_image_from_image
        )
        
        if request.kind == "image":
            # Check if image data is provided
            if request.image_data:
                image_bytes = base64.b64decode(request.image_data)
                mime_type = request.image_mime_type or "image/jpeg"
                
                if request.use_gemini:
                    # Use Gemini for vision analysis
                    result = prompt_image_with_gemini(
                        image_data=image_bytes,
                        prompt=request.prompt,
                        mime_type=mime_type
                    )
                    # For Gemini, return the text response (could be used to enhance prompts)
                    return GenerateAssetResponse(
                        kind=request.kind,
                        prompt=request.prompt,
                        status=result.get("status", "error"),
                        asset_url=None,  # Gemini returns text, not image
                        error=result.get("error"),
                    )
                else:
                    # Use Imagen for image-to-image generation
                    result = generate_image_from_image(
                        image_data=image_bytes,
                        prompt=request.prompt,
                        mime_type=mime_type
                    )
                    return GenerateAssetResponse(
                        kind=request.kind,
                        prompt=request.prompt,
                        status=result.get("status", "error"),
                        asset_url=result.get("asset_url"),
                        error=result.get("error"),
                    )
            else:
                # Standard text-to-image generation
                result = generate_image(prompt=request.prompt)
                return GenerateAssetResponse(
                    kind=request.kind,
                    prompt=request.prompt,
                    status=result.get("status", "error"),
                    asset_url=result.get("asset_url"),
                    error=result.get("error"),
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

@app.post("/prompt-image")
async def prompt_image_endpoint(
    file: UploadFile = File(...),
    prompt: str = Form(""),
    use_gemini: bool = Form(False)
):
    """
    Upload an image and prompt it with either Gemini (vision analysis) or Imagen (image-to-image).
    
    - use_gemini=True: Analyze/describe image using Gemini vision
    - use_gemini=False: Generate new image based on input using Imagen
    """
    try:
        import base64
        from app.services.asset_generator import (
            prompt_image_with_gemini,
            generate_image_from_image
        )
        
        # Read image file
        image_bytes = await file.read()
        if len(image_bytes) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Max upload size is {MAX_UPLOAD_MB} MB.",
            )
        mime_type = file.content_type or "image/jpeg"
        
        if use_gemini:
            # Use Gemini for vision analysis
            result = prompt_image_with_gemini(
                image_data=image_bytes,
                prompt=prompt or "Describe this image in detail.",
                mime_type=mime_type
            )
            return {
                "status": result.get("status", "error"),
                "response": result.get("response"),
                "prompt": prompt,
                "error": result.get("error"),
            }
        else:
            # Use Imagen for image-to-image generation
            result = generate_image_from_image(
                image_data=image_bytes,
                prompt=prompt or "Enhance this image",
                mime_type=mime_type
            )
            return {
                "status": result.get("status", "error"),
                "asset_url": result.get("asset_url"),
                "prompt": prompt,
                "error": result.get("error"),
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        raw_bytes = await file.read()
        if len(raw_bytes) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Max upload size is {MAX_UPLOAD_MB} MB.",
            )
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
