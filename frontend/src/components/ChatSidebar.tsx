import React from 'react';
import { ChatSession } from '../types';

interface ChatSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  userName?: string;
  onOpenProfile?: () => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  isOpen,
  onToggle,
  onClose,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  userName = 'Student',
  onOpenProfile
}) => {
  return (
    <>
      {/* Mobile Backdrop Overlay (only on small screens when open) */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
          aria-hidden="true"
        />
      )}

      {/* Sticky Sidebar Container */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-50 md:z-30 h-screen flex flex-col bg-[#0B1120] border-r border-slate-800/80 transition-all duration-300 ease-in-out shrink-0 select-none ${
          isOpen
            ? 'w-72 translate-x-0'
            : '-translate-x-full md:translate-x-0 md:w-0 md:overflow-hidden md:border-r-0'
        }`}
      >
        <div className="w-72 flex flex-col h-full">
          {/* Top Header: Logo + Collapse Button */}
          <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800/80 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src="/images/Margam-text-logo.png"
                alt="Margam AI"
                className="h-8 object-contain"
              />
            </div>
            <button
              onClick={onToggle}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition-colors cursor-pointer"
              title="Close sidebar"
            >
              {/* Sidebar Collapse Icon */}
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6h16M4 12h10M4 18h16" />
              </svg>
            </button>
          </div>

          {/* New Chat Action Button */}
          <div className="p-3.5 shrink-0">
            <button
              onClick={() => {
                onNewSession();
                if (window.innerWidth < 768) onClose();
              }}
              className="w-full py-2.5 px-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.99] cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M12 4v16m8-8H4" />
              </svg>
              <span>New Consultation</span>
            </button>
          </div>

          {/* Previous Conversation Titles List */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
            <div className="px-2.5 py-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <span>Previous Consultations</span>
              <span className="text-[10px] text-slate-500 font-normal">
                {sessions.length}
              </span>
            </div>

            {sessions.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-slate-500">
                No previous conversations yet.
              </div>
            ) : (
              sessions.map(s => {
                const isActive = s.id === activeSessionId;
                const displayTitle = s.title && s.title.trim() ? s.title : 'Untitled Session';

                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      onSelectSession(s.id);
                      if (window.innerWidth < 768) onClose();
                    }}
                    className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-xs transition-all ${
                      isActive
                        ? 'bg-blue-600/15 text-blue-300 font-semibold border border-blue-500/30 shadow-xs'
                        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                      {/* Chat Bubble Icon */}
                      <svg
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-400'
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.8}
                          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                        />
                      </svg>
                      <span className="truncate tracking-tight session-item-title" title={displayTitle}>
                        {displayTitle}
                      </span>
                    </div>

                    {/* Delete action on hover */}
                    {sessions.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(s.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-all"
                        title="Delete conversation"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.75}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom Profile Footer */}
          <div className="p-3 border-t border-slate-800/80 bg-slate-900/40 shrink-0">
            <button
              onClick={onOpenProfile}
              className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-800/70 text-left transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold uppercase shrink-0">
                  {userName ? userName.charAt(0) : 'S'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-200 truncate group-hover:text-blue-300 transition-colors">
                    {userName || 'Student'}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    Advisory Profile
                  </div>
                </div>
              </div>
              <svg className="w-4 h-4 text-slate-500 group-hover:text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
