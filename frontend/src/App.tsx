import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, MessageRole, CitationItem, StudentProfile, ChatSession } from './types';
import { CitationModal } from './components/CitationModal';
import { StudentProfileDrawer } from './components/StudentProfileDrawer';
import { CostCalculatorModal } from './components/CostCalculatorModal';
import { DocumentReviewModal } from './components/DocumentReviewModal';
import { ChatSidebar } from './components/ChatSidebar';
import { ConsultationModal } from './components/ConsultationModal';
import { CounselorDashboardModal } from './components/CounselorDashboardModal';

interface UserConfig {
  name: string;
  phone: string;
}

const App: React.FC = () => {
  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isListening, setIsListening] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // User & Profile State
  const [userConfig, setUserConfig] = useState<UserConfig | null>(() => {
    try {
      const saved = localStorage.getItem('margam_user_config');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse initial user config:', e);
    }
    return { name: 'Student', phone: '' };
  });
  const [studentProfile, setStudentProfile] = useState<StudentProfile>({});
  const [includeLatestInfo, setIncludeLatestInfo] = useState(false);

  // Multi-session State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('default-session');

  // Modals & Drawers
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCostCalcOpen, setIsCostCalcOpen] = useState(false);
  const [isDocReviewOpen, setIsDocReviewOpen] = useState(false);
  const [isCitationModalOpen, setIsCitationModalOpen] = useState(false);
  const [isConsultModalOpen, setIsConsultModalOpen] = useState(false);
  const [isCounselorDashboardOpen, setIsCounselorDashboardOpen] = useState(false);
  const [modalCitations, setModalCitations] = useState<CitationItem[]>([]);
  const [selectedCitation, setSelectedCitation] = useState<CitationItem | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Lead Form State
  const [nameInput, setNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const streamingIntervalRef = useRef<any>(null);
  const isLanding = messages.length === 0;

  // Initialize User Config
  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem('margam_user_config');
      if (savedConfig) {
        setUserConfig(JSON.parse(savedConfig));
      }
    } catch (e) {
      console.error('Failed to parse margam_user_config:', e);
      localStorage.removeItem('margam_user_config');
    }

    try {
      const savedProfile = localStorage.getItem('margam_student_profile');
      if (savedProfile) {
        setStudentProfile(JSON.parse(savedProfile));
      }
    } catch (e) {
      console.error('Failed to parse margam_student_profile:', e);
      localStorage.removeItem('margam_student_profile');
    }
  }, []);

  // Initialize Sessions
  useEffect(() => {
    const savedSessions = localStorage.getItem('margam_chat_sessions');
    const savedActiveId = localStorage.getItem('margam_active_session_id');

    if (savedSessions) {
      try {
        const parsed = JSON.parse(savedSessions);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessions(parsed);
          const active = parsed.find(s => s.id === savedActiveId) || parsed[0];
          setActiveSessionId(active.id);
          setMessages(active.messages || []);
          if (active.profile) setStudentProfile(active.profile);
          return;
        }
      } catch (e) {
        console.error('Failed to parse saved chat sessions:', e);
      }
    }

    const initialSessionId = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id: initialSessionId,
      title: 'Initial Consultation',
      createdAt: new Date(),
      messages: [],
      profile: {}
    };
    setSessions([newSession]);
    setActiveSessionId(initialSessionId);
  }, []);

  // Save current session messages & profile
  useEffect(() => {
    if (sessions.length > 0) {
      const updatedSessions = sessions.map(s => {
        if (s.id === activeSessionId) {
          let title = s.title;
          if (messages.length > 0 && (!title || title === 'Initial Consultation' || title === 'New Consultation' || title === 'Untitled Session')) {
            const firstUserMsg = messages.find(m => m.role === MessageRole.USER);
            if (firstUserMsg) {
              const cleaned = firstUserMsg.content.trim().replace(/\s+/g, ' ');
              title = cleaned.slice(0, 36) + (cleaned.length > 36 ? '...' : '');
            }
          }
          return {
            ...s,
            title,
            messages,
            profile: studentProfile
          };
        }
        return s;
      });

      localStorage.setItem('margam_chat_sessions', JSON.stringify(updatedSessions));
      localStorage.setItem('margam_active_session_id', activeSessionId);
    }
  }, [messages, studentProfile, activeSessionId]);

  const handleLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameInput.trim() && phoneInput.trim()) {
      const config = { name: nameInput, phone: phoneInput };
      setUserConfig(config);
      localStorage.setItem('margam_user_config', JSON.stringify(config));
    }
  };

  const handleGuestContinue = () => {
    const config = { name: 'Guest Explorer', phone: 'Not provided' };
    setUserConfig(config);
    localStorage.setItem('margam_user_config', JSON.stringify(config));
  };

  const formatTime = (date: any) => {
    try {
      if (!date) return '';
      const d = date instanceof Date ? date : new Date(date);
      if (isNaN(d.getTime())) return '';
      return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).format(d);
    } catch {
      return '';
    }
  };

  const activeSuggestions = useMemo(() => {
    return [
      "Germany Masters without tuition fees",
      "UK student visa financial requirements",
      "Blocked account (€11,904) step-by-step",
      "Ireland 2-year post study work visa",
      "SOP requirements for top public universities",
      "APS certificate process for Germany"
    ];
  }, []);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    return userConfig ? `${timeGreeting}, ${userConfig.name}` : 'Margam Study Abroad Studio';
  }, [userConfig]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSelectSession = (id: string) => {
    if (streamingIntervalRef.current) {
      clearInterval(streamingIntervalRef.current);
      streamingIntervalRef.current = null;
    }
    const session = sessions.find(s => s.id === id);
    if (session) {
      setIsTyping(false);
      setStatusMessage('');
      setInput('');
      setActiveSessionId(id);
      setMessages(session.messages || []);
      setStudentProfile(session.profile || {});
      localStorage.setItem('margam_active_session_id', id);
    }
  };

  const handleNewSession = () => {
    if (streamingIntervalRef.current) {
      clearInterval(streamingIntervalRef.current);
      streamingIntervalRef.current = null;
    }
    setIsTyping(false);
    setStatusMessage('');
    setInput('');
    const newSessionId = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id: newSessionId,
      title: 'New Consultation',
      createdAt: new Date(),
      messages: [],
      profile: studentProfile
    };
    setSessions(prev => {
      const next = [newSession, ...prev];
      try {
        localStorage.setItem('margam_chat_sessions', JSON.stringify(next));
        localStorage.setItem('margam_active_session_id', newSessionId);
      } catch (e) {}
      return next;
    });
    setActiveSessionId(newSessionId);
    setMessages([]);
  };

  const handleDeleteSession = (id: string) => {
    const remaining = sessions.filter(s => s.id !== id);
    if (remaining.length === 0) {
      handleNewSession();
    } else {
      setSessions(remaining);
      if (activeSessionId === id) {
        setActiveSessionId(remaining[0].id);
        setMessages(remaining[0].messages || []);
      }
    }
  };

  const handleUpdateProfile = (updated: StudentProfile) => {
    setStudentProfile(updated);
    localStorage.setItem('margam_student_profile', JSON.stringify(updated));
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleSpeak = (id: string, text: string) => {
    if ('speechSynthesis' in window) {
      if (speakingMessageId === id) {
        window.speechSynthesis.cancel();
        setSpeakingMessageId(null);
      } else {
        window.speechSynthesis.cancel();
        const cleanText = text.replace(/[#*`_~[\]()]/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.onend = () => setSpeakingMessageId(null);
        utterance.onerror = () => setSpeakingMessageId(null);
        setSpeakingMessageId(id);
        window.speechSynthesis.speak(utterance);
      }
    }
  };

  const toggleSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => (prev ? `${prev} ${transcript}` : transcript));
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const handleSend = async (customMessage?: string) => {
    const textToSend = customMessage || input;
    if (!textToSend.trim() || isTyping) return;

    const currentConfig = userConfig || { name: 'Student', phone: '+91 98765 43210' };
    const validatedPhone = currentConfig.phone && currentConfig.phone.trim() ? currentConfig.phone : '+91 98765 43210';

    setInput('');
    const userMessage: Message = {
      id: Date.now().toString(),
      role: MessageRole.USER,
      content: textToSend,
      timestamp: new Date()
    };

    // Derive chat title from prompt and update sessions state immediately
    const cleaned = textToSend.trim().replace(/\s+/g, ' ');
    const derivedTitle = cleaned.slice(0, 36) + (cleaned.length > 36 ? '...' : '');

    setSessions(prev => {
      const updated = prev.map(s => {
        if (s.id === activeSessionId) {
          const needsTitle = !s.title || s.title === 'Initial Consultation' || s.title === 'New Consultation' || s.title === 'Untitled Session';
          return {
            ...s,
            title: needsTitle ? derivedTitle : s.title,
            messages: [...messages, userMessage],
            profile: studentProfile
          };
        }
        return s;
      });

      try {
        localStorage.setItem('margam_chat_sessions', JSON.stringify(updated));
        localStorage.setItem('margam_active_session_id', activeSessionId);
      } catch (err) {
        console.error('Failed to sync chat sessions to localStorage:', err);
      }

      return updated;
    });

    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);
    setStatusMessage('Analyzing question & checking verified knowledge base...');

    const API_URL = 'http://localhost:8000';
    const history = messages.slice(-6).map(m => ({
      role: m.role,
      content: m.content
    }));

    const botMsgId = (Date.now() + 1).toString();
    const initialBotMessage: Message = {
      id: botMsgId,
      role: MessageRole.ASSISTANT,
      content: '',
      timestamp: new Date(),
      sources: [],
      citations: [],
      suggestions: [],
      isStreaming: true
    };

    setMessages(prev => [...prev, initialBotMessage]);

    try {
      const response = await fetch(`${API_URL}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: textToSend,
          user_name: currentConfig.name,
          phone: validatedPhone,
          chat_history: history,
          use_web_search: includeLatestInfo
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No readable stream available');

      let targetText = '';
      let displayedText = '';
      let isStreamEnded = false;
      let buffer = '';
      let citationsList: CitationItem[] = [];
      let sourcesList: string[] = [];
      let suggestionsList: string[] = [];
      let isEscalation = false;
      let ctaType = '';

      if (streamingIntervalRef.current) {
        clearInterval(streamingIntervalRef.current);
      }

      // Smooth 200ms typewriter reveal loop
      streamingIntervalRef.current = setInterval(() => {
        if (displayedText.length < targetText.length) {
          const lag = targetText.length - displayedText.length;
          // Measured 200ms cadence: reveals ~1 word / natural phrase per 200ms beat
          const step = lag > 200 ? 25 : lag > 100 ? 15 : lag > 40 ? 8 : 4;
          displayedText = targetText.slice(0, displayedText.length + step);

          setMessages(prev =>
            prev.map(m =>
              m.id === botMsgId ? { ...m, content: displayedText, isStreaming: true } : m
            )
          );
        } else if (isStreamEnded) {
          clearInterval(streamingIntervalRef.current);
          streamingIntervalRef.current = null;
          setMessages(prev =>
            prev.map(m =>
              m.id === botMsgId
                ? {
                    ...m,
                    content: targetText,
                    citations: citationsList,
                    sources: sourcesList,
                    suggestions: suggestionsList,
                    is_escalation: isEscalation,
                    cta_type: ctaType,
                    isStreaming: false
                  }
                : m
            )
          );
          setIsTyping(false);
          setStatusMessage('');
        }
      }, 200);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = 'message';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.replace('event: ', '').trim();
          } else if (line.startsWith('data: ')) {
            const rawData = line.replace('data: ', '').trim();
            try {
              const parsed = JSON.parse(rawData);

              if (currentEvent === 'token' && parsed.token) {
                targetText += parsed.token;
              } else if (currentEvent === 'status' && parsed.message) {
                setStatusMessage(parsed.message);
              } else if (currentEvent === 'metadata') {
                if (parsed.citations) citationsList = parsed.citations;
                if (parsed.sources) sourcesList = parsed.sources;
                if (parsed.suggestions) suggestionsList = parsed.suggestions;
                if (parsed.is_escalation) isEscalation = parsed.is_escalation;
                if (parsed.cta_type) ctaType = parsed.cta_type;

                if (parsed.user_profile) {
                  setStudentProfile(prev => ({ ...prev, ...parsed.user_profile }));
                }
              }
            } catch (err) {
              // ignore parse errors on partial chunks
            }
          }
        }
      }

      isStreamEnded = true;
    } catch (streamError) {
      console.warn('Falling back to standard /chat endpoint...', streamError);
      if (streamingIntervalRef.current) {
        clearInterval(streamingIntervalRef.current);
        streamingIntervalRef.current = null;
      }
      try {
        const fallbackRes = await fetch(`${API_URL}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: textToSend,
            user_name: currentConfig.name,
            phone: validatedPhone,
            chat_history: history,
            use_web_search: includeLatestInfo
          })
        });

        if (!fallbackRes.ok) throw new Error('Backend error');
        const data = await fallbackRes.json();

        const fullResponse = data.response || '';
        let fallbackDisplayed = '';
        streamingIntervalRef.current = setInterval(() => {
          if (fallbackDisplayed.length < fullResponse.length) {
            const lag = fullResponse.length - fallbackDisplayed.length;
            const step = lag > 200 ? 25 : lag > 100 ? 15 : lag > 40 ? 8 : 4;
            fallbackDisplayed = fullResponse.slice(0, fallbackDisplayed.length + step);
            setMessages(prev =>
              prev.map(m =>
                m.id === botMsgId
                  ? { ...m, content: fallbackDisplayed, isStreaming: true }
                  : m
              )
            );
          } else {
            clearInterval(streamingIntervalRef.current);
            streamingIntervalRef.current = null;
            setMessages(prev =>
              prev.map(m =>
                m.id === botMsgId
                  ? {
                      ...m,
                      content: fullResponse,
                      sources: data.sources || [],
                      citations: data.citations || [],
                      suggestions: data.suggestions || [],
                      is_escalation: data.is_escalation,
                      cta_type: data.cta_type,
                      isStreaming: false
                    }
                  : m
              )
            );
            setIsTyping(false);
            setStatusMessage('');
          }
        }, 200);

        if (data.user_profile) {
          setStudentProfile(prev => ({ ...prev, ...data.user_profile }));
        }
      } catch (err) {
        console.error('Chat error:', err);
        if (streamingIntervalRef.current) {
          clearInterval(streamingIntervalRef.current);
          streamingIntervalRef.current = null;
        }
        setMessages(prev =>
          prev.map(m =>
            m.id === botMsgId
              ? {
                  ...m,
                  content: 'Sorry, I encountered an issue connecting to the Margam knowledge base. Please try asking again in a moment.',
                  isStreaming: false
                }
              : m
          )
        );
        setIsTyping(false);
        setStatusMessage('');
      }
    } finally {
      if (!streamingIntervalRef.current) {
        setIsTyping(false);
        setStatusMessage('');
      }
    }
  };

  const handleExportRoadmap = async () => {
    if (!userConfig || messages.length === 0) return;
    setIsExporting(true);
    try {
      const res = await fetch('http://localhost:8000/export-roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_name: userConfig.name,
          user_profile: studentProfile,
          chat_history: messages.map(m => ({ role: m.role, content: m.content }))
        })
      });

      if (!res.ok) throw new Error('Export failed');
      const data = await res.json();

      const blob = new Blob([data.markdown], { type: 'text/markdown;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${userConfig.name.replace(/\s+/g, '_')}_Study_Abroad_Roadmap.md`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to export roadmap:', err);
      alert('Could not export roadmap at this time.');
    } finally {
      setIsExporting(false);
    }
  };

  const cardSurfaceClass = 'bg-slate-900/90 text-slate-100 border-slate-800/90 shadow-md';
  const subTextClass = 'text-slate-400';

  const markdownComponents = {
    p: ({ node, ...props }: any) => <p className="mb-4 leading-relaxed text-slate-200" {...props} />,
    ul: ({ node, ...props }: any) => <ul className="mb-4 pl-5 list-disc space-y-1.5 text-slate-200" {...props} />,
    ol: ({ node, ...props }: any) => <ol className="mb-4 pl-5 list-decimal space-y-1.5 text-slate-200" {...props} />,
    li: ({ node, ...props }: any) => <li className="pl-1" {...props} />,
    strong: ({ node, ...props }: any) => <strong className="font-semibold text-white" {...props} />,
    code: ({ node, inline, ...props }: any) => {
      if (inline) {
        return <code className="px-1.5 py-0.5 rounded text-xs font-mono font-medium bg-slate-800 text-blue-400" {...props} />;
      }
      return <code className="block p-4 bg-slate-950 text-slate-100 rounded-xl overflow-x-auto text-xs font-mono" {...props} />;
    },
    blockquote: ({ node, ...props }: any) => (
      <blockquote className="border-l-4 border-blue-500 pl-4 py-1 italic my-4 rounded-r-xl bg-blue-950/30 text-slate-400" {...props} />
    )
  };

  return (
    <div className="flex h-screen w-full bg-[#090E17] text-[#F1F5F9] overflow-hidden">
      {/* Sticky Desktop & Mobile AI Sidebar */}
      <ChatSidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(prev => !prev)}
        onClose={() => setIsSidebarOpen(false)}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
        userName={userConfig?.name || 'Student'}
        onOpenProfile={() => setIsProfileOpen(true)}
      />

      {/* Main Studio Area */}
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden relative">
        <StudentProfileDrawer
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          profile={studentProfile}
          onUpdateProfile={handleUpdateProfile}
          userName={userConfig?.name || ''}
          phone={userConfig?.phone || ''}
        />

        <CostCalculatorModal
          isOpen={isCostCalcOpen}
          onClose={() => setIsCostCalcOpen(false)}
          onInsertToChat={handleSend}
        />

        <DocumentReviewModal
          isOpen={isDocReviewOpen}
          onClose={() => setIsDocReviewOpen(false)}
          targetCountry={studentProfile.target_country || 'Germany'}
          onInsertReviewToChat={handleSend}
        />

        <CitationModal
          isOpen={isCitationModalOpen}
          onClose={() => setIsCitationModalOpen(false)}
          citations={modalCitations}
          activeCitation={selectedCitation}
        />

        <ConsultationModal
          isOpen={isConsultModalOpen}
          onClose={() => setIsConsultModalOpen(false)}
          userName={userConfig?.name || ''}
          phone={userConfig?.phone || ''}
          profile={studentProfile}
          chatHistory={messages}
        />

        <CounselorDashboardModal
          isOpen={isCounselorDashboardOpen}
          onClose={() => setIsCounselorDashboardOpen(false)}
        />

        {/* Lead Collection Onboarding Modal */}
        {!userConfig && (
          <div className="fixed inset-0 z-[999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900/95 border border-slate-700/80 rounded-3xl p-8 sm:p-10 max-w-md w-full shadow-2xl animate-stage text-white ring-1 ring-white/10">
              <div className="text-center mb-7">
                <div className="flex justify-center mb-5">
                  <img src="/images/Margam-text-logo.png" alt="Margam AI" className="h-10 sm:h-12 object-contain" />
                </div>
                <h3 className="text-xl font-bold tracking-tight text-white">Welcome to Margam Studio</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Your intelligent, student-first study abroad mentor
                </p>
              </div>

              <form onSubmit={handleLeadSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 ml-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 transition-all font-medium placeholder-slate-500"
                    placeholder="e.g. Rahul Sharma"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 ml-1">
                    WhatsApp Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phoneInput}
                    onChange={e => setPhoneInput(e.target.value)}
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 transition-all font-medium placeholder-slate-500"
                    placeholder="e.g. +91 98765 43210"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-xs uppercase tracking-wider py-3.5 rounded-xl transition-all shadow-md hover:shadow-blue-500/25 active:scale-[0.99] mt-3 cursor-pointer"
                >
                  Launch Advisory Studio
                </button>
                <button
                  type="button"
                  onClick={handleGuestContinue}
                  className="w-full text-center text-xs text-slate-400 hover:text-blue-400 transition-colors py-2 font-medium cursor-pointer"
                >
                  Or continue as Guest &rarr;
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Top Executive Navigation Bar */}
        <header className="w-full h-16 flex items-center justify-between px-4 sm:px-6 z-40 bg-[#090E17]/85 backdrop-blur-md border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(prev => !prev)}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-xl transition-all cursor-pointer"
              title={isSidebarOpen ? "Collapse sidebar" : "Open sidebar"}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            {/* Show logo if sidebar is collapsed or on mobile */}
            {!isSidebarOpen && (
              <img
                src="/images/Margam-text-logo.png"
                alt="Margam AI"
                className="h-7 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                onClick={handleNewSession}
              />
            )}

            <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-slate-800 text-xs text-slate-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Advisory Engine Active</span>
            </div>
          </div>

          {/* Feature Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Book 1-on-1 Consultation */}
            <button
              onClick={() => setIsConsultModalOpen(true)}
              className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
              title="Book Free 30-Min Strategy Call"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="hidden sm:inline">Book 1-on-1 Call</span>
              <span className="sm:hidden">Book</span>
            </button>

            {/* Cost Simulator */}
            <button
              onClick={() => setIsCostCalcOpen(true)}
              className="px-2.5 sm:px-3 py-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-700/80 text-slate-200 hover:text-blue-400 rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              title="Living Cost & Loan Simulator"
            >
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span className="hidden sm:inline">Cost Calculator</span>
              <span className="sm:hidden">Costs</span>
            </button>

            {/* SOP & Resume Audit */}
            <button
              onClick={() => setIsDocReviewOpen(true)}
              className="px-2.5 sm:px-3 py-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-700/80 text-slate-200 hover:text-blue-400 rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              title="SOP & Resume AI Audit"
            >
              <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="hidden sm:inline">Audit SOP / CV</span>
              <span className="sm:hidden">Audit</span>
            </button>

            {/* Export Action Plan */}
            {messages.length > 0 && (
              <button
                onClick={handleExportRoadmap}
                disabled={isExporting}
                className="px-2.5 sm:px-3 py-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-700/80 text-slate-200 hover:text-blue-400 rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                title="Download Study Abroad Roadmap"
              >
                <svg className="w-3.5 h-3.5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span className="hidden sm:inline">{isExporting ? 'Exporting...' : 'Export'}</span>
              </button>
            )}

            {/* Counselor CRM Portal */}
            <button
              onClick={() => setIsCounselorDashboardOpen(true)}
              className="px-2.5 sm:px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5 border border-slate-700 active:scale-95 cursor-pointer"
              title="Counselor CRM & Conversion Portal"
            >
              <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="hidden md:inline">Counselor Portal</span>
              <span className="md:hidden">CRM</span>
            </button>

            {/* Student Profile Drawer */}
            <button
              onClick={() => setIsProfileOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-all border border-slate-700 cursor-pointer"
              title="View Student Profile"
            >
              <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                {userConfig?.name ? userConfig.name.charAt(0).toUpperCase() : 'S'}
              </div>
              <span className="hidden lg:inline">
                {studentProfile.target_country || userConfig?.name || 'Profile'}
              </span>
            </button>

            {/* New Chat Button */}
            <button
              onClick={handleNewSession}
              className="p-2 text-slate-400 hover:text-blue-400 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              title="New Session"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </header>

      {/* Main Canvas: Consistent Dark Slate Canvas with Ambient Aurora Glows across all modes */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-ambient-dots">
        {/* Dynamic Glowing Aurora Backdrops */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
          <div className="absolute -top-32 -left-24 w-[450px] h-[450px] aurora-blue rounded-full blur-3xl animate-aurora"></div>
          <div className="absolute top-1/3 -right-28 w-[500px] h-[500px] aurora-indigo rounded-full blur-3xl animate-aurora [animation-delay:4s]"></div>
          <div className="absolute -bottom-24 left-1/3 w-[400px] h-[400px] aurora-cyan rounded-full blur-3xl animate-aurora [animation-delay:8s]"></div>
        </div>

        <div className="flex-1 overflow-y-auto scroll-smooth relative z-10">
          {isLanding ? (
            /* Interactive Human-Crafted Hero Studio */
            <div className="h-full relative overflow-y-auto flex flex-col justify-center py-10 px-4 sm:px-6">
              
              <div className="relative max-w-4xl mx-auto w-full space-y-8 animate-stage">
                
                {/* Hero Header */}
                <div className="text-center space-y-3">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-950/60 border border-blue-800/60 text-blue-300 text-xs font-semibold mb-2 shadow-xs backdrop-blur-md">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping"></span>
                    Verified Knowledge Base: Germany · UK · USA · Canada · Australia
                  </div>
                  
                  <h1 className="text-4xl sm:text-5xl md:text-6xl leading-[1.12] font-extrabold tracking-tight">
                    <span className="bg-gradient-to-r from-white via-blue-200 to-indigo-200 bg-clip-text text-transparent">
                      {greeting}
                    </span>
                  </h1>
                  
                  <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
                    Get clear, structured explanations on visa criteria, university shortlists, living costs, and founder SOP reviews.
                  </p>
                </div>

                {/* Floating Command Dock (Hero) */}
                <div className="max-w-2xl mx-auto w-full">
                  <div className="bg-slate-900/90 backdrop-blur-xl rounded-3xl border border-slate-800 shadow-xl p-3 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all">
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                      placeholder="Ask anything about visas, universities, blocked accounts, SOPs..."
                      rows={2}
                      className="w-full bg-transparent p-2 text-sm sm:text-base text-white placeholder:text-slate-500 focus:outline-none resize-none leading-relaxed"
                    />

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 px-1">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={toggleSpeechRecognition}
                          className={`p-2 rounded-xl text-xs transition-colors flex items-center gap-1 ${
                            isListening
                              ? 'text-red-400 bg-red-950/50 animate-pulse'
                              : 'text-slate-400 hover:text-blue-400 hover:bg-slate-800'
                          }`}
                          title="Voice input"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                          </svg>
                          <span className="hidden sm:inline text-[11px] font-medium">{isListening ? 'Listening...' : 'Voice'}</span>
                        </button>

                        <button
                          onClick={() => setIncludeLatestInfo(!includeLatestInfo)}
                          className={`p-2 rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
                            includeLatestInfo
                              ? 'text-blue-300 bg-blue-950/60 font-semibold border border-blue-800'
                              : 'text-slate-400 hover:text-blue-400 hover:bg-slate-800'
                          }`}
                          title="Search live web data"
                        >
                          <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span className="text-[11px] font-medium">Live Web Search</span>
                        </button>
                      </div>

                      <button
                        onClick={() => handleSend()}
                        disabled={!input.trim()}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-5 py-2 rounded-xl font-semibold text-xs sm:text-sm transition-all disabled:opacity-40 shadow-sm hover:shadow-blue-500/25 flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>Ask Mentor</span>
                        <span>→</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Clean, Simple Suggestion Chips (As Before) */}
                <div className="flex flex-wrap justify-center gap-2 sm:gap-2.5 max-w-2xl mx-auto pt-2">
                  {activeSuggestions.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(s)}
                      className="text-xs sm:text-sm font-medium text-slate-300 hover:text-white px-4 py-2 hover:bg-slate-800/90 border border-slate-800 rounded-full transition-all bg-slate-900/60 backdrop-blur-xs cursor-pointer shadow-xs hover:border-blue-500/50 hover:shadow-sm"
                    >
                      {s}
                    </button>
                  ))}
                </div>

              </div>
            </div>
          ) : (
            /* Chat Messages Feed */
            <div className="max-w-3xl mx-auto pt-8 pb-36 px-4 sm:px-6 space-y-7">
              {messages.map(msg => (
                <div key={msg.id} className="animate-stage group">
                  {msg.role === MessageRole.USER ? (
                    <div className="flex justify-end">
                      <div className="max-w-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl rounded-tr-xs p-4 sm:p-5 shadow-sm space-y-1">
                        <div className="text-[10px] font-semibold text-blue-200 uppercase tracking-wider">
                          {formatTime(msg.timestamp)}
                        </div>
                        <p className="text-sm sm:text-base leading-relaxed font-medium">
                          {msg.content}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className={`rounded-3xl p-6 sm:p-8 backdrop-blur-xl border transition-all ${cardSurfaceClass}`}>
                      {/* Top Action Ribbon */}
                      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/60">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                            M
                          </div>
                          <span className="text-xs font-bold uppercase tracking-wider">
                            Margam Advisor
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                          {/* Audio TTS */}
                          <button
                            onClick={() => toggleSpeak(msg.id, msg.content)}
                            className="p-1.5 rounded-lg text-xs transition-colors text-slate-400 hover:text-blue-400 hover:bg-slate-800"
                            title={speakingMessageId === msg.id ? 'Stop audio' : 'Listen to response'}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            </svg>
                          </button>

                          {/* Copy button */}
                          <button
                            onClick={() => handleCopy(msg.id, msg.content)}
                            className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg text-xs transition-colors"
                            title="Copy response"
                          >
                            {copiedId === msg.id ? (
                              <span className="text-emerald-400 text-xs font-bold inline-flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                Copied
                              </span>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Main Message Content */}
                      <div className="prose max-w-none text-sm sm:text-base leading-relaxed">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                          {msg.content}
                        </ReactMarkdown>

                        {/* Blinking streaming cursor */}
                        {msg.isStreaming && (
                          <span className="inline-block w-2 h-4 ml-1 bg-blue-500 animate-pulse align-middle"></span>
                        )}
                      </div>

                      {/* Consultation Strategy Escalation Card */}
                      {(msg.is_escalation || msg.cta_type === 'book_consultation') && (
                        <div className="mt-5 p-5 bg-gradient-to-br from-slate-850 via-blue-950/40 to-slate-900 rounded-2xl border border-blue-900/60 shadow-sm space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-950 text-blue-300 text-[10px] font-bold uppercase tracking-wider mb-1.5 border border-blue-800">
                                <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                                Personalized Human Advisory
                              </div>
                              <h3 className="text-lg sm:text-xl font-bold text-white leading-snug tracking-tight">
                                Book Your Free 30-Min 1-on-1 Profile Strategy Session
                              </h3>
                              <p className="text-xs sm:text-sm text-slate-300 mt-1">
                                Shortlisting universities, evaluating backlogs, and portal application filing require a personalized review of your academic transcript to prevent costly rejections.
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-1 text-[11px] text-slate-300 font-medium">
                            <div className="flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              <span>Direct Senior Counsellor</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              <span>Transcript & Backlog Audit</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              <span>100% Free · No Obligation</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2.5 pt-1">
                            <button
                              onClick={() => setIsConsultModalOpen(true)}
                              className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm hover:shadow transition-all flex items-center gap-2 active:scale-[0.98] cursor-pointer"
                            >
                              <svg className="w-4 h-4 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span>Schedule Free Consultation</span>
                              <span className="font-bold">→</span>
                            </button>
                            <a
                              href={`https://wa.me/919347997790?text=${encodeURIComponent(
                                `Hi Margam! I'm ${userConfig?.name || 'Student'}. I'd like to book a free 30-min profile strategy session for ${
                                  studentProfile.target_country || 'study abroad'
                                }.`
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm hover:shadow transition-all flex items-center gap-2 active:scale-[0.98] cursor-pointer"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                              <span>WhatsApp Directly</span>
                            </a>
                          </div>
                        </div>
                      )}

                      {/* Follow-up Suggestion Chips */}
                      {msg.suggestions && msg.suggestions.length > 0 && (
                        <div className="mt-5 pt-3 border-t border-slate-800 space-y-2">
                          <span className={`text-[11px] font-semibold uppercase tracking-wider block ${subTextClass}`}>
                            Suggested Next Questions
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {msg.suggestions.map((s, sIdx) => (
                              <button
                                key={sIdx}
                                onClick={() => handleSend(s)}
                                className="text-xs px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-blue-950/50 text-slate-200 hover:text-blue-300 border border-slate-700 hover:border-blue-700 transition-all font-medium"
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {isTyping && (
                <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl p-4 border border-slate-800 shadow-xs flex items-center gap-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"></span>
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                  <span className="text-xs font-medium text-slate-400">
                    {statusMessage || 'Margam Advisor is reasoning...'}
                  </span>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Floating Bottom Input Bar for Active Chat */}
        {!isLanding && (
          <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-[#090E17] via-[#090E17]/90 to-transparent z-20">
            <div className="max-w-3xl mx-auto">
              <div className="bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-slate-800 shadow-lg p-2.5 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                  placeholder="Ask a follow-up question..."
                  rows={1}
                  className="w-full bg-transparent p-2 text-sm text-white placeholder:text-slate-500 focus:outline-none resize-none"
                  style={{ minHeight: '36px', maxHeight: '120px' }}
                />

                <div className="flex items-center justify-between pt-1 border-t border-slate-800 px-1">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={toggleSpeechRecognition}
                      className={`p-1.5 rounded-lg text-xs ${
                        isListening
                          ? 'text-red-400 bg-red-950/50 animate-pulse'
                          : 'text-slate-400 hover:text-blue-400'
                      }`}
                      title="Voice input"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    </button>
                    
                    <button
                      onClick={() => setIncludeLatestInfo(!includeLatestInfo)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 ${
                        includeLatestInfo
                          ? 'text-blue-300 bg-blue-950/60 border border-blue-800'
                          : 'text-slate-400 hover:text-blue-400'
                      }`}
                      title="Web Search live data"
                    >
                      <svg className="w-3 h-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>Live Search</span>
                    </button>
                  </div>

                  <button
                    onClick={() => handleSend()}
                    disabled={!input.trim()}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-1.5 rounded-xl font-semibold text-xs transition-all disabled:opacity-40 shadow-xs"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      </div>
    </div>
  );
};

export default App;
