import asyncio
import json
import os
from pathlib import Path
from typing import List

import httpx

from dotenv import load_dotenv

# Load environment from backend/.env (local dev). In Vercel, env vars come from Project Settings.
ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=ENV_PATH, override=True)  # override=True ensures .env values take precedence

_OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
_GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
_MODEL_NAME = os.getenv("GEMINI_MODEL", "models/gemini-2.5-pro")
_OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")


SYSTEM_PROMPT = """You are an expert Content Strategy Architect and world-class ModCon briefing SME.
Your goal is to interview the user to build a "Production Master Plan" for an Intelligent Content Brief,
acting as the foundation for creative, media, and production teams.

The master plan is one object with two main parts:
1) A written creative brief (campaign story, objectives, audiences, SMP, constraints).
2) An execution layer (content matrix and bill of materials) that production teams can act on.

The structured plan includes:
- Core brief fields (campaign_name, single_minded_proposition, primary_audience, narrative_brief).
- Audience_matrix (rows describing segments, funnel stages, triggers, channels, notes).
- Channel_specs (per-channel / format specs and guardrails).
- Brand_voice and brand_visual_guidelines.
- Asset_libraries (references into a DAM or brand asset system).
- Bill_of_materials (asset-level requirements: id, format, concept, source_type, specs).
- Logic_map (if/then style rules for dynamic assembly).
- Content_matrix (rows combining asset_id + audience_segment + stage + trigger + channel + format + message + variant + notes).
- Custom brief fields: honor any extra fields provided by the user and update them as you learn more.

Your process:
- Phase 1 (Briefing): Act as a consultant. Ask clarifying questions one step at a time to co-write the narrative brief and fill in core fields.
- Use any uploaded audience matrix information explicitly (refer to segments, triggers, etc.).
- When the user indicates the brief feels solid, summarise it back as a clean narrative_brief and confirm.
- Phase 2 (Content Matrix): Propose a first pass content_matrix based on the brief, audience_matrix, and channel_specs.
- Think in terms of audience x funnel_stage x trigger x channel, and map rows to asset concepts in the bill_of_materials.
- Suggest sample concepts and labels for variants that a creative director could react to.
- Be explicit and useful for downstream teams (creative, media, production). Flag gaps, mandatories, and assumptions.
- The agent can be adapted with company-specific context later; note any places where brand data or historical learnings would help.

Current Plan State:
{current_plan}
"""

def _should_retry(status_code: int | None) -> bool:
    return status_code in {408, 429, 500, 502, 503, 504}


async def _post_json_with_retries(
    url: str,
    payload: dict,
    headers: dict,
    timeout_seconds: float,
    max_retries: int = 2,
    backoff_seconds: float = 0.75,
) -> str:
    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        for attempt in range(max_retries + 1):
            try:
                resp = await client.post(url, json=payload, headers=headers)
                resp.raise_for_status()
                return resp.text
            except httpx.HTTPStatusError as e:
                status = e.response.status_code if e.response else None
                body = e.response.text if e.response else ""
                if attempt < max_retries and _should_retry(status):
                    await asyncio.sleep(backoff_seconds * (2**attempt))
                    continue
                raise RuntimeError(f"API error {status}: {body or str(e)}") from e
            except httpx.RequestError as e:
                if attempt < max_retries:
                    await asyncio.sleep(backoff_seconds * (2**attempt))
                    continue
                raise RuntimeError(f"Request failed: {e}") from e


async def _gemini_generate(system_prompt: str, chat_log: List[dict]) -> str:
    """
    Minimal Gemini REST call (stdlib only) to keep the serverless backend lightweight.
    """
    if os.getenv("DEMO_AGENT_STUB") == "1":
        return (
            "Demo mode: let's lock a solid ModCon brief. Give me campaign name, SMP, primary audience, "
            "KPIs, flight dates, mandatories, tone, offers, proof points, and any brand assets. "
            "If you share an audience matrix or specs, I'll shape the content matrix next."
        )

    if not _GOOGLE_API_KEY:
        return (
            "I can't reach Gemini because the API key isn't loaded. Please set GOOGLE_API_KEY (or OPENAI_API_KEY) and redeploy. "
            "Share campaign name, SMP, audiences, KPIs, flight dates, mandatories, tone/voice, offers, proof points, "
            "and specs/asset libraries, and I'll draft the brief once connected."
        )

    payload = {
        "systemInstruction": {"parts": [{"text": system_prompt.strip()}]},
        "contents": [
            {
                "role": ("model" if m.get("role") == "assistant" else "user"),
                "parts": [{"text": str(m.get("content", "") or "")}],
            }
            for m in (chat_log or [])
            if m and m.get("role") in ("user", "assistant")
        ],
    }

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{_MODEL_NAME}:generateContent?key={_GOOGLE_API_KEY}"
    raw = await _post_json_with_retries(
        url=url,
        payload=payload,
        headers={"Content-Type": "application/json"},
        timeout_seconds=25,
    )

    try:
        parsed = json.loads(raw)
        text = " ".join(
            (p.get("text") or "")
            for p in (parsed.get("candidates", [{}])[0].get("content", {}).get("parts", []) or [])
            if isinstance(p, dict)
        ).strip()
        return text or "No reply generated."
    except Exception:
        return raw or "No reply generated."


async def _openai_generate(system_prompt: str, chat_log: List[dict]) -> str:
    """
    Generate response using OpenAI API.
    """
    if not _OPENAI_API_KEY:
        return (
            "I can't reach OpenAI because the API key isn't loaded. Please set OPENAI_API_KEY and redeploy. "
            "Share campaign name, SMP, audiences, KPIs, flight dates, mandatories, tone/voice, offers, proof points, "
            "and specs/asset libraries, and I'll draft the brief once connected."
        )
    
    messages = [{"role": "system", "content": system_prompt.strip()}]
    for m in (chat_log or []):
        if m and m.get("role") in ("user", "assistant"):
            messages.append({
                "role": m.get("role"),
                "content": str(m.get("content", "") or "")
            })
    
    payload = {
        "model": _OPENAI_MODEL,
        "messages": messages,
        "temperature": 0.7,
    }
    
    url = "https://api.openai.com/v1/chat/completions"
    raw = await _post_json_with_retries(
        url=url,
        payload=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {_OPENAI_API_KEY}",
        },
        timeout_seconds=30,
    )
    
    try:
        parsed = json.loads(raw)
        text = parsed.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
        return text or "No reply generated."
    except Exception:
        return raw or "No reply generated."


async def process_message(history: List[dict], current_plan: dict) -> str:
    current_plan_str = json.dumps(current_plan or {}, indent=2)
    system_prompt = SYSTEM_PROMPT.format(current_plan=current_plan_str)
    
    # Prefer OpenAI if available, otherwise use Gemini
    if _OPENAI_API_KEY:
        return await _openai_generate(system_prompt=system_prompt, chat_log=history or [])
    else:
        return await _gemini_generate(system_prompt=system_prompt, chat_log=history or [])
