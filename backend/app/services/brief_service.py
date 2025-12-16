from __future__ import annotations

import json
from typing import Any, Dict, List, Tuple, Optional

import os
import re

from app.agent_core import _gemini_generate
from app.schemas.brief import ModConBrief


def _parse_model_json(raw: str) -> Dict[str, Any] | None:
    """
    The model is instructed to return strict JSON, but in practice it may wrap
    it in markdown fences or add stray text. This helper tries a few safe
    extraction strategies so we don't leak raw JSON back to the UI.
    """
    if not raw:
        return None

    # 1) Direct parse
    try:
        payload = json.loads(raw)
        if isinstance(payload, dict):
            return payload
    except Exception:
        pass

    text = raw.strip()

    # 2) Strip ```json fences if present
    if text.startswith("```"):
        # Remove opening fence line and closing fence if present
        text = re.sub(r"^```[a-zA-Z0-9_-]*\s*", "", text)
        text = re.sub(r"\s*```$", "", text).strip()
        try:
            payload = json.loads(text)
            if isinstance(payload, dict):
                return payload
        except Exception:
            pass

    # 3) Extract the first top-level JSON object substring
    first = text.find("{")
    last = text.rfind("}")
    if first != -1 and last != -1 and last > first:
        candidate = text[first : last + 1]
        try:
            payload = json.loads(candidate)
            if isinstance(payload, dict):
                return payload
        except Exception:
            pass

    return None

def compute_quality_and_gaps(brief: Dict[str, Any]) -> Tuple[float, List[str]]:
    """
    Lightweight heuristic scorer: gives partial credit for key fields being present and non-trivial.
    Returns a score (0-10) and a short list of gaps to focus on next.
    """
    score = 0.0
    gaps: List[str] = []

    name = str(brief.get("campaign_name", "") or "").strip()
    smp = str(brief.get("smp", "") or brief.get("single_minded_proposition", "") or "").strip()
    audiences = brief.get("audiences") or []
    primary_audience = str(brief.get("primary_audience", "") or "").strip()
    kpis = brief.get("kpis") or []
    narrative = str(brief.get("narrative_brief", "") or "").strip()
    flight = brief.get("flight_dates") or {}

    if name:
        score += 2.0
    else:
        gaps.append("Campaign Name")

    if smp and len(smp) >= 8:
        score += 3.0
    else:
        gaps.append("Single Minded Proposition")

    if (isinstance(audiences, list) and audiences) or primary_audience:
        score += 2.0
    else:
        gaps.append("Audiences")

    if isinstance(kpis, list) and kpis:
        score += 2.0
    else:
        gaps.append("KPIs")

    if isinstance(flight, dict) and flight.get("start") and flight.get("end"):
        score += 1.0

    if narrative and len(narrative) >= 30:
        score += 0.5

    # Cap score to 10
    score = min(10.0, score)
    # Keep top 3 gaps
    gaps = gaps[:3]
    return score, gaps


SYSTEM_PROMPT = """
You are a concise brief partner. Keep responses plain English (no markdown, bullets, or numbered lists).

Inputs:
- current_state: existing ModCon brief as JSON (with custom fields)
- chat_log: conversation so far

Behavior:
1) Work on ONE field at a time. Use the latest user input to propose one clear line the user can copy/paste.
2) If the user didn’t provide text for that field, ask for it directly in one sentence.
3) Never invent or auto-set campaign_name. If campaign_name is blank, ask the user to provide it (do NOT suggest one).
4) Provide quality_score 0–10 (production-readiness) and top 2 gaps to reach 10/10.
5) Replies: concise sentences only. Do NOT include score/gaps inside assistant_reply; those go in quality_score and the brief state.
6) No lists of options; pick one best-fit suggestion when you have enough info. Avoid repeating the same gaps every turn; focus on the next critical gap.
6) Preserve all keys; if a field stays empty, list it as a gap. Do not include any JSON or formatting in assistant_reply.

IMPORTANT OUTPUT FORMAT:
Return ONLY valid JSON with this exact shape and no extra commentary:
{{
  "assistant_reply": "natural language reply to the user",
  "quality_score": 0-10,
  "modcon_brief": {{...}}  // include ALL keys from current_state (updated), plus any new fields you add
}}

Current state (for reference):
{current_state}
"""


