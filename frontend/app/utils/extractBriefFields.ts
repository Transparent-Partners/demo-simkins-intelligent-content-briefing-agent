// ============================================================================
// BRIEF FIELD EXTRACTION UTILITY
// ============================================================================
// Extracts structured brief field values from natural language user messages.
// Used by the API route to populate brief fields from chat conversation.

export interface ExtractedFields {
  campaign_name?: string;
  primary_audience?: string;
  objective?: string;
  smp?: string;
}

export interface CurrentState {
  campaign_name?: string;
  primary_audience?: string;
  objective?: string;
  smp?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Extracts brief field values from user messages in a chat log.
 * Only extracts fields that aren't already present in currentState.
 */
export function extractBriefFields(
  chatLog: ChatMessage[],
  currentState: CurrentState = {}
): ExtractedFields {
  const updates: ExtractedFields = {};

  // Get the last user message only for cleaner extraction
  const lastUserMessage = chatLog
    .filter((m) => m?.role === 'user')
    .slice(-1)
    .map((m) => m.content || '')
    .join('');

  const originalText = lastUserMessage;

  // Extract campaign name - stop at "targeting", "for", "with the goal", etc.
  const campaignPatterns = [
    /campaign\s+(?:called|named|is|:)\s*['""]?([A-Za-z0-9\s]+?)(?:\s+targeting|\s+for\s+|\s+with\s+the\s+goal|\s+aimed\s+at|['""]|$)/i,
    /(?:start|create|build)\s+(?:a\s+)?(?:new\s+)?campaign\s+(?:called\s+)?['""]?([A-Za-z0-9\s]+?)(?:\s+targeting|\s+for\s+|\s+with\s+the\s+goal|\s+aimed\s+at|['""]|$)/i,
    /campaign\s+name[:\s]+['""]?([A-Za-z0-9\s]+?)['""]?(?:$|\.)/i,
  ];
  for (const pattern of campaignPatterns) {
    const match = originalText.match(pattern);
    if (match && match[1] && match[1].trim().length > 2 && !currentState?.campaign_name) {
      updates.campaign_name = match[1].trim();
      break;
    }
  }

  // Extract audience - stop at "with the goal", "for", etc.
  const audiencePatterns = [
    /targeting\s+([A-Za-z0-9\s]+?(?:athletes|consumers|professionals|users|customers|buyers|millennials|gen\s*z|boomers|enthusiasts))(?:\s+with\s+|\s+for\s+|\s+to\s+|$)/i,
    /(?:primary\s+)?audience[:\s]+['""]?([A-Za-z0-9\s]+?)['""]?(?:$|\.)/i,
    /target(?:ing)?\s+['""]?([A-Za-z0-9\s]+?)['""]?(?:\s+with\s+|\s+for\s+|\s+to\s+|$)/i,
  ];
  for (const pattern of audiencePatterns) {
    const match = originalText.match(pattern);
    if (match && match[1] && match[1].trim().length > 2 && !currentState?.primary_audience) {
      updates.primary_audience = match[1].trim();
      break;
    }
  }

  // Extract goal/objective
  const goalPatterns = [
    /goal\s+(?:of|is|:)\s+(?:to\s+)?([A-Za-z0-9\s]+?)(?:\.|$)/i,
    /objective[:\s]+([A-Za-z0-9\s]+?)(?:\.|$)/i,
    /(?:drive|driving|increase|boost)\s+((?:brand\s+)?(?:awareness|sales|engagement|conversions|traffic)(?:\s+for\s+[A-Za-z0-9\s]+)?)/i,
  ];
  for (const pattern of goalPatterns) {
    const match = originalText.match(pattern);
    if (match && match[1] && match[1].trim().length > 2 && !currentState?.objective) {
      updates.objective = match[1].trim();
      break;
    }
  }

  // Extract SMP (single-minded proposition)
  const smpPatterns = [
    /proposition[:\s]+['""]?([^'""]+?)['""]?(?:\.|$)/i,
    /smp[:\s]+['""]?([^'""]+?)['""]?(?:\.|$)/i,
    /key\s+message[:\s]+['""]?([^'""]+?)['""]?(?:\.|$)/i,
  ];
  for (const pattern of smpPatterns) {
    const match = originalText.match(pattern);
    if (match && match[1] && match[1].trim().length > 2 && !currentState?.smp) {
      updates.smp = match[1].trim();
      break;
    }
  }

  return updates;
}
