import React from 'react';
import { CitationItem } from '../types';

interface CitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  citations: CitationItem[];
  activeCitation?: CitationItem | null;
}

export const CitationModal: React.FC<CitationModalProps> = ({
  isOpen,
  onClose,
  citations,
  activeCitation
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 animate-stage overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800">Verified Knowledge Sources</h3>
              <p className="text-xs text-slate-500">Official university & visa documentation excerpts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content list */}
        <div className="p-6 overflow-y-auto space-y-4">
          {citations.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No specific source citations available for this answer.</p>
          ) : (
            citations.map((c, idx) => {
              const isSelected = activeCitation && activeCitation.source === c.source && activeCitation.page === c.page;
              return (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-blue-400 bg-blue-50/50 shadow-sm ring-2 ring-blue-100'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md">
                      Source #{idx + 1}
                    </span>
                    {c.page !== undefined && c.page !== null && (
                      <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        Page {c.page}
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-1.5 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {c.source}
                  </h4>
                  {c.snippet && (
                    <blockquote className="text-xs leading-relaxed text-slate-600 bg-slate-50 p-3 rounded-lg border-l-2 border-blue-400 italic">
                      "{c.snippet}..."
                    </blockquote>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