def update_brief_ai(
    current_state: ModConBrief, chat_log: List[Dict[str, str]]
) -> Tuple[ModConBrief, str, Optional[float]]:
    """
    Use the shared Gemini LLM to update the ModConBrief from chat.

    This stays deliberately thin: it lets the model propose an updated brief
    and a conversational reply, then we validate & merge the state.
    """
    system_prompt = SYSTEM_PROMPT.format(current_state=json.dumps(current_state.model_dump(), indent=2))

    # Stub path when demo mode is on (or when Gemini key is missing in serverless)
    if os.getenv("DEMO_AGENT_STUB") == "1" or not os.getenv("GOOGLE_API_KEY"):
        stub_reply = (
            "Let's tighten your ModCon brief. Please share campaign name, SMP, primary audience(s), KPIs, "
            "flight dates, mandatories, tone/voice, offers, proof points, and any specs/asset libraries. "
            "I'll draft and score it once Gemini is connected."
        )
        return current_state, stub_reply, 3.0

    try:
        raw = _gemini_generate(system_prompt=system_prompt, chat_log=chat_log or [])
    except Exception as exc:
        fallback = (
            "I hit an issue reaching the model. Let's keep going: share campaign name, SMP, audiences, KPIs, "
            "flight dates, mandatories, tone/voice, offers, proof points, and specs/asset libraries. "
            "I'll draft and score it as soon as we reconnect."
        )
        return current_state, f"{fallback} (error: {exc})", None

    payload = _parse_model_json(str(raw))
    if payload is None:
        # Fallback: keep state, surface a friendly error (avoid dumping raw JSON)
        return (
            current_state,
            "I couldn't parse the model response. Please try again, or toggle Demo Mode if you're offline.",
            None,
        )

    assistant_reply = str(payload.get("assistant_reply", "")).strip() or raw
    brief_data = payload.get("modcon_brief") or {}

    # Guardrails: do not invent campaign_name unless the user explicitly provided it.
    try:
        last_user_text = ""
        for msg in reversed(chat_log):
            if msg.get("role") == "user":
                last_user_text = msg.get("content", "") or ""
                break
        lower_last = last_user_text.lower()
        proposed_name = str(brief_data.get("campaign_name", "") or "").strip()
        current_name = str(current_state.campaign_name or "").strip()

        if proposed_name and not current_name:
            # Keep only if the user actually typed that name (or clearly set it)
            if proposed_name.lower() not in lower_last and "campaign name" not in lower_last:
                brief_data["campaign_name"] = current_name
    except Exception:
        pass

    # Merge and compute quality/gaps locally
    merged = current_state.model_dump()
    merged.update(brief_data)
    score, gaps = compute_quality_and_gaps(merged)
    merged["gaps"] = gaps
    merged["quality_score"] = score
    try:
        updated = ModConBrief(**merged)
    except Exception:
        updated = ModConBrief(**current_state.model_dump())
        score, gaps = compute_quality_and_gaps(updated.model_dump())

    # Clean, concise reply assembly (plain sentences, no markdown). Strip any model-added score/gaps/readiness.
    for marker in [
        "Quality",
        "Score",
        "Gaps",
        "Ready for the next field",
        "Ready to move to the next field",
    ]:
        if marker in assistant_reply:
            assistant_reply = assistant_reply.split(marker)[0].strip()
    assistant_reply = assistant_reply.replace("*", "").replace("-", "").strip()

    final_reply = " ".join(assistant_reply.split()) or "Acknowledged. Ready for the next field?"

    return updated, final_reply, score


def override_brief(current_state: ModConBrief, manual_updates: Dict[str, Any]) -> ModConBrief:
    """
    Human override: apply direct edits onto the ModConBrief.

    In case of conflict between AI and human, the human wins.
    """
    return current_state.copy(update=manual_updates or {})
