
import React from 'react';

interface CodeViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const pythonCode = `"""
Margam AI - PRODUCTION BACKEND
Architecture: FastAPI + LangGraph + LlamaIndex
Engine: Google Gemini-3-Flash
"""

import os
from fastapi import FastAPI
from langgraph.graph import StateGraph, END

app = FastAPI(title="Margam AI Core")

# --- AGENTIC RAG FLOW ---
def retrieve_docs(state):
    # Retrieve knowledge from student_vault
    return {"context": "extracted_data", "steps": ["RETRIEVAL"]}

def synthesize_answer(state):
    # Gemini synthesizing reasoning
    return {"final_answer": "response", "steps": ["SYNTHESIS"]}

# Graph Assembly
builder = StateGraph(dict)
builder.add_node("retrieve", retrieve_docs)
builder.add_node("synthesize", synthesize_answer)
builder.set_entry_point("retrieve")
builder.add_edge("retrieve", "synthesize")
builder.add_edge("synthesize", END)

margam_brain = builder.compile()`;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/10 backdrop-blur-md animate-message">
      <div className="bg-white border border-slate-200 w-full max-w-4xl max-h-[85vh] rounded-[40px] overflow-hidden shadow-2xl flex flex-col">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">
                Margam AI Core
              </h2>
            </div>
            <p className="text-[9px] text-slate-400 mt-2 uppercase tracking-wider font-black">Python LangGraph Agent</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition-all text-slate-400">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-10 bg-slate-50 font-mono text-[13px] leading-relaxed">
           <pre className="text-slate-600">
            <code>{pythonCode}</code>
          </pre>
        </div>
        
        <div className="p-6 border-t border-slate-100 bg-white flex justify-between items-center">
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">Enterprise Ready</span>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(pythonCode);
              alert('Code copied.');
            }}
            className="text-[10px] font-black text-white bg-slate-900 px-6 py-2 rounded-full hover:bg-slate-800 transition-all uppercase tracking-wide"
          >
            Copy Script
          </button>
        </div>
      </div>
    </div>
  );
};
