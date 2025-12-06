from fastapi import FastAPI, HTTPException, UploadFile, File, Response
from pydantic import BaseModel
from typing import List, Dict, Any, Optional, Literal
from app.agent_core import process_message
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
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    Turn a concept canvas entry into a concrete prompt for downstream
    image / video generation.

    This is intentionally a thin stub so we can wire the UI and payload shape
    without yet depending on specific GCP client libraries.

    To connect this to Google Cloud creative AI in a later step you would:
      - Enable Vertex AI in your GCP project.
      - Use the appropriate Python client (e.g., for Imagen or Veo) with
        service account credentials.
      - Call the model with `request.prompt` (and `request.kind`) and return
        the resulting image / video URL in `asset_url`.
    """
    try:
        # For now just echo the prompt back with a stubbed status.
        return GenerateAssetResponse(
            kind=request.kind,
            prompt=request.prompt,
            status="queued",
            asset_url=None,
        )
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
