import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Lead {
  booking_id: string;
  name: string;
  phone: string;
  target_country: string;
  degree: string;
  intake: string;
  preferred_time: string;
  preferred_mode: string;
  lead_score: number;
  lead_category: 'HOT' | 'WARM' | 'COLD';
  recommended_action: string;
  created_at: string;
}

interface AnalyticsMetrics {
  total_leads: number;
  lead_distribution: {
    HOT: number;
    WARM: number;
    COLD: number;
  };
  total_sessions: number;
  average_session_turns: number;
  chatbot_conversion_rate: number;
  destination_breakdown: Record<string, number>;
  timestamp: string;
}

interface CounselorDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CounselorDashboardModal: React.FC<CounselorDashboardModalProps> = ({ isOpen, onClose }) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [dossierMarkdown, setDossierMarkdown] = useState<string>('');
  const [loadingDossier, setLoadingDossier] = useState(false);
  
  // Filters
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'HOT' | 'WARM' | 'COLD'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [leadsRes, metricsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/leads`),
        fetch(`${API_BASE_URL}/analytics/metrics`)
      ]);

      if (leadsRes.ok) {
        const data = await leadsRes.json();
        setLeads(data.leads || []);
      }
      if (metricsRes.ok) {
        const mData = await metricsRes.json();
        setMetrics(mData);
      }
    } catch (err) {
      console.error('Error fetching counselor data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const viewDossier = async (lead: Lead) => {
    setSelectedLead(lead);
    setLoadingDossier(true);
    try {
      const res = await fetch(`${API_BASE_URL}/leads/${lead.booking_id}/dossier`);
      if (res.ok) {
        const data = await res.json();
        setDossierMarkdown(data.dossier_markdown || '');
      } else {
        setDossierMarkdown('# Dossier Not Found\nCould not locate the generated dossier file.');
      }
    } catch (err) {
      setDossierMarkdown('# Error Loading Dossier\nCould not fetch the dossier from backend.');
    } finally {
      setLoadingDossier(false);
    }
  };

  if (!isOpen) return null;

  const filteredLeads = leads.filter((lead) => {
    const matchesCategory = categoryFilter === 'ALL' || lead.lead_category === categoryFilter;
    const matchesSearch = 
      lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.phone.includes(searchQuery) ||
      lead.target_country.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.booking_id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 bg-slate-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 font-bold text-lg">
              <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white">Margam Counselor CRM & Conversion Hub</h2>
                <span className="text-xs bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-2.5 py-0.5 rounded-full font-medium">
                  Internal Portal
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Qualified pipeline, real-time conversion KPIs, and Founder handover dossiers
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 rounded-xl transition-all cursor-pointer"
              title="Refresh Data"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 rounded-xl transition-all cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-900/50">
          
          {/* Top KPI Metric Cards */}
          {metrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-850 border border-slate-750 p-4 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Total Leads</span>
                  <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="text-2xl font-bold text-white">{metrics.total_leads}</div>
                <div className="text-xs text-emerald-400 font-medium mt-1">
                  100% Verified Phone Captures
                </div>
              </div>

              <div className="bg-slate-850 border border-slate-750 p-4 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Conversion Rate</span>
                  <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div className="text-2xl font-bold text-white">
                  {metrics.chatbot_conversion_rate}%
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Chatbot turns &rarr; Booked
                </div>
              </div>

              <div className="bg-slate-850 border border-slate-750 p-4 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Hot Pipeline</span>
                  <svg className="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                  </svg>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-rose-400">
                    {metrics.lead_distribution.HOT}
                  </span>
                  <span className="text-xs text-slate-400">
                    ({metrics.lead_distribution.WARM} Warm, {metrics.lead_distribution.COLD} Cold)
                  </span>
                </div>
                <div className="text-xs text-rose-400 font-medium mt-1">
                  Target: &lt;2 hr response
                </div>
              </div>

              <div className="bg-slate-850 border border-slate-750 p-4 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Active Channels</span>
                  <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div className="text-2xl font-bold text-white">
                  {metrics.total_sessions}
                </div>
                <div className="text-xs text-indigo-400 font-medium mt-1">
                  Omnichannel Web & WhatsApp
                </div>
              </div>
            </div>
          )}

          {/* Search & Qualification Filters */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, phone, country..."
                className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-xl w-full sm:w-auto">
              {(['ALL', 'HOT', 'WARM', 'COLD'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    categoryFilter === cat
                      ? cat === 'HOT'
                        ? 'bg-rose-500 text-white shadow-sm'
                        : cat === 'WARM'
                        ? 'bg-amber-500 text-white shadow-sm'
                        : cat === 'COLD'
                        ? 'bg-slate-600 text-white shadow-sm'
                        : 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat} {cat !== 'ALL' && metrics?.lead_distribution[cat] ? `(${metrics.lead_distribution[cat]})` : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Leads Table & Detail Viewer Split */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Leads Table */}
            <div className={`space-y-3 ${selectedLead ? 'lg:col-span-5' : 'lg:col-span-12'}`}>
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Booked Inquiries ({filteredLeads.length})
                  </span>
                  <span className="text-xs text-slate-400">Click lead to open Dossier</span>
                </div>

                <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                  {filteredLeads.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-sm">
                      No leads matching current filters.
                    </div>
                  ) : (
                    filteredLeads.map((lead) => {
                      const isSelected = selectedLead?.booking_id === lead.booking_id;
                      return (
                        <div
                          key={lead.booking_id}
                          onClick={() => viewDossier(lead)}
                          className={`p-4 cursor-pointer transition-all hover:bg-indigo-50/50 ${
                            isSelected ? 'bg-indigo-50/80 border-l-4 border-indigo-600' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div>
                              <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                                {lead.name}
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  lead.lead_category === 'HOT'
                                    ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                    : lead.lead_category === 'WARM'
                                    ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                    : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {lead.lead_category} ({lead.lead_score}/100)
                                </span>
                              </h3>
                              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                <span>{lead.phone}</span>
                              </p>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                              {lead.booking_id}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 mt-2 bg-slate-800/80 p-2 rounded-xl">
                            <div className="truncate flex items-center gap-1">
                              <svg className="w-3 h-3 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                              </svg>
                              <span>{lead.target_country} ({lead.degree})</span>
                            </div>
                            <div className="truncate flex items-center gap-1">
                              <svg className="w-3 h-3 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span>{lead.intake}</span>
                            </div>
                            <div className="truncate col-span-2 flex items-center gap-1 text-slate-400">
                              <svg className="w-3 h-3 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>{lead.preferred_time}</span>
                            </div>
                          </div>

                          <div className="mt-2.5 flex items-center justify-between text-xs pt-1">
                            <span className="text-indigo-400 font-medium text-[11px] flex items-center gap-1">
                              <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <span>View Counselor Dossier</span>
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(lead.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Dossier Viewer Drawer / Column */}
            {selectedLead && (
              <div className="lg:col-span-7 bg-slate-850 border border-slate-750 rounded-2xl shadow-sm p-6 space-y-4 max-h-[600px] overflow-y-auto">
                <div className="flex items-center justify-between pb-3 border-b border-slate-750">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <div>
                      <h4 className="font-bold text-sm text-white">
                        Handover Dossier: {selectedLead.name}
                      </h4>
                      <p className="text-xs text-slate-400 font-mono">Ref: {selectedLead.booking_id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`https://wa.me/${selectedLead.phone.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-all shadow-sm cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <span>WhatsApp Student</span>
                    </a>
                    <button
                      onClick={() => setSelectedLead(null)}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {loadingDossier ? (
                  <div className="py-16 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-xs">Loading Counselor Brief...</p>
                  </div>
                ) : (
                  <div className="prose prose-sm max-w-none text-xs sm:text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {dossierMarkdown}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            )}

          </div>

        </div>

        {/* Footer info */}
        <div className="px-6 py-3.5 bg-slate-100 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
          <span>Margam Educational Services &copy; 2026. Founder & Lead Counselor: Jeevithram.</span>
          <span className="font-medium text-indigo-600">Zero-Consultancy Free Model</span>
        </div>

      </div>
    </div>
  );
};
