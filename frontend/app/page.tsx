'use client';
import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

type MatrixRow = {
  id: string;
  audience_segment: string;
  funnel_stage: string;
  trigger: string;
  channel: string;
  format: string;
  message: string;
  variant: string;
};

type HistoricalBrief = {
  id: string;
  campaign_name: string;
  single_minded_proposition: string;
  primary_audience: string;
  narrative_brief: string;
};

// --- Sample Data ---
const SAMPLE_JSON = {
  "campaign_name": "Summer Glow 2024",
  "single_minded_proposition": "Radiance that lasts all day.",
  "primary_audience": "Women 25-40, urban professionals, interested in clean beauty.",
  "bill_of_materials": [
    {
      "asset_id": "VID-001",
      "format": "9:16 Video",
      "concept": "Morning Routine ASMR",
      "source_type": "New Shoot",
      "specs": "1080x1920, 15s, Sound On"
    },
    {
      "asset_id": "IMG-001",
      "format": "4:5 Static",
      "concept": "Product Hero Shot on Sand",
      "source_type": "Stock Composite",
      "specs": "1080x1350, JPEG"
    }
  ],
  "logic_map": [
    {
      "condition": "IF Weather = 'Sunny'",
      "action": "SHOW 'Beach Day' Variant"
    },
    {
      "condition": "IF Audience = 'Cart Abandoner'",
      "action": "SHOW '10% Off' Overlay"
    }
  ],
  "production_notes": "Ensure all lighting is natural. No heavy filters. Diversity in casting is mandatory."
};

const SAMPLE_NARRATIVE = `
CAMPAIGN: Summer Glow 2024
--------------------------------------------------
SINGLE MINDED PROPOSITION: 
"Radiance that lasts all day."

PRIMARY AUDIENCE:
Women 25-40, urban professionals, interested in clean beauty. 
They value authenticity and efficient routines.

CREATIVE DIRECTION:
The visual language should be warm, sun-drenched, and effortless. 
Avoid over-styling. Focus on "Golden Hour" lighting.

PRODUCTION NOTES:
- Ensure all lighting is natural. 
- No heavy filters. 
- Diversity in casting is mandatory to reflect our urban audience.
`;

const SAMPLE_MATRIX = [
  { id: "VID-001", audience: "Broad", trigger: "Always On", content: "Morning Routine ASMR", format: "9:16 Video" },
  { id: "IMG-001", audience: "Retargeting", trigger: "Cart Abandon", content: "Product Hero + Discount", format: "4:5 Static" },
  { id: "VID-002", audience: "Loyalty", trigger: "Purchase > 30d", content: "Replenish Reminder", format: "9:16 Video" },
];

