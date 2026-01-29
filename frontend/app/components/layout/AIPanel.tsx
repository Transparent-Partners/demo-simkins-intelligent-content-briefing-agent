'use client';

import { useState, useRef, useEffect } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { usePlanningStore } from '../../stores/planningStore';

// ============================================================================
// AI PANEL - Planning Facilitator (Right Panel)
// ============================================================================

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  action?: AIAction;
};

type AIAction = {
  type: 'summarize_plan' | 'identify_risk' | 'suggest_reuse' | 'generate_alignment' | 'reconcile';
  label: string;
  result?: string;
};

const AI_ACTIONS: AIAction[] = [
  { type: 'summarize_plan', label: 'Summarize Plan' },
  { type: 'identify_risk', label: 'Identify Scope Risks' },
  { type: 'suggest_reuse', label: 'Find Reuse Opportunities' },
  { type: 'generate_alignment', label: 'Generate Alignment Summary' },
  { type: 'reconcile', label: 'Reconcile Perspectives' },
];

export function AIPanel() {
  const { rightPanelCollapsed, toggleRightPanel, aiIsTyping, setAITyping, roleLens } = useUIStore();
  const { activationBrief, contentMatrix, productionPlan } = usePlanningStore();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Welcome to the ModCon Planning Workspace. I'm here to help you align creative, production, and media perspectives into a cohesive activation plan.

How can I assist you today? You can:
- Ask me to clarify assumptions
- Request tradeoff analysis
- Generate summaries for different stakeholders
- Identify scope risks and reuse opportunities`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setAITyping(true);

    // Simulate AI response (in real implementation, call API)
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: generateContextualResponse(input, activationBrief, contentMatrix, roleLens),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setAITyping(false);
    }, 1500);
  };

  const handleAction = async (action: AIAction) => {
    setAITyping(true);

    const actionMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: `[Action: ${action.label}]`,
      timestamp: new Date(),
      action,
    };

    setMessages((prev) => [...prev, actionMessage]);

    // Generate action result
    setTimeout(() => {
      const result = generateActionResult(action, activationBrief, contentMatrix, productionPlan);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setAITyping(false);
    }, 2000);
  };

  if (rightPanelCollapsed) {
    return (
      <div className="flex flex-col items-center py-4 px-2 bg-slate-900 border-l border-slate-700 w-14">
        <button
          onClick={toggleRightPanel}
          className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white mb-4"
          title="Expand AI Panel"
        >
          <ChevronLeftIcon />
        </button>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          <SparklesIcon />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-slate-900 border-l border-slate-700 w-[360px]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <SparklesIcon />
          </div>
          <div>
            <h2 className="text-white font-semibold text-sm">Planning Facilitator</h2>
            <p className="text-slate-400 text-xs">AI-assisted alignment</p>
          </div>
        </div>
        <button
          onClick={toggleRightPanel}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
          title="Collapse AI Panel"
        >
          <ChevronRightIcon />
        </button>
      </div>

      {/* Quick Actions */}
      <div className="p-3 border-b border-slate-700">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Quick Actions</p>
        <div className="flex flex-wrap gap-2">
          {AI_ACTIONS.map((action) => (
            <button
              key={action.type}
              onClick={() => handleAction(action)}
              disabled={aiIsTyping}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg 
                bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors duration-150"
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`
                max-w-[85%] rounded-2xl px-4 py-3
                ${message.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-md'
                  : 'bg-slate-800 text-slate-100 rounded-bl-md'
                }
              `}
            >
              {message.action ? (
                <p className="text-sm italic text-slate-300">{message.content}</p>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              )}
              <p className="text-xs mt-1.5 opacity-60">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {aiIsTyping && (
          <div className="flex justify-start">
            <div className="bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask about the plan..."
            disabled={aiIsTyping}
            className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl
              text-white placeholder-slate-500 text-sm
              focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500
              disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || aiIsTyping}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm
              hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors duration-150"
          >
            Send
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2 text-center">
          AI helps clarify, not decide. Final calls are yours.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateContextualResponse(
  input: string,
  brief: any,
  matrix: any,
  roleLens: string
): string {
  const inputLower = input.toLowerCase();

  if (inputLower.includes('audience') || inputLower.includes('who')) {
    return `Based on the current brief, your primary audience is: "${brief.primary_audience || 'Not yet defined'}".

I'd recommend clarifying:
- What behavioral signals differentiate this audience?
- What triggers should media use for targeting?
- Are there secondary audiences that need separate messaging?`;
  }

  if (inputLower.includes('scope') || inputLower.includes('how many')) {
    const cells = matrix.cells?.length || 0;
    const variants = matrix.total_variants || 0;
    return `Current scope: ${cells} content cells, ${variants} planned variants.

${variants > 30 ? '⚠️ This is a high-volume plan. Consider:' : 'Scope appears manageable. Consider:'}
- Which variants can share creative modules?
- Are all placements necessary for launch?
- What's the minimum viable activation?`;
  }

  if (inputLower.includes('risk')) {
    return `Key risks I see in the current plan:

1. **Scope creep** - Adding variants without production capacity check
2. **Misalignment** - Media and creative may have different format assumptions
3. **Timeline** - No explicit production timeline defined

Would you like me to elaborate on any of these?`;
  }

  return `I understand you're asking about: "${input}"

Currently viewing with the **${roleLens}** lens. Based on your plan state:
- Brief completion: ${brief.completion_score || 0}%
- Confidence: ${brief.confidence_score || 0}%

How can I help you refine this further?`;
}

