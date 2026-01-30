import { extractBriefFields, ChatMessage, CurrentState } from '../app/utils/extractBriefFields';

describe('extractBriefFields', () => {
  // ============================================================================
  // CAMPAIGN NAME EXTRACTION
  // ============================================================================
  
  describe('campaign name extraction', () => {
    it('extracts campaign name from "campaign called X"', () => {
      const chatLog: ChatMessage[] = [
        { role: 'user', content: 'I want to start a campaign called Summer Glow 2024' }
      ];
      const result = extractBriefFields(chatLog, {});
      expect(result.campaign_name).toBe('Summer Glow 2024');
    });

    it('extracts campaign name from "campaign named X"', () => {
      const chatLog: ChatMessage[] = [
        { role: 'user', content: 'Create a campaign named Winter Collection' }
      ];
      const result = extractBriefFields(chatLog, {});
      expect(result.campaign_name).toBe('Winter Collection');
    });

    it('extracts campaign name and stops at "targeting"', () => {
      const chatLog: ChatMessage[] = [
        { role: 'user', content: 'Start a campaign Adidas Winter 2026 targeting fitness enthusiasts' }
      ];
      const result = extractBriefFields(chatLog, {});
      expect(result.campaign_name).toBe('Adidas Winter 2026');
    });

    it('extracts campaign name and stops at "for"', () => {
      const chatLog: ChatMessage[] = [
        { role: 'user', content: 'Create a campaign Holiday Sale 2024 for young professionals' }
      ];
      const result = extractBriefFields(chatLog, {});
      expect(result.campaign_name).toBe('Holiday Sale 2024');
    });

    it('does not overwrite existing campaign name', () => {
      const chatLog: ChatMessage[] = [
        { role: 'user', content: 'Create a campaign called New Campaign' }
      ];
      const result = extractBriefFields(chatLog, { campaign_name: 'Existing Campaign' });
      expect(result.campaign_name).toBeUndefined();
    });

    it('extracts from "campaign name:" format', () => {
      const chatLog: ChatMessage[] = [
        { role: 'user', content: 'Campaign name: Spring Launch 2025' }
      ];
      const result = extractBriefFields(chatLog, {});
      expect(result.campaign_name).toBe('Spring Launch 2025');
    });
  });

  // ============================================================================
  // AUDIENCE EXTRACTION
  // ============================================================================
  
  describe('audience extraction', () => {
    it('extracts audience from "targeting X"', () => {
      const chatLog: ChatMessage[] = [
        { role: 'user', content: 'We are targeting fitness enthusiasts' }
      ];
      const result = extractBriefFields(chatLog, {});
      expect(result.primary_audience).toBe('fitness enthusiasts');
    });

    it('extracts audience and stops at "with the goal"', () => {
      const chatLog: ChatMessage[] = [
        { role: 'user', content: 'Targeting young professionals with the goal of driving sales' }
      ];
      const result = extractBriefFields(chatLog, {});
      expect(result.primary_audience).toBe('young professionals');
    });

    it('extracts from "primary audience:" format', () => {
      const chatLog: ChatMessage[] = [
        { role: 'user', content: 'Primary audience: Gen Z consumers' }
      ];
      const result = extractBriefFields(chatLog, {});
      expect(result.primary_audience).toBe('Gen Z consumers');
    });

    it('extracts various audience types', () => {
      const testCases = [
        { input: 'targeting millennials', expected: 'millennials' },
        { input: 'targeting gen z', expected: 'gen z' },
        { input: 'targeting professional athletes', expected: 'professional athletes' },
      ];
      
      for (const { input, expected } of testCases) {
        const result = extractBriefFields([{ role: 'user', content: input }], {});
        expect(result.primary_audience).toBe(expected);
      }
    });

    it('does not overwrite existing audience', () => {
      const chatLog: ChatMessage[] = [
        { role: 'user', content: 'Targeting new consumers' }
      ];
      const result = extractBriefFields(chatLog, { primary_audience: 'Existing Audience' });
      expect(result.primary_audience).toBeUndefined();
    });
  });

  // ============================================================================
  // OBJECTIVE EXTRACTION
  // ============================================================================
  
  describe('objective extraction', () => {
    it('extracts from "goal is X"', () => {
      const chatLog: ChatMessage[] = [
        { role: 'user', content: 'The goal is to increase brand awareness' }
      ];
      const result = extractBriefFields(chatLog, {});
      expect(result.objective).toBe('increase brand awareness');
    });

    it('extracts from "drive X" pattern', () => {
      const chatLog: ChatMessage[] = [
        { role: 'user', content: 'We want to drive sales for winter gear' }
      ];
      const result = extractBriefFields(chatLog, {});
      expect(result.objective).toBe('sales for winter gear');
    });

    it('extracts from "objective:" format', () => {
      const chatLog: ChatMessage[] = [
        { role: 'user', content: 'Objective: boost engagement' }
      ];
      const result = extractBriefFields(chatLog, {});
      expect(result.objective).toBe('boost engagement');
    });

    it('extracts various objective types', () => {
      const testCases = [
        { input: 'driving awareness', expected: 'awareness' },
        { input: 'increase conversions', expected: 'conversions' },
        { input: 'boost traffic', expected: 'traffic' },
      ];
      
      for (const { input, expected } of testCases) {
        const result = extractBriefFields([{ role: 'user', content: input }], {});
        expect(result.objective).toBe(expected);
      }
    });
  });

  // ============================================================================
  // SMP EXTRACTION
  // ============================================================================
  
  describe('SMP extraction', () => {
    it('extracts from "proposition:" format', () => {
      const chatLog: ChatMessage[] = [
        { role: 'user', content: 'Proposition: "Be unstoppable"' }
      ];
      const result = extractBriefFields(chatLog, {});
      expect(result.smp).toBe('Be unstoppable');
    });

    it('extracts from "smp:" format', () => {
      const chatLog: ChatMessage[] = [
        { role: 'user', content: 'SMP: Every run counts' }
      ];
      const result = extractBriefFields(chatLog, {});
      expect(result.smp).toBe('Every run counts');
    });

    it('extracts from "key message:" format', () => {
      const chatLog: ChatMessage[] = [
        { role: 'user', content: 'Key message: "Feel the difference"' }
      ];
      const result = extractBriefFields(chatLog, {});
      expect(result.smp).toBe('Feel the difference');
    });
  });

  // ============================================================================
  // COMBINED EXTRACTION
  // ============================================================================
  
  describe('combined extraction', () => {
    it('extracts multiple fields from a single message', () => {
      const chatLog: ChatMessage[] = [
        { role: 'user', content: 'Create a campaign Adidas Winter 2026 targeting fitness enthusiasts with the goal of driving sales' }
      ];
      const result = extractBriefFields(chatLog, {});
      expect(result.campaign_name).toBe('Adidas Winter 2026');
      expect(result.primary_audience).toBe('fitness enthusiasts');
    });

    it('only uses the last user message', () => {
      const chatLog: ChatMessage[] = [
        { role: 'user', content: 'Create campaign called Old Campaign' },
        { role: 'assistant', content: 'Great! What is your target audience?' },
        { role: 'user', content: 'We are targeting young athletes' }
      ];
      const result = extractBriefFields(chatLog, {});
      expect(result.campaign_name).toBeUndefined(); // Not in last message
      expect(result.primary_audience).toBe('young athletes'); // Is in last message
    });

    it('returns empty object when no fields found', () => {
      const chatLog: ChatMessage[] = [
        { role: 'user', content: 'Hello, can you help me?' }
      ];
      const result = extractBriefFields(chatLog, {});
      expect(Object.keys(result)).toHaveLength(0);
    });

    it('handles empty chat log', () => {
      const result = extractBriefFields([], {});
      expect(Object.keys(result)).toHaveLength(0);
    });
  });
});