const HISTORICAL_BRIEFS: HistoricalBrief[] = [
  {
    id: "HB-001",
    campaign_name: "Aurora Sleep OS Launch",
    single_minded_proposition: "Turn any bedroom into a personalized sleep studio in one week.",
    primary_audience:
      "Urban professionals 28–45 who feel constantly 'wired and tired' and are willing to invest in wellness tech.",
    narrative_brief: `
BACKGROUND
Aurora is a subscription-based "Sleep OS" that orchestrates light, sound, temperature, and routine across devices to fix poor sleep hygiene in 7 days. The product is inherently modular: scenes, soundscapes, routines, and tips can all be mixed and matched based on data signals.

OBJECTIVE
Drive platform sign-ups and 90-day retention by repositioning "sleep tracking" from passive monitoring to active transformation, and by building a reusable content system that can recombine across audiences, stages, and channels.

SINGLE MINDED PROPOSITION
Turn any bedroom into a personalized sleep studio in one week.

PRIMARY AUDIENCE
Urban professionals 28–45 who feel constantly "wired and tired", have tried meditation / tracking apps, and now want a solution that actually changes their environment, not just their data. They are tech-forward, over-scheduled, and skeptical of wellness fluff.

MODULAR CONTENT STRATEGY
- Atomic units:
  - Problem frames (e.g., "doom scrolling at 1:30am", "3am wake-up", "weekend catch-up sleep").
  - Sleep studio scenes (Night Reset, Deep Focus, Gentle Wakeup).
  - Proof points (improved sleep efficiency %, fewer wake-ups, routine streaks).
  - Coaching micro-tips (30–60 character tiles that can travel across channels).
- Dimensions for recombination:
  - Audience sensitivity (biohackers vs burned-out professionals).
  - Funnel stage (Awareness = emotional consequences, Consideration = OS mechanics, Conversion = 7-day trial offer).
  - Channel constraints (short vertical video, static tiles, email modules).

CONTENT MATRIX INTENT
- Upper-funnel: 9:16 and 16:9 video stories that dramatize the "before" and "after" state using modular scenes and VO lines. Variants pivot on different pain points (anxiety, focus, mood).
- Mid-funnel: carousels and email modules that pair specific problems with Aurora "recipes" (bundles of scenes + settings).
- Lower-funnel / CRM: triggered flows that reuse the same ingredients but plug in personalized data (nights improved, routines completed).

GUARDRAILS
- Avoid medical claims; no promises to "cure" conditions.
- Visual language should feel cinematic and calm, not medical or clinical.
- The OS metaphor should stay intuitive: never show overwhelming dashboards; focus on simple, modular building blocks the viewer can imagine using.
`,
  },
  {
    id: "HB-002",
    campaign_name: "VoltCharge Go – Workplace Fast Charging",
    single_minded_proposition: "Make every office parking spot feel like a premium EV perk.",
    primary_audience:
      "HR and Facilities leaders at mid-market companies offering EV charging as an employee benefit.",
    narrative_brief: `
BACKGROUND
VoltCharge Go installs and manages Level 3 fast chargers in office parks under a revenue-share model. The proposition to employees is emotional (feels like a premium perk), while the proposition to HR / Facilities is rational (recruiting, retention, and ESG optics).

OBJECTIVE
Generate qualified leads from HR / Facilities leaders and position VoltCharge Go as the easiest way to turn parking lots into recruiting and retention assets, using a modular content system that can flex across buyer roles, verticals, and funnel stages.

SINGLE MINDED PROPOSITION
Make every office parking spot feel like a premium EV perk.

PRIMARY AUDIENCE
HR / People teams and Facilities leads at 500–5,000 employee companies who are under pressure to modernize benefits and sustainability optics without adding operational burden.

MODULAR CONTENT STRATEGY
- Atomic units:
  - Employee vignettes (new hire, working parent, sustainability champion).
  - Proof tiles (recruiting metric lifts, satisfaction scores, utilization rates).
  - Objection handlers (no CapEx, turnkey ops, transparent pricing).
  - Vertical overlays (tech, healthcare, professional services).
- Dimensions for recombination:
  - Role (HR vs Facilities vs Finance).
  - Building profile (HQ campus vs satellite office).
  - Funnel stage (Awareness = "parking as perk", Consideration = economics and operations, Decision = case studies and calculators).

CONTENT MATRIX INTENT
- Upper-funnel: snackable video and animation that reframes the parking lot as part of the "benefits stack". Variants swap in different employee vignettes.
- Mid-funnel: interactive calculators, one-pagers, and LinkedIn carousels that modularize business cases and objection handlers by role.
- Lower-funnel: retargeting units that reuse proof tiles and testimonials, but tailored to the vertical + role combination detected.

GUARDRAILS
- No "range anxiety fear-mongering"; keep tone confident and solution-forward.
- Avoid generic sustainability stock imagery; show real office environments and people.
- Make it obvious that the system is modular and scalable across multiple sites, not a one-off pilot.
`,
  },
  {
    id: "HB-003",
    campaign_name: "HarvestBox Micro-Market for Multi-Family Buildings",
    single_minded_proposition: "Turn your lobby into the most loved amenity in the building.",
    primary_audience:
      "Property managers and owners of Class A/B multi-family buildings in urban cores.",
    narrative_brief: `
BACKGROUND
HarvestBox installs 24/7 self-checkout "micro-markets" stocked with fresh, local groceries and ready-to-eat meals in residential buildings. It aims to convert everyday "forgot one thing" frictions into memorable building touchpoints.

OBJECTIVE
Increase inbound demos from property owners and demonstrate that HarvestBox drives both resident satisfaction and ancillary revenue, with a modular content system that can pivot across building archetypes, resident personas, and decision-maker needs.

SINGLE MINDED PROPOSITION
Turn your lobby into the most loved amenity in the building.

PRIMARY AUDIENCE
Property managers and asset managers of 150+ unit buildings, focused on NOI, retention, and reviews. They value amenities that are low-touch to operate but high-visibility to residents.

MODULAR CONTENT STRATEGY
- Atomic units:
  - Resident moments (late-night snack, forgotten breakfast, hosting friends, kid snack emergencies).
  - Amenity proof points (NPS lift, review score deltas, occupancy/renewal metrics).
  - Building archetypes (young professionals, families, active adults).
  - Operator promises (low-ops, no-staffing, merchandising handled).
- Dimensions for recombination:
  - Audience lens (owner, asset manager, property manager).
  - Building type and geography (downtown high-rise vs suburban garden).
  - Funnel stage (Awareness = resident stories, Consideration = economics and operations, Decision = case studies and testimonials).

CONTENT MATRIX INTENT
- Upper-funnel: short vertical video sequences that modularly string together resident moments to show how the micro-market "shows up" throughout a week.
- Mid-funnel: carousels and landing-page modules that pair a building archetype with the right mix of resident moments and amenity proof points.
- Lower-funnel: retargeting and CRM that reuse the same modules but swap in building-type specific proof, such as "families in mid-rise X" vs "professionals in tower Y".

GUARDRAILS
- Avoid framing HarvestBox as a full grocery replacement; position it as hyper-convenient top-up.
- Visuals should feel warm, neighborly, and food-first, not like a vending machine.
- Always make it clear that the system is turnkey and does not create new staffing headaches.
`,
  },
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello! I am your Creative Strategy Architect. I can help you build a production-ready intelligent content brief. Shall we start with the Campaign Name and your primary goal?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Sample View State
  const [showSample, setShowSample] = useState(false);
  const [sampleTab, setSampleTab] = useState<'narrative' | 'matrix' | 'json'>('narrative');
  const [showLibrary, setShowLibrary] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [workspaceView, setWorkspaceView] = useState<'split' | 'brief' | 'matrix'>('split');
  const [splitRatio, setSplitRatio] = useState(0.6); // left pane width in split view
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);

  // This would eventually be live-updated from the backend
  const [previewPlan, setPreviewPlan] = useState<any>({ content_matrix: [] }); 
  const [matrixRows, setMatrixRows] = useState<MatrixRow[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  // Handle drag-to-resize for split view
  useEffect(() => {
    if (!isDraggingDivider) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = Math.min(0.8, Math.max(0.3, x / rect.width));
      setSplitRatio(ratio);
    };

    const handleMouseUp = () => {
      setIsDraggingDivider(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingDivider]);

  const sendMessage = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim()) return;

    const newHistory = [...messages, { role: 'user' as const, content: textToSend }];
    setMessages(newHistory);
    setInput('');
    setLoading(true);

    // In demo mode, simulate the agent locally without calling the backend
    if (demoMode) {
      const snippet = textToSend.length > 220 ? `${textToSend.slice(0, 220)}…` : textToSend;
      const demoReply =
        `Demo mode: Based on what you just shared, I'm tightening the brief and thinking about modular content.\n\n` +
        `1) Brief refinement:\n` +
        `- I’ll treat this as an update to the narrative_brief and core fields.\n` +
        `- I’ll look for clear objectives, primary audience, and any guardrails inside:\n\"${snippet}\".\n\n` +
        `2) Next step:\n` +
        `- Once you're happy with the brief, say something like "let's build the content matrix" and I'll start suggesting rows ` +
        `(audience x stage x trigger x channel) that we can then edit in the grid on the right.`;

      setMessages([...newHistory, { role: 'assistant', content: demoReply }]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            history: newHistory,
            current_plan: previewPlan 
        }),
      });
      const data = await res.json();
      setMessages([...newHistory, { role: 'assistant', content: data.reply }]);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      if (demoMode) {
        // Lightweight client-side CSV handling for demo purposes
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        const headers = lines[0].split(',').map((h) => h.trim());
        const rows = lines.slice(1).map((line) => {
          const cols = line.split(',');
          const row: Record<string, string> = {};
          cols.forEach((val, idx) => {
            const key = headers[idx] ?? `col_${idx}`;
            row[key] = val.trim();
          });
          return row;
        });

        setPreviewPlan((prev: any) => ({
          ...prev,
          audience_matrix: rows,
          audience_headers: headers,
        }));

        const sampleRows = rows.slice(0, 3);
        const sampleJson = JSON.stringify(sampleRows, null, 2);
        const cols = headers.join(', ');

        const userMessage =
          `I just uploaded an audience matrix CSV called "${file.name}".\n` +
          `Columns: ${cols}.\n` +
          `Here is a small sample of the rows:\n${sampleJson}\n` +
          `Please use this audience structure when shaping the brief and content matrix.`;

        await sendMessage(userMessage);
      } else {
        const res = await fetch('http://localhost:8000/upload', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();

        // If this is an audience CSV, keep a structured copy in the plan
        if (data.kind === 'audience_matrix') {
          setPreviewPlan((prev: any) => ({
            ...prev,
            audience_matrix: data.rows,
            audience_headers: data.headers,
          }));

          const sampleRows = Array.isArray(data.rows) ? data.rows.slice(0, 3) : [];
          const sampleJson = JSON.stringify(sampleRows, null, 2);
          const cols = Array.isArray(data.headers) ? data.headers.join(', ') : 'N/A';

          const userMessage =
            `I just uploaded an audience matrix CSV called "${data.filename}".\n` +
            `Columns: ${cols}.\n` +
            `Here is a small sample of the rows:\n${sampleJson}\n` +
            `Please use this audience structure when shaping the brief and content matrix.`;

          await sendMessage(userMessage);
        } else {
          const preview = (data.content || '').substring(0, 200);
          const userMessage = `I just uploaded a file named "${data.filename}". Content preview: ${preview}...`;
          await sendMessage(userMessage);
        }
      }
    } catch (error) {
      console.error("Upload failed", error);
      if (!demoMode) {
        alert("Failed to upload file");
      }
      setLoading(false);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadExport = async (format: 'pdf' | 'txt' | 'json') => {
    // Keep previewPlan.content_matrix in sync with local editable grid
    const planToSend = {
      ...previewPlan,
      content_matrix: matrixRows.map((row) => ({
        asset_id: row.id,
        audience_segment: row.audience_segment,
        funnel_stage: row.funnel_stage,
        trigger: row.trigger,
        channel: row.channel,
        format: row.format,
        message: row.message,
        variant: row.variant,
      })),
    };

    if (format === 'json') {
        const blob = new Blob([JSON.stringify(planToSend, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'brief.json';
        a.click();
        return;
    }

    // In demo mode, generate a simple text export client-side for TXT/PDF
    if (demoMode) {
      const lines: string[] = [];
      lines.push(`Production Master Plan: ${planToSend.campaign_name ?? 'Untitled'}`);
      lines.push('==================================================');
      lines.push('');
      lines.push(`SMP: ${planToSend.single_minded_proposition ?? 'N/A'}`);
      lines.push('');
      if (planToSend.narrative_brief) {
        lines.push('Narrative Brief:');
        lines.push(planToSend.narrative_brief);
        lines.push('');
      }
      lines.push('Content Matrix (preview):');
      (planToSend.content_matrix || []).forEach((row: any) => {
        lines.push(
          `- asset=${row.asset_id} | audience=${row.audience_segment} | stage=${row.funnel_stage} | trigger=${row.trigger} | channel=${row.channel} | format=${row.format} | message=${row.message}`,
        );
      });
      const text = lines.join('\n') + '\n';
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `brief.${format === 'pdf' ? 'txt' : format}`;
      a.click();
      return;
    }

    try {
      const res = await fetch(`http://localhost:8000/export/${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planToSend }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `brief.${format}`;
      a.click();
    } catch (error) {
      console.error("Export failed", error);
    }
  };

  const addMatrixRow = () => {
    setMatrixRows((rows) => [
      ...rows,
      {
        id: `AST-${rows.length + 1}`.padStart(3, '0'),
        audience_segment: '',
        funnel_stage: '',
        trigger: '',
        channel: '',
        format: '',
        message: '',
        variant: '',
      },
    ]);
  };

  const updateMatrixCell = (index: number, field: keyof MatrixRow, value: string) => {
    setMatrixRows((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  };

  const removeMatrixRow = (index: number) => {
    setMatrixRows((rows) => rows.filter((_, i) => i !== index));
  };

  return (
    <main
      ref={containerRef}
      className="flex h-screen bg-[#F8FAFC] overflow-hidden font-sans text-slate-800"
    >
      
      {/* LEFT: Chat Interface */}
      {workspaceView !== 'matrix' && (
      <div
        className={`flex flex-col border-r border-gray-200 relative ${
          workspaceView === 'brief' ? 'w-full max-w-full' : 'shrink-0'
        }`}
        style={
          workspaceView === 'split'
            ? { width: `${splitRatio * 100}%` }
            : undefined
        }
      >
        
        {/* Header - IMPROVED VISIBILITY */}
        <div className="px-8 py-6 border-b border-gray-200 bg-white flex justify-between items-center shadow-sm z-10">
          <div className="flex items-center gap-6">
            <div className="h-12 w-auto">
               {/* Increased logo size and removed fixed width container constraint */}
               <img src="/logo.png" alt="Transparent Partners" className="h-12 w-auto object-contain" />
            </div>
            <div className="border-l border-slate-200 pl-6 h-10 flex flex-col justify-center">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-none mb-1">Intelligent Briefing Agent</h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Powered by Transparent Partners</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowLibrary(true)}
              className="text-xs font-semibold text-slate-500 hover:text-teal-600 transition-colors px-3 py-2 rounded-lg hover:bg-slate-50"
            >
              Brief Library
            </button>
            <div className="hidden md:flex items-center gap-1 rounded-full bg-slate-50 border border-slate-200 px-1 py-0.5">
              <button
                onClick={() => setWorkspaceView('brief')}
                className={`text-[11px] px-2 py-1 rounded-full ${
                  workspaceView === 'brief'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Brief
              </button>
              <button
                onClick={() => setWorkspaceView('split')}
                className={`text-[11px] px-2 py-1 rounded-full ${
                  workspaceView === 'split'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Split
              </button>
              <button
                onClick={() => setWorkspaceView('matrix')}
                className={`text-[11px] px-2 py-1 rounded-full ${
                  workspaceView === 'matrix'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Matrix
              </button>
            </div>
            <button
              onClick={() => setShowSample(!showSample)}
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 bg-teal-50 px-5 py-2.5 rounded-full border border-teal-100 transition-colors shadow-sm"
            >
              {showSample ? 'Hide Sample' : 'View Sample Output'}
            </button>
            <button
              onClick={() => {
                setDemoMode((prev) => !prev);
                // Reset conversation when toggling demo mode for clarity
                setMessages([
                  {
                    role: 'assistant',
                    content: !demoMode
                      ? 'Demo mode is ON. I will simulate the agent locally so you can click around the interface without a backend.'
                      : 'Demo mode is OFF. I will now talk to the live backend (when available on localhost:8000).',
                  },
                ]);
              }}
              className={`text-xs font-semibold px-4 py-2 rounded-full border transition-colors ${
                demoMode
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-500 border-slate-200 hover:text-teal-600 hover:border-teal-300'
              }`}
            >
              {demoMode ? 'Demo Mode: On' : 'Demo Mode: Off'}
            </button>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-[#F8FAFC]">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-5 rounded-2xl text-[15px] leading-relaxed shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-teal-600 text-white rounded-br-sm' 
                  : 'bg-white border border-gray-100 text-slate-700 rounded-bl-sm'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
             <div className="flex justify-start">
               <div className="bg-white border border-gray-100 px-5 py-4 rounded-2xl flex items-center gap-2 shadow-sm">
                 <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                 <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                 <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
               </div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-6 bg-white border-t border-gray-200">
          <div className="flex gap-4 items-center bg-gray-50 p-2 rounded-2xl border border-gray-200 focus-within:ring-2 focus-within:ring-teal-500/20 focus-within:border-teal-500 transition-all">
            {/* File Upload */}
            <input 
                type="file" 
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileUpload}
            />
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-3 text-slate-400 hover:text-teal-600 hover:bg-white rounded-xl transition-colors"
                title="Upload Reference Document"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
            </button>

            <input
              className="flex-1 bg-transparent border-none focus:ring-0 text-slate-800 placeholder:text-slate-400 text-base"
              placeholder="Type your response..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              disabled={loading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading}
              className="bg-teal-600 text-white px-6 py-2.5 rounded-xl hover:bg-teal-700 disabled:opacity-70 font-semibold shadow-sm transition-colors text-sm"
            >
              Send
            </button>
          </div>
        </div>
        
        {/* Sample Brief Modal Overlay */}
        {showSample && (
            <div className="absolute inset-0 bg-white/98 backdrop-blur-md z-20 flex flex-col animate-in fade-in duration-200">
                <div className="flex justify-between items-center px-8 py-6 border-b border-gray-100">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Sample Output: "Summer Glow 2024"</h2>
                        <p className="text-sm text-slate-500">This is what a completed Master Plan looks like.</p>
                    </div>
                    <button 
                        onClick={() => setShowSample(false)}
                        className="p-2 hover:bg-gray-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                {/* Tabs */}
                <div className="flex border-b border-gray-200 px-8">
                    <button 
                        onClick={() => setSampleTab('narrative')}
                        className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${sampleTab === 'narrative' ? 'border-teal-500 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        Narrative Brief
                    </button>
                    <button 
                        onClick={() => setSampleTab('matrix')}
                        className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${sampleTab === 'matrix' ? 'border-teal-500 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        Content Matrix
                    </button>
                    <button 
                        onClick={() => setSampleTab('json')}
                        className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${sampleTab === 'json' ? 'border-teal-500 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        JSON Data
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
                    {sampleTab === 'narrative' && (
                        <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-gray-200">
                            <pre className="whitespace-pre-wrap font-sans text-slate-600 leading-relaxed">
                                {SAMPLE_NARRATIVE}
                            </pre>
                        </div>
                    )}

                    {sampleTab === 'matrix' && (
                        <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-100 text-slate-600 font-semibold uppercase tracking-wider text-xs">
                                    <tr>
                                        <th className="px-6 py-4">ID</th>
                                        <th className="px-6 py-4">Audience Segment</th>
                                        <th className="px-6 py-4">Trigger / Condition</th>
                                        <th className="px-6 py-4">Content Focus</th>
                                        <th className="px-6 py-4">Format</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {SAMPLE_MATRIX.map((row, i) => (
                                        <tr key={i} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 font-mono text-slate-500">{row.id}</td>
                                            <td className="px-6 py-4 text-slate-800 font-medium">{row.audience}</td>
                                            <td className="px-6 py-4 text-blue-600 bg-blue-50/50 rounded">{row.trigger}</td>
                                            <td className="px-6 py-4 text-slate-600">{row.content}</td>
                                            <td className="px-6 py-4 text-slate-500">{row.format}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {sampleTab === 'json' && (
                        <div className="max-w-4xl mx-auto bg-slate-900 p-6 rounded-xl shadow-lg overflow-auto">
                            <pre className="font-mono text-xs text-green-400">
                                {JSON.stringify(SAMPLE_JSON, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* Historical Brief Library Modal */}
        {showLibrary && (
          <div className="absolute inset-0 bg-white/98 backdrop-blur-md z-30 flex flex-col">
            <div className="flex justify-between items-center px-8 py-6 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Historical Intelligent Content Briefs</h2>
                <p className="text-sm text-slate-500">
                  Reference-ready examples of completed briefs and content plans for different categories.
                </p>
              </div>
              <button
                onClick={() => setShowLibrary(false)}
                className="p-2 hover:bg-gray-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto">
                {HISTORICAL_BRIEFS.map((brief) => (
                  <div
                    key={brief.id}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-slate-900">{brief.campaign_name}</h3>
                        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                          {brief.id}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-slate-600">
                        SMP: <span className="font-normal">{brief.single_minded_proposition}</span>
                      </p>
                      <p className="text-xs text-slate-500">
                        Primary audience: {brief.primary_audience}
                      </p>
                      <div className="bg-slate-50 rounded-lg border border-slate-100 p-3">
                        <p className="text-[11px] text-slate-500 mb-1 font-semibold uppercase tracking-wide">
                          Narrative excerpt
                        </p>
                        <pre className="text-[11px] text-slate-600 whitespace-pre-wrap max-h-40 overflow-y-auto">
                          {brief.narrative_brief.trim()}
                        </pre>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-between items-center">
                      <span className="text-[11px] text-slate-400">
                        Content matrix + concepts available in final plan (coming soon).
                      </span>
                      <button
                        disabled
                        className="text-[11px] px-3 py-1.5 rounded-full border border-slate-200 text-slate-400 cursor-not-allowed"
                      >
                        Load into agent (future)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* RIGHT: Live Preview / Content Matrix Workspace */}
      {workspaceView !== 'brief' && (
      <>
        {/* Draggable divider in split view on desktop */}
        {workspaceView === 'split' && (
          <div
            className="hidden md:block w-1 bg-slate-200 hover:bg-slate-300 cursor-col-resize"
            onMouseDown={() => setIsDraggingDivider(true)}
          />
        )}
        <div
          className={`bg-white border-l border-gray-200 hidden md:flex flex-col shadow-xl z-20 ${
            workspaceView === 'matrix' ? 'w-full' : 'shrink-0'
          }`}
          style={
            workspaceView === 'split'
              ? { width: `${(1 - splitRatio) * 100}%` }
              : undefined
          }
        >
        <div className="px-6 py-5 border-b border-gray-100 bg-white flex justify-between items-center select-none">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Live Draft</h2>
            <div className="flex gap-2">
                <button onClick={() => downloadExport('json')} className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-teal-600 bg-slate-100 hover:bg-teal-50 rounded transition-colors">JSON</button>
                <button onClick={() => downloadExport('txt')} className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-teal-600 bg-slate-100 hover:bg-teal-50 rounded transition-colors">TXT</button>
                <button onClick={() => downloadExport('pdf')} className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-teal-600 bg-slate-100 hover:bg-teal-50 rounded transition-colors">PDF</button>
            </div>
        </div>
        
        <div className="flex-1 p-6 overflow-y-auto bg-slate-50/30">
            <div className="space-y-6">
                {matrixRows.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 gap-4 mt-20">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                        />
                      </svg>
                    </div>
                    <p className="text-sm max-w-[240px]">
                      After your brief is complete, start sketching the content matrix here. Use the button below to add rows.
                    </p>
                    <button
                      onClick={addMatrixRow}
                      className="mt-2 px-4 py-2 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-full border border-teal-100"
                    >
                      Add first row
                    </button>
                  </div>
                ) : (
                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Content Matrix</h3>
                      <button
                        onClick={addMatrixRow}
                        className="text-xs text-teal-600 hover:text-teal-700 font-medium px-3 py-1 rounded-full bg-teal-50 border border-teal-100"
                      >
                        + Add row
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr>
                            <th className="px-2 py-2">Asset ID</th>
                            <th className="px-2 py-2">Audience</th>
                            <th className="px-2 py-2">Stage</th>
                            <th className="px-2 py-2">Trigger</th>
                            <th className="px-2 py-2">Channel</th>
                            <th className="px-2 py-2">Format</th>
                            <th className="px-2 py-2">Message</th>
                            <th className="px-2 py-2">Variant</th>
                            <th className="px-2 py-2"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {matrixRows.map((row, index) => (
                            <tr key={index} className="align-top">
                              {(['id', 'audience_segment', 'funnel_stage', 'trigger', 'channel', 'format', 'message', 'variant'] as const).map(
                                (field) => (
                                  <td key={field} className="px-2 py-1">
                                    <input
                                      value={row[field]}
                                      onChange={(e) => updateMatrixCell(index, field, e.target.value)}
                                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500"
                                    />
                                  </td>
                                ),
                              )}
                              <td className="px-2 py-1 text-right">
                                <button
                                  onClick={() => removeMatrixRow(index)}
                                  className="text-[11px] text-slate-400 hover:text-red-500"
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
            </div>
        </div>
        </div>
      </>
      )}

    </main>
  );
}
