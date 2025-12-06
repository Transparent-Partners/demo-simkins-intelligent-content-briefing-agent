'use client';
import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

type Message = {
  role: 'user' | 'assistant';
  content: string;
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

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello! I am your Creative Strategy Architect. I can help you build a production-ready intelligent content brief. Shall we start with the Campaign Name and your primary goal?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Sample View State
  const [showSample, setShowSample] = useState(false);
  const [sampleTab, setSampleTab] = useState<'narrative' | 'matrix' | 'json'>('narrative');

  // This would eventually be live-updated from the backend
  const [previewPlan, setPreviewPlan] = useState<any>({}); 
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const sendMessage = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim()) return;

    const newHistory = [...messages, { role: 'user' as const, content: textToSend }];
    setMessages(newHistory);
    setInput('');
    setLoading(true);

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
      const res = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      
      const userMessage = `I just uploaded a file named "${data.filename}". Content preview: ${data.content.substring(0, 200)}...`;
      await sendMessage(userMessage);
      
    } catch (error) {
      console.error("Upload failed", error);
      alert("Failed to upload file");
      setLoading(false);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadExport = async (format: 'pdf' | 'txt' | 'json') => {
    if (format === 'json') {
        const blob = new Blob([JSON.stringify(previewPlan, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'brief.json';
        a.click();
        return;
    }

    try {
        const res = await fetch(`http://localhost:8000/export/${format}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan: previewPlan }),
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

  return (
    <main className="flex h-screen bg-[#F8FAFC] overflow-hidden font-sans text-slate-800">
      
      {/* LEFT: Chat Interface */}
      <div className="flex-1 flex flex-col border-r border-gray-200 relative max-w-[65%]">
        
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
          <div className="flex items-center gap-4">
            <button className="text-xs font-semibold text-slate-500 hover:text-teal-600 transition-colors px-3 py-2 rounded-lg hover:bg-slate-50">
              Brief Library
            </button>
            <button 
              onClick={() => setShowSample(!showSample)}
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 bg-teal-50 px-5 py-2.5 rounded-full border border-teal-100 transition-colors shadow-sm"
            >
              {showSample ? 'Hide Sample' : 'View Sample Output'}
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
      </div>

      {/* RIGHT: Live Preview */}
      <div className="w-[35%] bg-white border-l border-gray-200 hidden md:flex flex-col shadow-xl z-20">
        <div className="px-6 py-5 border-b border-gray-100 bg-white flex justify-between items-center">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Live Draft</h2>
            <div className="flex gap-2">
                <button onClick={() => downloadExport('json')} className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-teal-600 bg-slate-100 hover:bg-teal-50 rounded transition-colors">JSON</button>
                <button onClick={() => downloadExport('txt')} className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-teal-600 bg-slate-100 hover:bg-teal-50 rounded transition-colors">TXT</button>
                <button onClick={() => downloadExport('pdf')} className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-teal-600 bg-slate-100 hover:bg-teal-50 rounded transition-colors">PDF</button>
            </div>
        </div>
        
        <div className="flex-1 p-6 overflow-y-auto bg-slate-50/30">
            <div className="space-y-6">
                {Object.keys(previewPlan).length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 gap-4 mt-20">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                        <p className="text-sm max-w-[200px]">As you chat, the agent will build the content matrix here.</p>
                    </div>
                ) : (
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono">
                            {JSON.stringify(previewPlan, null, 2)}
                        </pre>
                    </div>
                )}
            </div>
        </div>
      </div>

    </main>
  );
}
