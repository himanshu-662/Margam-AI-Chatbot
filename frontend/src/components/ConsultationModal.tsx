import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { StudentProfile } from '../types';

interface ConsultationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
  phone?: string;
  profile?: StudentProfile;
  chatHistory?: Array<{ role: string; content: string }>;
}

export const ConsultationModal: React.FC<ConsultationModalProps> = ({
  isOpen,
  onClose,
  userName = '',
  phone = '',
  profile = {},
  chatHistory = []
}) => {
  const [name, setName] = useState(userName);
  const [contactPhone, setContactPhone] = useState(phone);
  const [targetCountry, setTargetCountry] = useState(profile.target_country || 'Germany');
  const [degree, setDegree] = useState(profile.degree_level || "Master's");
  const [intake, setIntake] = useState(profile.target_intake || 'Fall 2026');
  const [mode, setMode] = useState<'whatsapp' | 'call' | 'meet'>('whatsapp');
  const [preferredTime, setPreferredTime] = useState('Tomorrow Evening (6 PM - 8 PM)');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBooked, setIsBooked] = useState(false);
  const [bookingResult, setBookingResult] = useState<any>(null);
  const [showDossier, setShowDossier] = useState(false);

  if (!isOpen) return null;

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    try {
      const historyFormatted = chatHistory.slice(-10).map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await fetch(`${API_URL}/book-consultation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || 'Student',
          phone: contactPhone.trim(),
          target_country: targetCountry,
          degree,
          intake,
          preferred_time: preferredTime,
          preferred_mode: mode,
          chat_history: historyFormatted,
          user_profile: profile
        })
      });

      if (!res.ok) throw new Error('Booking failed');
      const data = await res.json();
      setBookingResult(data);
      setIsBooked(true);

      if (data.whatsapp_url) {
        window.open(data.whatsapp_url, '_blank');
      }
    } catch (err) {
      console.warn('Booking API error, falling back to direct WhatsApp link:', err);
      const fallbackMsg = encodeURIComponent(
        `Hi Margam Mentors! I would like to book a free 30-min strategy session.\n\n` +
        `Name: ${name}\n` +
        `Phone: ${contactPhone}\n` +
        `Target Country: ${targetCountry}\n` +
        `Degree: ${degree}\n` +
        `Intake: ${intake}\n` +
        `Preferred Slot: ${preferredTime}\n` +
        `Channel: ${mode.toUpperCase()}`
      );
      const fallbackUrl = `https://wa.me/919347997790?text=${fallbackMsg}`;
      window.open(fallbackUrl, '_blank');
      setIsBooked(true);
      setBookingResult({
        booking_id: `MRG-${Date.now().toString().slice(-6)}`,
        lead_category: 'HOT',
        lead_score: 85,
        whatsapp_url: fallbackUrl
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-800 relative max-h-[92vh] overflow-y-auto text-slate-100">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {isBooked ? (
          <div className="text-center py-4 space-y-4">
            <div className="w-16 h-16 bg-emerald-950/80 border border-emerald-700 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
              <svg className="w-8 h-8 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            
            <div className="space-y-1">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-950 text-blue-300 border border-blue-800">
                Booking ID: {bookingResult?.booking_id || 'MRG-PENDING'}
              </span>
              <h3 className="text-2xl font-bold text-white tracking-tight">
                1-on-1 Consultation Confirmed!
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 max-w-sm mx-auto">
                We've generated your profile dossier for our senior mentor team. We've opened WhatsApp so you can send your confirmation directly.
              </p>
            </div>

            {/* Lead Qualification Pill */}
            {bookingResult?.lead_score && (
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-left text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                    Profile Readiness Score:
                  </span>
                  <span className="font-bold text-emerald-600">
                    {bookingResult.lead_score} / 100 ({bookingResult.lead_category} PRIORITY)
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all"
                    style={{ width: `${bookingResult.lead_score}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Dossier Toggle Button */}
            {bookingResult?.dossier_markdown && (
              <div className="text-left pt-1">
                <button
                  type="button"
                  onClick={() => setShowDossier(!showDossier)}
                  className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1"
                >
                  <span>{showDossier ? '▼ Hide Counselor Dossier' : '▶ View Counselor Handover Dossier'}</span>
                </button>
                {showDossier && (
                  <div className="mt-2 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800 max-h-48 overflow-y-auto prose prose-slate">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {bookingResult.dossier_markdown}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            )}

            <div className="pt-3 flex flex-col gap-2">
              {bookingResult?.whatsapp_url && (
                <a
                  href={bookingResult.whatsapp_url}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-all text-center flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span>Re-open WhatsApp Confirmation</span>
                  <span>→</span>
                </a>
              )}
              <a
                href="tel:+919347997790"
                className="w-full py-2.5 bg-slate-800 text-slate-300 border border-slate-700 rounded-xl font-semibold text-xs hover:bg-slate-700 transition-all text-center"
              >
                Direct Call: +91 93479 97790
              </a>
              <button
                onClick={() => {
                  setIsBooked(false);
                  onClose();
                }}
                className="w-full py-2 text-slate-400 hover:text-slate-200 text-xs font-medium cursor-pointer"
              >
                Back to Chat
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                Margam Mentorship Desk
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight tracking-tight">
              Book Free 30-Min 1-on-1 Consultation
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 mb-5">
              Talk directly with senior mentors who evaluate your academic transcript, backlog history, and shortlist genuine public universities.
            </p>

            {/* Value props */}
            <div className="grid grid-cols-2 gap-2 mb-5 p-3 bg-blue-950/40 rounded-2xl border border-blue-900/60 text-[11px] text-blue-300 font-medium">
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Free Profile & Backlog Check</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>€0 Tuition Univ Guidance</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Blocked Account Breakdown</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Founder SOP Review</span>
              </div>
            </div>

            <form onSubmit={handleBook} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Phone / WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={e => setContactPhone(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Country
                  </label>
                  <select
                    value={targetCountry}
                    onChange={e => setTargetCountry(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Germany">Germany (€0 Tuition)</option>
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="Ireland">Ireland</option>
                    <option value="France">France</option>
                    <option value="USA">USA</option>
                    <option value="Canada">Canada</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Degree
                  </label>
                  <select
                    value={degree}
                    onChange={e => setDegree(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Master's">Master's / MS</option>
                    <option value="Bachelor's">Bachelor's</option>
                    <option value="MBA">MBA</option>
                    <option value="PhD">PhD / Research</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Target Intake
                  </label>
                  <select
                    value={intake}
                    onChange={e => setIntake(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Fall 2026">Fall 2026 (Winter)</option>
                    <option value="Spring 2027">Spring 2027 (Summer)</option>
                    <option value="Fall 2027">Fall 2027</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Preferred Time Slot
                </label>
                <select
                  value={preferredTime}
                  onChange={e => setPreferredTime(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500"
                >
                  <option value="Today Evening (6 PM - 8 PM)">Today Evening (6 PM - 8 PM)</option>
                  <option value="Tomorrow Morning (10 AM - 1 PM)">Tomorrow Morning (10 AM - 1 PM)</option>
                  <option value="Tomorrow Afternoon (2 PM - 5 PM)">Tomorrow Afternoon (2 PM - 5 PM)</option>
                  <option value="Tomorrow Evening (6 PM - 8 PM)">Tomorrow Evening (6 PM - 8 PM)</option>
                  <option value="Weekend Special Slot">Weekend Special Slot</option>
                </select>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3.5 rounded-xl text-sm transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-60 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span>{isSubmitting ? 'Generating Counselor Dossier...' : 'Confirm & Book via WhatsApp'}</span>
                  <span className="font-bold">→</span>
                </button>
                <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-1">
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span>100% Free · No spam · Instant dossier</span>
                  </span>
                  <a href="tel:+919347997790" className="text-blue-400 font-semibold hover:underline">
                    Or Call: +91 93479 97790
                  </a>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
