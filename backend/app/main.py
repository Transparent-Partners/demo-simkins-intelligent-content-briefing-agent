from fastapi import FastAPI, HTTPException, UploadFile, File, Response
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from app.agent_core import process_message
from fastapi.middleware.cors import CORSMiddleware
import aiofiles
import os
import json
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
import io

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

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        content = ""
        if file.filename.endswith('.txt') or file.filename.endswith('.md'):
            content = (await file.read()).decode('utf-8')
        else:
            content = f"[File Uploaded: {file.filename}] (Content extraction pending integration)"
            
        return {"filename": file.filename, "content": content}
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
    content = f"Production Master Plan: {request.plan.get('campaign_name', 'Untitled')}\n"
    content += "=" * 50 + "\n\n"
    content += f"SMP: {request.plan.get('single_minded_proposition', 'N/A')}\n\n"
    
    content += "Bill of Materials:\n"
    for item in request.plan.get('bill_of_materials', []):
        content += f"- {item.get('asset_id')}: {item.get('concept')} ({item.get('format')})\n"
        
    return Response(content=content, media_type="text/plain", headers={"Content-Disposition": "attachment; filename=brief.txt"})