function generateActionResult(
  action: AIAction,
  brief: any,
  matrix: any,
  production: any
): string {
  switch (action.type) {
    case 'summarize_plan':
      return `## Plan Summary

**Campaign:** ${brief.campaign_name || 'Untitled'}

**Objective:** ${brief.objective || 'Not defined'}

**Primary Audience:** ${brief.primary_audience || 'Not defined'}

**Proposition:** ${brief.single_minded_proposition || 'Not defined'}

**Content Scope:**
- ${matrix.cells?.length || 0} content cells defined
- ${matrix.total_variants || 0} total variants planned
- ${matrix.reuse_opportunities || 0} reuse opportunities identified

**Production Impact:**
- Complexity: ${production.complexity_score || 'Unknown'}
- Estimated assets: ${production.total_assets || 0}`;

    case 'identify_risk':
      const risks = [];
      if (!brief.kpi) risks.push('- **Missing KPI**: Objective lacks measurable success metric');
      if (!brief.known_constraints?.length) risks.push('- **No constraints defined**: Production may face surprises');
      if ((matrix.total_variants || 0) > 40) risks.push('- **High volume**: Plan exceeds typical production capacity');
      if ((matrix.warnings || []).some((w: any) => w.type === 'format_mismatch')) {
        risks.push('- **Format mismatch**: Some placements may not support planned formats');
      }
      
      return risks.length > 0
        ? `## Scope Risks Identified\n\n${risks.join('\n')}`
        : '## No Critical Risks\n\nThe current plan appears well-defined. Consider reviewing alignment checkpoints.';

    case 'suggest_reuse':
      return `## Reuse Opportunities

Based on your content matrix:

${matrix.reuse_opportunities > 0
  ? `**${matrix.reuse_opportunities} reuse opportunities** identified where the same creative modules can serve multiple placements.

Recommendation: Group these by physical asset type to reduce production overhead.`
  : 'No significant reuse opportunities detected yet. Consider:'}

- Can hook modules work across funnel stages?
- Are there proof points that apply to multiple audiences?
- Can CTA variants be templated?`;

    case 'generate_alignment':
      return `## Alignment Summary

### For Creative Team
- ${brief.single_minded_proposition || 'No SMP defined'} 
- ${matrix.cells?.length || 0} content cells requiring creative
- Key message themes to explore

### For Production Team
- ${production.total_assets || 0} assets estimated
- Complexity: ${production.complexity_score || 'TBD'}
- ${production.capacity_warnings?.length || 0} capacity warnings

### For Media Team
- Placements to be finalized
- Flighting assumptions needed
- Format requirements documented`;

    case 'reconcile':
      return `## Perspective Reconciliation

I've identified potential misalignments:

**Creative vs Production:**
- Creative scope may exceed production capacity
- Recommend prioritizing Tier 1 audiences first

**Creative vs Media:**
- Format assumptions need validation
- Some creative formats may not have platform support

**Production vs Media:**
- Timeline alignment needed
- Asset delivery windows undefined

Would you like me to propose a resolution for any of these?`;

    default:
      return 'Action completed. Please review the results.';
  }
}

// ============================================================================
// ICONS
// ============================================================================

function ChevronLeftIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
      <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  );
}
