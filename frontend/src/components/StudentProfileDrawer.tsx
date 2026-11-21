import React, { useState, useEffect } from 'react';
import { StudentProfile } from '../types';

interface StudentProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  profile: StudentProfile;
  onUpdateProfile: (updated: StudentProfile) => void;
  userName: string;
  phone?: string;
}

export const StudentProfileDrawer: React.FC<StudentProfileDrawerProps> = ({
  isOpen,
  onClose,
  profile,
  onUpdateProfile,
  userName,
  phone
}) => {
  const [formData, setFormData] = useState<StudentProfile>(profile);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setFormData(profile);
  }, [profile]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile(formData);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const countries = ['Germany', 'United Kingdom', 'Ireland', 'France', 'USA', 'Canada', 'Australia'];
  const intakes = ['Fall 2026', 'Spring 2027', 'Fall 2027', 'Spring 2028'];
  const degrees = ["Master's (MS/MSc)", "Bachelor's (BSc/BA)", "MBA", "PhD"];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-md bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-800 animate-stage text-slate-100">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
              {userName ? userName.charAt(0).toUpperCase() : 'S'}
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">{userName || 'Student'} Profile</h3>
              <p className="text-xs text-blue-400 font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                AI Memory Sync Active
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="p-3 bg-blue-950/40 rounded-xl border border-blue-900/60 text-xs text-slate-300 leading-relaxed">
            Margam AI continuously detects your preferences from our conversation. You can also customize them directly below to tune recommendations.
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Target Destination
            </label>
            <select
              value={formData.target_country || ''}
              onChange={e => setFormData({ ...formData, target_country: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-800 text-white"
            >
              <option value="">Select country...</option>
              {countries.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Target Intake
            </label>
            <select
              value={formData.target_intake || ''}
              onChange={e => setFormData({ ...formData, target_intake: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-800 text-white"
            >
              <option value="">Select intake...</option>
              {intakes.map(i => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Degree Level
            </label>
            <select
              value={formData.degree_level || ''}
              onChange={e => setFormData({ ...formData, degree_level: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-800 text-white"
            >
              <option value="">Select degree...</option>
              {degrees.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Field / Major
            </label>
            <input
              type="text"
              placeholder="e.g. Computer Science, Data Science, Mechanical"
              value={formData.field_of_study || ''}
              onChange={e => setFormData({ ...formData, field_of_study: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-800 text-white placeholder-slate-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Budget / Funding Plan
            </label>
            <input
              type="text"
              placeholder="e.g. ₹15-20 Lakhs, Education Loan, €0 Tuition"
              value={formData.budget_range || ''}
              onChange={e => setFormData({ ...formData, budget_range: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-800 text-white placeholder-slate-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Test Scores (GRE / IELTS / TOEFL / CGPA)
            </label>
            <input
              type="text"
              placeholder="e.g. IELTS 7.5, GRE 320, CGPA 8.4/10"
              value={formData.test_scores || ''}
              onChange={e => setFormData({ ...formData, test_scores: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-800 text-white placeholder-slate-500"
            />
          </div>

          {phone && (
            <div className="pt-2 text-xs text-slate-400">
              Verified WhatsApp: <span className="font-semibold text-slate-200">{phone}</span>
            </div>
          )}

          {/* Action Footer */}
          <div className="pt-4 border-t border-slate-800 space-y-2.5">
            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs uppercase tracking-wider shadow-sm transition-all active:scale-[0.99] cursor-pointer"
            >
              {isSaved ? 'Preferences Saved to Memory' : 'Save Memory Preferences'}
            </button>

            <a
              href={`https://wa.me/919347997790?text=${encodeURIComponent(
                `Hi Margam! I'm ${userName || 'Student'}. Continuing my study abroad session from the web.`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="w-full py-2.5 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/80 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span>Continue on WhatsApp (+91 93479 97790)</span>
              <span>→</span>
            </a>
          </div>
        </form>
      </div>
    </div>
  );
};
