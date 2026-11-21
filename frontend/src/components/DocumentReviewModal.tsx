import React, { useState, useRef } from 'react';
import { API_BASE_URL } from '../config';
import { DocumentAnalysisResult } from '../types';

interface DocumentReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetCountry: string;
  onInsertReviewToChat: (reviewText: string) => void;
}

export const DocumentReviewModal: React.FC<DocumentReviewModalProps> = ({
  isOpen,
  onClose,
  targetCountry,
  onInsertReviewToChat
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<'sop' | 'resume' | 'transcript'>('sop');
  const [selectedCountry, setSelectedCountry] = useState<string>(targetCountry || 'Germany');
  const [targetDegree, setTargetDegree] = useState<string>("Master's");
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [result, setResult] = useState<DocumentAnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setErrorMsg('');
      setResult(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      setErrorMsg('Please select a file to evaluate.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMsg('');
    try {
      const API_URL = API_BASE_URL;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('doc_type', docType);
      formData.append('country', selectedCountry);
      formData.append('target_degree', targetDegree);

      const resp = await fetch(`${API_URL}/analyze-document`, {
        method: 'POST',
        body: formData
      });

      if (!resp.ok) {
        throw new Error(`Analysis server returned ${resp.status}`);
      }

      const data = await resp.json();
      if (data.analysis) {
        setResult(data.analysis);
      } else {
        throw new Error('No structured analysis returned.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to analyze document. Please check server.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleInsert = () => {
    if (result && file) {
      const formatted = `**Document Audit Report: ${file.name}**\n\n- **Type**: ${docType.toUpperCase()}\n- **Target**: ${selectedCountry} (${targetDegree})\n- **Score**: ${result.overall_score}/10 (${result.verdict})\n- **Summary**: ${result.summary}\n\n**Strengths:**\n${result.strengths.map(s => `- ${s}`).join('\n')}\n\n**Critical Gaps / Fixes Needed:**\n${result.critical_gaps.map(g => `- ${g}`).join('\n')}\n\n**${selectedCountry} Visa & University Advice:**\n${result.country_specific_advice}\n\nHow can I improve my draft to increase acceptance chances?`;
      onInsertReviewToChat(formatted);
      onClose();
    }
  };

  const founderWhatsAppUrl = `https://wa.me/919347997790?text=${encodeURIComponent(
    `Hi Jeevithram & Margam Team! I evaluated my ${docType.toUpperCase()} for ${selectedCountry} (${targetDegree}) on Margam AI (Score: ${
      result?.overall_score || 8
    }/10 - ${result?.verdict || 'Evaluation'}). I would like your 1-on-1 personal mentorship and review on my draft.`
  )}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[92vh] shadow-2xl border border-slate-800 animate-stage overflow-hidden flex flex-col text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-white">SOP & Resume AI Auditor</h3>
              <p className="text-xs text-slate-400">Academic & visa alignment audit for top global destinations</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Guardrail Policy Pill */}
        <div className="bg-blue-950/40 px-6 py-2.5 border-b border-blue-900/60 text-[11px] text-blue-300 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span><strong>Guardrailed Audit Mode:</strong> Diagnoses structure & red flags without AI ghostwriting.</span>
          </span>
          <span className="font-semibold text-blue-400">Founder SOP Review Available</span>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Document Type</label>
              <select
                value={docType}
                onChange={e => setDocType(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-blue-500"
              >
                <option value="sop">Statement of Purpose (SOP)</option>
                <option value="resume">Academic CV / Resume</option>
                <option value="transcript">Transcript / Profile</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Target Country</label>
              <select
                value={selectedCountry}
                onChange={e => setSelectedCountry(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-blue-500"
              >
                <option value="Germany">Germany (€0 Tuition)</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="USA">USA (F-1 / STEM OPT)</option>
                <option value="Canada">Canada (DLI / GIC)</option>
                <option value="Australia">Australia (Subclass 500)</option>
                <option value="Ireland">Ireland</option>
                <option value="France">France</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Target Degree</label>
              <select
                value={targetDegree}
                onChange={e => setTargetDegree(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-blue-500"
              >
                <option value="Master's">Master's (MS/MSc)</option>
                <option value="Bachelor's">Bachelor's</option>
                <option value="MBA">MBA</option>
                <option value="PhD">PhD / Research</option>
              </select>
            </div>
          </div>

          {/* Upload Area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50/60 hover:bg-blue-50/30 p-6 rounded-2xl cursor-pointer transition-all text-center flex flex-col items-center justify-center gap-2 group"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.docx,.txt"
              className="hidden"
            />
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            {file ? (
              <div>
                <p className="text-sm font-semibold text-slate-800">{file.name}</p>
                <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB · Click to change file</p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-slate-700">Click to upload your draft</p>
                <p className="text-xs text-slate-400">PDF, DOCX, or TXT (Max 10MB)</p>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* Analyze Action */}
          <button
            onClick={handleAnalyze}
            disabled={!file || isAnalyzing}
            className="w-full py-3 bg-blue-600 text-white rounded-xl text-xs font-semibold uppercase tracking-wider hover:bg-blue-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-2"
          >
            {isAnalyzing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Auditing {docType.toUpperCase()} against {selectedCountry} standards...
              </>
            ) : (
              `Run ${docType.toUpperCase()} Audit`
            )}
          </button>

          {/* Analysis Results Display */}
          {result && (
            <div className="space-y-4 pt-3 border-t border-slate-100 animate-stage">
              {/* Score Banner */}
              <div className="p-4 bg-gradient-to-r from-slate-900 to-blue-950 rounded-2xl text-white flex items-center justify-between shadow-md">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-lg font-bold">
                    {result.overall_score}/10
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Evaluation Verdict</span>
                    <h4 className="text-base font-bold text-white">{result.verdict}</h4>
                  </div>
                </div>
                <span className="text-xs text-slate-300 font-semibold bg-white/10 px-3 py-1 rounded-lg">
                  {selectedCountry} Benchmark
                </span>
              </div>

              {/* Summary */}
              <p className="text-xs leading-relaxed text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                {result.summary}
              </p>

              {/* Strengths & Gaps */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 bg-emerald-950/40 border border-emerald-800/60 rounded-xl space-y-1.5">
                  <h5 className="font-semibold text-emerald-400 flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-emerald-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Key Strengths</span>
                  </h5>
                  <ul className="list-disc list-inside text-emerald-200/90 space-y-1">
                    {result.strengths.map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-3.5 bg-amber-950/40 border border-amber-800/60 rounded-xl space-y-1.5">
                  <h5 className="font-semibold text-amber-400 flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>Critical Improvements Needed</span>
                  </h5>
                  <ul className="list-disc list-inside text-amber-200/90 space-y-1">
                    {result.critical_gaps.map((g, idx) => (
                      <li key={idx}>{g}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Country Advice */}
              <div className="p-3.5 bg-blue-950/40 border border-blue-800/60 rounded-xl text-xs space-y-1">
                <h5 className="font-semibold text-blue-300">
                  {selectedCountry} Visa & University Expectations:
                </h5>
                <p className="text-slate-300 leading-relaxed">{result.country_specific_advice}</p>
              </div>

              {/* Founder SOP Mentorship Card */}
              <div className="p-4 bg-gradient-to-r from-blue-950/60 via-indigo-950/40 to-slate-900 rounded-2xl border border-blue-800/80 text-xs space-y-2">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="font-bold text-white">Founder Jeevithram's Personal Touch</span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  Unlike automated AI rewrites, Jeevithram personally reviews every student's SOP to craft a genuine, human story that top Russell Group & TU9 professors respect.
                </p>
                <a
                  href={founderWhatsAppUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span>Request 1-on-1 Founder SOP Polish</span>
                  <span>→</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
          >
            Close
          </button>
          {result && (
            <button
              onClick={handleInsert}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Add Report to Chat
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
