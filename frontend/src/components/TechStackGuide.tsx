
import React from 'react';
import { TechStackItem } from '../types';

const detailedStack: TechStackItem[] = [
  {
    category: "LLM Orchestration",
    name: "Brain",
    tech: "Gemini 3 Pro + Flash",
    description: "Multimodal reasoning engine.",
    why: "Native support for PDF/Video/Audio context windows.",
    icon: "AI"
  },
  {
    category: "Agentic Loop",
    name: "Memory",
    tech: "LangGraph",
    description: "Stateful agent loops.",
    why: "Enables multi-turn research sessions and tool calling.",
    icon: "AG"
  },
  {
    category: "Knowledge Base",
    name: "Vector Store",
    tech: "ChromaDB / Pinecone",
    description: "Semantic search repository.",
    why: "Efficient RAG across thousands of student documents.",
    icon: "KB"
  },
  {
    category: "Messaging Edge",
    name: "Channel",
    tech: "WhatsApp Cloud API",
    description: "Omnichannel deployment.",
    why: "Students interact directly from their preferred app.",
    icon: "WA"
  }
];

export const TechStackGuide: React.FC = () => {
  return (
    <div className="bg-white flex flex-col font-sans">
      <div className="mb-20">
        <h2 className="serif text-6xl text-slate-900 tracking-tight mb-6">System <br/>Architecture.</h2>
        <p className="text-slate-500 text-lg leading-relaxed max-w-xl">
          The foundation of Margam AI is a modular agentic framework designed for high-precision educational retrieval.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {detailedStack.map((item, idx) => (
          <div key={idx} className="group border-b border-slate-100 pb-12 hover:border-blue-500 transition-colors">
            <div className="flex gap-6 items-start">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 group-hover:bg-blue-50 transition-colors">
                {item.icon}
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">{item.tech}</h3>
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{item.category}</span>
                </div>
                <p className="text-slate-600 text-sm leading-relaxed">{item.why}</p>
                <div className="pt-2 flex items-center gap-2 text-[10px] font-bold text-slate-400 italic">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M5 13l4 4L19 7" strokeWidth={3}/></svg>
                  Status: Development Ready
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-20 p-10 bg-slate-900 rounded-[3rem] text-white flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="space-y-2">
          <h4 className="serif text-3xl">WhatsApp Integration</h4>
          <p className="text-slate-400 text-sm">Ready to bridge the gap between AI and Student Life.</p>
        </div>
        <button className="bg-white text-black px-10 py-4 rounded-full font-black text-xs uppercase tracking-wide hover:bg-blue-500 hover:text-white transition-all">
          View Webhook Logic
        </button>
      </div>
    </div>
  );
};
