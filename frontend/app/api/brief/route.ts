import { NextRequest, NextResponse } from 'next/server';
import { extractBriefFields as extractFields } from '../../utils/extractBriefFields';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GOOGLE_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'models/gemini-2.5-pro';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

// Wrapper to maintain backward compatibility with the API route
function extractBriefFields(chatLog: any[], currentState: any): Record<string, string> {
  return extractFields(chatLog || [], currentState || {});
}

// Minimal proxy for brief chat to keep the key server-side.
export async function POST(req: NextRequest) {
  if (!OPENAI_API_KEY && !GEMINI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY or GOOGLE_API_KEY not set' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { current_state, chat_log } = body || {};

    // Extract any brief fields mentioned in the conversation
    const extractedFields = extractBriefFields(chat_log || [], current_state || {});

    const systemPrompt = `
You are a concise brief partner helping build a creative campaign brief.

IMPORTANT: When the user provides information about their campaign, acknowledge it clearly by restating what you understood. For example:
- If they mention a campaign name, say "Campaign Name: [name]"
- If they mention an audience, say "Primary Audience: [audience]"
- If they mention a goal, say "Objective: [goal]"

Work on one field at a time. Keep replies to 2-3 sentences max.
After acknowledging the information, ask "Ready for the next field?" to continue building the brief.

Do not use markdown formatting. Do not use bullets or numbered lists. Plain conversational English only.
`;

    const messages = Array.isArray(chat_log) ? chat_log : [];

    // Prefer OpenAI if available, otherwise use Gemini
    if (OPENAI_API_KEY) {
      const openaiMessages = [
        { role: 'system', content: systemPrompt.trim() },
        ...messages
          .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant'))
          .map((m: any) => ({
            role: m.role,
            content: String(m.content || ''),
          })),
      ];

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: openaiMessages,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return NextResponse.json({ error: errText }, { status: response.status });
      }

      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content || 'No reply generated.';
      
      // Merge extracted fields with current state
      const updatedState = { ...(current_state || {}), ...extractedFields };
      
      return NextResponse.json({
        reply: text,
        state: updatedState,
        extracted_fields: extractedFields,
        quality_score: null,
      });
    } else {
      // Fallback to Gemini
      const geminiPayload = {
        // v1beta REST expects camelCase: systemInstruction
        systemInstruction: {
          parts: [{ text: systemPrompt.trim() }],
        },
        contents: messages
          .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant'))
          .map((m: any) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: String(m.content || '') }],
          })),
      };

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiPayload),
        },
      );

      if (!response.ok) {
        const errText = await response.text();
        return NextResponse.json({ error: errText }, { status: response.status });
      }

      const data = await response.json();
      const text =
        data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join(' ') ||
        'No reply generated.';
      
      // Merge extracted fields with current state
      const updatedState = { ...(current_state || {}), ...extractedFields };
      
      return NextResponse.json({
        reply: text,
        state: updatedState,
        extracted_fields: extractedFields,
        quality_score: null,
      });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 });
  }
}
