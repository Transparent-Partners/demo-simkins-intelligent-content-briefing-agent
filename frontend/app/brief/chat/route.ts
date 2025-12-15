import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

const GEMINI_API_KEY = process.env.GOOGLE_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'models/gemini-2.5-pro';

// Lightweight demo "live API" for the Brief tab.
// Matches the backend FastAPI shape: POST /brief/chat
export async function POST(req: NextRequest) {
  if (!OPENAI_API_KEY && !GEMINI_API_KEY) {
    return NextResponse.json(
      { detail: 'No model API key set. Provide OPENAI_API_KEY (recommended) or GOOGLE_API_KEY.' },
      { status: 500 },
    );
  }

  try {
    const body = await req.json();
    const { current_state, chat_log } = body || {};

    const systemPrompt = `
You are a concise brief partner. Keep responses plain English only (no markdown, bullets, or numbered lists).
Work on ONE field at a time. Use the latest user input to propose one clear line the user can copy/paste.
If the user didn’t provide text for that field, ask for it directly in one sentence.
Keep replies concise sentences. Then ask "Ready for the next field?"
Do not return JSON in your reply.
`;

    const messages = Array.isArray(chat_log) ? chat_log : [];

    // Prefer OpenAI in distributed deployments (simpler + very stable on serverless).
    if (OPENAI_API_KEY) {
      const openaiInput = [
        { role: 'system', content: systemPrompt.trim() },
        ...messages
          .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant'))
          .map((m: any) => ({ role: m.role, content: String(m.content || '') })),
      ];

      const resp = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          input: openaiInput,
          temperature: 0.4,
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        return NextResponse.json({ detail: errText }, { status: resp.status });
      }

      const data: any = await resp.json();
      const text =
        (typeof data?.output_text === 'string' && data.output_text) ||
        data?.output?.[0]?.content?.map((c: any) => c?.text).filter(Boolean).join(' ') ||
        'No reply generated.';

      return NextResponse.json({
        reply: text,
        state: current_state || {},
        quality_score: null,
      });
    }

    // Fallback: Gemini REST (if OPENAI_API_KEY isn't provided).
    const geminiPayload = {
      systemInstruction: { parts: [{ text: systemPrompt.trim() }] },
      contents: messages
        .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant'))
        .map((m: any) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: String(m.content || '') }],
        })),
    };

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiPayload),
      },
    );

    if (!resp.ok) {
      const errText = await resp.text();
      return NextResponse.json({ detail: errText }, { status: resp.status });
    }

    const data = await resp.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join(' ') || 'No reply generated.';

    return NextResponse.json({
      reply: text,
      state: current_state || {},
      quality_score: null,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err?.message || 'Unknown error' }, { status: 500 });
  }
}


