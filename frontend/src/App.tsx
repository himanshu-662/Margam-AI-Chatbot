import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, MessageRole, CitationItem, StudentProfile, ChatSession, DocumentAttachment } from './types';
import { CitationModal } from './components/CitationModal';
import { StudentProfileDrawer } from './components/StudentProfileDrawer';
import { CostCalculatorModal } from './components/CostCalculatorModal';
import { DocumentReviewModal } from './components/DocumentReviewModal';
import { ChatSidebar } from './components/ChatSidebar';
import { ConsultationModal } from './components/ConsultationModal';
import { CounselorDashboardModal } from './components/CounselorDashboardModal';
import { API_BASE_URL } from './config';

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

  // Document attachment & learning state
  const [attachedDoc, setAttachedDoc] = useState<DocumentAttachment | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

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

  // Responsive Sidebar: Closed by default on mobile screens (< 768px)
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return false;
  });

  // Ensure sidebar stays closed on small mobile viewports
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      }
    };
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCostCalcOpen, setIsCostCalcOpen] = useState(false);
  const [isDocReviewOpen, setIsDocReviewOpen] = useState(false);
  const [isCitationModalOpen, setIsCitationModalOpen] = useState(false);
  const [isConsultModalOpen, setIsConsultModalOpen] = useState(false);
  const [isCounselorDashboardOpen, setIsCounselorDashboardOpen] = useState(false);
  const [isMobileToolsOpen, setIsMobileToolsOpen] = useState(false);
  const [modalCitations, setModalCitations] = useState<CitationItem[]>([]);
  const [selectedCitation, setSelectedCitation] = useState<CitationItem | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Lead Form State
  const [nameInput, setNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeFileInputRef = useRef<HTMLInputElement>(null);
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

  const adjustTextareaHeight = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    const newHeight = Math.min(el.scrollHeight, 200);
    el.style.height = `${Math.max(newHeight, 40)}px`;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert('File size exceeds 20MB. Please choose a smaller document.');
      return;
    }

    setIsUploadingDoc(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE_URL}/upload-document`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        throw new Error(`Upload failed with status ${res.status}`);
      }

      const data = await res.json();
      setAttachedDoc({
        filename: data.filename || file.name,
        fileSize: data.file_size || file.size,
        text: data.text || '',
        pageCount: data.page_count || 1
      });
    } catch (err: any) {
      console.error('Document upload error:', err);
      // Fallback for text-based formats
      if (file.name.endsWith('.txt') || file.name.endsWith('.md') || file.name.endsWith('.csv')) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          setAttachedDoc({
            filename: file.name,
            fileSize: file.size,
            text: (evt.target?.result as string) || '',
            pageCount: 1
          });
        };
        reader.readAsText(file);
      } else {
        alert(`Could not process document: ${err.message || 'Network error'}. Please check your connection.`);
      }
    } finally {
      setIsUploadingDoc(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleSend = async (customMessage?: string) => {
    const textToSend = customMessage || input;
    if (!textToSend.trim() || isTyping) return;

    const currentConfig = userConfig || { name: 'Student', phone: '+91 98765 43210' };
    const validatedPhone = currentConfig.phone && currentConfig.phone.trim() ? currentConfig.phone : '+91 98765 43210';

    const docToAttach = attachedDoc;
    setAttachedDoc(null);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    if (activeTextareaRef.current) activeTextareaRef.current.style.height = 'auto';

    const userMessage: Message = {
      id: Date.now().toString(),
      role: MessageRole.USER,
      content: textToSend,
      timestamp: new Date(),
      document: docToAttach || undefined
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

    const API_URL = API_BASE_URL;
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
          use_web_search: includeLatestInfo,
          document: docToAttach ? {
            filename: docToAttach.filename,
            file_size: docToAttach.fileSize,
            page_count: docToAttach.pageCount,
            text: docToAttach.text || ''
          } : undefined
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No readable stream available');

      let accumulatedText = '';
      let buffer = '';
      let citationsList: CitationItem[] = [];
      let sourcesList: string[] = [];
      let suggestionsList: string[] = [];
      let isEscalation = false;
      let ctaType = '';

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
                accumulatedText += parsed.token;
                setMessages(prev =>
                  prev.map(m =>
                    m.id === botMsgId
                      ? { ...m, content: accumulatedText, isStreaming: true }
                      : m
                  )
                );
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

      // Stream completed: finalize message with metadata and stop streaming state
      setMessages(prev =>
        prev.map(m =>
          m.id === botMsgId
            ? {
                ...m,
                content: accumulatedText,
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
    } catch (streamError) {
      console.warn('Falling back to standard /chat endpoint...', streamError);
      try {
        const fallbackRes = await fetch(`${API_URL}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: textToSend,
            user_name: currentConfig.name,
            phone: validatedPhone,
            chat_history: history,
            use_web_search: includeLatestInfo,
            document: docToAttach ? {
              filename: docToAttach.filename,
              file_size: docToAttach.fileSize,
              page_count: docToAttach.pageCount,
              text: docToAttach.text || ''
            } : undefined
          })
        });

        if (!fallbackRes.ok) throw new Error('Backend error');
        const data = await fallbackRes.json();

        const fullResponse = data.response || '';
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

        if (data.user_profile) {
          setStudentProfile(prev => ({ ...prev, ...data.user_profile }));
        }
      } catch (err: any) {
        console.error('Chat error:', err);
        const errorDetail = err?.message ? ` (${err.message})` : '';
        setMessages(prev =>
          prev.map(m =>
            m.id === botMsgId
              ? {
                  ...m,
                  content: `Sorry, I encountered an issue connecting to the Margam knowledge base${errorDetail}. Please check your connection or environment settings.`,
                  isStreaming: false
                }
              : m
          )
        );
      } finally {
        setIsTyping(false);
        setStatusMessage('');
      }
    } finally {
      setIsTyping(false);
      setStatusMessage('');
    }
  };

  const handleExportRoadmap = async () => {
    if (!userConfig || messages.length === 0) return;
    setIsExporting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/export-roadmap`, {
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
    p: ({ node, ...props }: any) => <p className="mb-4 leading-[1.75] text-[#ECECEC] text-[15px] sm:text-[16px]" {...props} />,
    h1: ({ node, ...props }: any) => <h1 className="text-xl sm:text-2xl font-bold text-white mt-6 mb-3 tracking-tight" {...props} />,
    h2: ({ node, ...props }: any) => <h2 className="text-lg sm:text-xl font-bold text-white mt-5 mb-2.5 tracking-tight" {...props} />,
    h3: ({ node, ...props }: any) => <h3 className="text-base sm:text-lg font-semibold text-white mt-4 mb-2 tracking-tight" {...props} />,
    ul: ({ node, ...props }: any) => <ul className="mb-4 pl-6 list-disc space-y-1.5 text-[#ECECEC] text-[15px] sm:text-[16px]" {...props} />,
    ol: ({ node, ...props }: any) => <ol className="mb-4 pl-6 list-decimal space-y-1.5 text-[#ECECEC] text-[15px] sm:text-[16px]" {...props} />,
    li: ({ node, ...props }: any) => <li className="pl-1 leading-[1.75]" {...props} />,
    strong: ({ node, ...props }: any) => <strong className="font-semibold text-white" {...props} />,
    code: ({ node, inline, ...props }: any) => {
      if (inline) {
        return <code className="px-1.5 py-0.5 rounded text-xs font-mono font-medium bg-slate-800/80 text-blue-300 border border-slate-700/50" {...props} />;
      }
      return (
        <div className="my-4 rounded-xl overflow-hidden border border-slate-800 bg-[#0E1524]">
          <div className="px-4 py-1.5 bg-slate-850 border-b border-slate-800 text-[11px] font-mono text-slate-400">code</div>
          <code className="block p-4 text-slate-100 overflow-x-auto text-xs font-mono leading-relaxed" {...props} />
        </div>
      );
    },
    blockquote: ({ node, ...props }: any) => (
      <blockquote className="border-l-3 border-blue-500 pl-4 py-1 italic my-4 text-slate-300 bg-blue-950/20 rounded-r-lg" {...props} />
    ),
    table: ({ node, ...props }: any) => (
      <div className="my-4 overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-sm border-collapse" {...props} />
      </div>
    ),
    thead: ({ node, ...props }: any) => <thead className="bg-slate-800/80 text-white font-semibold border-b border-slate-700" {...props} />,
    th: ({ node, ...props }: any) => <th className="p-3 font-semibold text-xs uppercase tracking-wider text-slate-300" {...props} />,
    td: ({ node, ...props }: any) => <td className="p-3 border-t border-slate-800/80 text-slate-200 text-xs sm:text-sm" {...props} />
  };

  return (
    <div className="flex h-[100dvh] w-full bg-[#090E17] text-[#F1F5F9] overflow-hidden">
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
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
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

        {/* Top Executive Navigation Bar - Sticky, Always Visible on Mobile & Desktop */}
        <header className="sticky top-0 left-0 right-0 z-40 w-full h-14 sm:h-16 flex items-center justify-between px-2.5 sm:px-6 bg-[#090E17] border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 shrink">
            <button
              onClick={() => setIsSidebarOpen(prev => !prev)}
              className="p-1.5 sm:p-2 text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-xl transition-all cursor-pointer shrink-0"
              title={isSidebarOpen ? "Collapse sidebar" : "Open sidebar"}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            {/* Show logo: Always visible on mobile, responsive width */}
            <img
              src="/images/Margam-text-logo.png"
              alt="Margam AI"
              className={`h-6 sm:h-8 max-w-[105px] xs:max-w-[125px] sm:max-w-[150px] object-contain cursor-pointer hover:opacity-90 transition-opacity ${isSidebarOpen ? 'flex md:hidden' : 'flex'}`}
              onClick={handleNewSession}
            />

            <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-slate-800 text-xs text-slate-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Advisory Engine Active</span>
            </div>
          </div>

          {/* Feature Action Buttons */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Book 1-on-1 Consultation */}
            <button
              onClick={() => setIsConsultModalOpen(true)}
              className="px-2.5 sm:px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shrink-0"
              title="Book Free 30-Min Strategy Call"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="hidden sm:inline">Book 1-on-1 Call</span>
              <span className="sm:hidden text-[11px]">Book</span>
            </button>

            {/* Desktop Action Buttons */}
            <div className="hidden md:flex items-center gap-1.5">
              {/* Cost Simulator */}
              <button
                onClick={() => setIsCostCalcOpen(true)}
                className="px-2.5 sm:px-3 py-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-700/80 text-slate-200 hover:text-blue-400 rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                title="Living Cost & Loan Simulator"
              >
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span>Cost Calculator</span>
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
                <span>Audit SOP / CV</span>
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
                  <span>{isExporting ? 'Exporting...' : 'Export'}</span>
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
                <span>Counselor Portal</span>
              </button>
            </div>

            {/* Mobile Tools Dropdown */}
            <div className="relative md:hidden">
              <button
                onClick={() => setIsMobileToolsOpen(prev => !prev)}
                className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer shrink-0"
                title="Tools & Features"
              >
                <span className="text-[11px]">Tools</span>
                <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isMobileToolsOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setIsMobileToolsOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-48 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2 z-40 space-y-1 animate-stage text-xs font-medium">
                    <button
                      onClick={() => { setIsCostCalcOpen(true); setIsMobileToolsOpen(false); }}
                      className="w-full text-left px-3 py-2 rounded-xl text-slate-200 hover:bg-slate-800 hover:text-emerald-400 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <span>Cost Calculator</span>
                    </button>
                    <button
                      onClick={() => { setIsDocReviewOpen(true); setIsMobileToolsOpen(false); }}
                      className="w-full text-left px-3 py-2 rounded-xl text-slate-200 hover:bg-slate-800 hover:text-blue-400 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>Audit SOP / CV</span>
                    </button>
                    <button
                      onClick={() => { setIsCounselorDashboardOpen(true); setIsMobileToolsOpen(false); }}
                      className="w-full text-left px-3 py-2 rounded-xl text-slate-200 hover:bg-slate-800 hover:text-indigo-400 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      <span>Counselor CRM</span>
                    </button>
                    {messages.length > 0 && (
                      <button
                        onClick={() => { handleExportRoadmap(); setIsMobileToolsOpen(false); }}
                        className="w-full text-left px-3 py-2 rounded-xl text-slate-200 hover:bg-slate-800 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span>Export Roadmap</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Student Profile Drawer */}
            <button
              onClick={() => setIsProfileOpen(true)}
              className="flex items-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-all border border-slate-700 cursor-pointer shrink-0"
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
              className="p-2 text-slate-400 hover:text-blue-400 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
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

                {/* Floating Command Dock (Hero) - ChatGPT Style */}
                <div className="max-w-2xl mx-auto w-full">
                  <div className="bg-[#151D2A]/90 backdrop-blur-xl rounded-[28px] border border-slate-700/80 shadow-2xl p-2.5 sm:p-3 focus-within:border-blue-500/80 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                    {/* Attachment preview chip if a document is selected */}
                    {attachedDoc && (
                      <div className="flex items-center justify-between px-3 py-1.5 mb-2 bg-blue-950/70 border border-blue-800/80 rounded-2xl text-xs text-blue-200 animate-stage">
                        <div className="flex items-center gap-2 min-w-0">
                          <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="font-semibold truncate max-w-[200px] sm:max-w-xs">{attachedDoc.filename}</span>
                          <span className="text-[10px] text-blue-300 shrink-0">
                            {attachedDoc.pageCount ? `(${attachedDoc.pageCount} pgs • ${formatFileSize(attachedDoc.fileSize)})` : `(${formatFileSize(attachedDoc.fileSize)})`}
                          </span>
                        </div>
                        <button
                          onClick={() => setAttachedDoc(null)}
                          className="p-1 hover:text-white hover:bg-blue-900/60 rounded-lg transition-colors cursor-pointer"
                          title="Remove attachment"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    )}

                    {/* Hidden file input */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept=".pdf,.doc,.docx,.txt,.csv"
                      className="hidden"
                    />

                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={e => {
                        setInput(e.target.value);
                        adjustTextareaHeight(e.target);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder={attachedDoc ? `Ask about ${attachedDoc.filename}...` : "Ask anything about visas, universities, blocked accounts, SOPs..."}
                      rows={1}
                      className="w-full bg-transparent px-2 sm:px-3 py-1.5 text-sm sm:text-base text-white placeholder:text-slate-500 focus:outline-none resize-none leading-relaxed max-h-[200px] overflow-y-auto"
                      style={{ minHeight: '44px' }}
                    />

                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80 px-1">
                      <div className="flex items-center gap-1 sm:gap-1.5">
                        {/* Attach Document Button */}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingDoc}
                          className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
                          title="Upload PDF, DOCX, or document"
                        >
                          {isUploadingDoc ? (
                            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                          )}
                          <span className="hidden sm:inline text-xs font-medium">{isUploadingDoc ? 'Uploading...' : 'Attach'}</span>
                        </button>

                        {/* Live Web Search */}
                        <button
                          onClick={() => setIncludeLatestInfo(!includeLatestInfo)}
                          className={`px-2 py-1 rounded-xl text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
                            includeLatestInfo
                              ? 'text-blue-300 bg-blue-950/60 font-semibold border border-blue-800'
                              : 'text-slate-400 hover:text-white hover:bg-slate-800'
                          }`}
                          title="Search live web data"
                        >
                          <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span className="hidden sm:inline text-[11px] font-medium">Live Search</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 sm:gap-2">
                        {/* Voice Input Button (Mic Aligned to Right) */}
                        <button
                          onClick={toggleSpeechRecognition}
                          className={`p-1.5 sm:p-2 rounded-xl text-xs transition-colors flex items-center gap-1 cursor-pointer ${
                            isListening
                              ? 'text-red-400 bg-red-950/60 ring-1 ring-red-500/40 animate-pulse'
                              : 'text-slate-400 hover:text-white hover:bg-slate-800'
                          }`}
                          title="Voice input (Mic)"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                          </svg>
                          <span className="hidden sm:inline text-[11px] font-medium">{isListening ? 'Listening...' : ''}</span>
                        </button>

                        {/* Ask Mentor Button */}
                        <button
                          onClick={() => handleSend()}
                          disabled={(!input.trim() && !attachedDoc) || isTyping}
                          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 sm:px-5 py-2 rounded-xl font-semibold text-xs sm:text-sm transition-all disabled:opacity-40 shadow-sm hover:shadow-blue-500/25 flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>Ask Mentor</span>
                          <span>→</span>
                        </button>
                      </div>
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
            /* Chat Messages Feed - ChatGPT Style */
            <div className="max-w-3xl mx-auto pt-6 pb-40 px-3 sm:px-6 space-y-7">
              {messages.map(msg => (
                <div key={msg.id} className="animate-stage group">
                  {msg.role === MessageRole.USER ? (
                    <div className="flex justify-end">
                      <div className="max-w-[85%] sm:max-w-[72%] bg-[#222B3B] hover:bg-[#263143] border border-slate-700/60 text-slate-100 rounded-3xl rounded-tr-md px-5 py-3.5 shadow-xs transition-colors space-y-2">
                        {/* Attached Document Preview Badge on User Message */}
                        {msg.document && (
                          <div className="flex items-center gap-2.5 px-3 py-2 bg-slate-900/80 rounded-2xl border border-slate-700/80 text-xs">
                            <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-slate-100 truncate text-xs">{msg.document.filename}</div>
                              <div className="text-[10px] text-slate-400">
                                {msg.document.pageCount ? `${msg.document.pageCount} pgs • ` : ''}
                                {formatFileSize(msg.document.fileSize)}
                              </div>
                            </div>
                          </div>
                        )}
                        <p className="text-[15px] sm:text-[16px] leading-[1.7] font-normal whitespace-pre-wrap break-words">
                          {msg.content}
                        </p>
                        <div className="text-[10px] text-right font-medium text-slate-400">
                          {formatTime(msg.timestamp)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Assistant Response: Zero Card Box, Zero Border — Pure ChatGPT Style */
                    <div className="w-full text-slate-100 space-y-3 pl-1 sm:pl-2">
                      {/* Margam AI Minimalist Header */}
                      <div className="flex items-center gap-2.5 select-none pt-1">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shadow-xs shrink-0">
                          M
                        </div>
                        <span className="text-xs font-semibold text-slate-200 tracking-wide">
                          Margam AI
                        </span>
                      </div>

                      {/* Main Message Content */}
                      <div className="chatgpt-prose prose prose-invert max-w-none text-[15px] sm:text-[16px] leading-[1.75] text-[#ECECEC] font-normal">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                          {msg.content}
                        </ReactMarkdown>

                        {/* Blinking streaming cursor */}
                        {msg.isStreaming && (
                          <span className="inline-block w-2 h-4.5 ml-1 bg-blue-400 animate-pulse align-middle rounded-xs"></span>
                        )}
                      </div>

                      {/* ChatGPT-style Ghost Action Bar */}
                      {!msg.isStreaming && msg.content && (
                        <div className="flex items-center flex-wrap gap-2 pt-1 text-slate-400">
                          {/* Audio TTS */}
                          <button
                            onClick={() => toggleSpeak(msg.id, msg.content)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
                            title={speakingMessageId === msg.id ? 'Stop audio' : 'Listen to response'}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            </svg>
                          </button>

                          {/* Copy button */}
                          <button
                            onClick={() => handleCopy(msg.id, msg.content)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
                            title="Copy response"
                          >
                            {copiedId === msg.id ? (
                              <span className="text-emerald-400 text-xs font-semibold inline-flex items-center gap-1">
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

                          {/* Sources Badge */}
                          {msg.citations && msg.citations.length > 0 && (
                            <button
                              onClick={() => {
                                setModalCitations(msg.citations || []);
                                setSelectedCitation(msg.citations?.[0] || null);
                                setIsCitationModalOpen(true);
                              }}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium text-blue-400 hover:text-blue-300 hover:bg-blue-950/40 border border-blue-900/50 transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                              </svg>
                              <span>{msg.citations.length} Sources</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Consultation Strategy Escalation Card */}
                      {(msg.is_escalation || msg.cta_type === 'book_consultation') && (
                        <div className="mt-5 p-5 sm:p-6 bg-gradient-to-br from-[#111827] via-[#131d2e] to-[#0f172a] rounded-2xl border border-blue-900/60 shadow-lg space-y-3">
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
                        <div className="mt-4 pt-2 space-y-2">
                          <div className="flex flex-wrap gap-2">
                            {msg.suggestions.map((s, sIdx) => (
                              <button
                                key={sIdx}
                                onClick={() => handleSend(s)}
                                className="text-xs px-3.5 py-1.5 rounded-full bg-slate-800/80 hover:bg-blue-950/60 text-slate-200 hover:text-blue-300 border border-slate-700/80 hover:border-blue-700 transition-all font-medium cursor-pointer"
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
                <div className="w-full flex items-center gap-3 pl-2 py-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"></span>
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                  <span className="text-xs font-medium text-slate-400">
                    {statusMessage || 'Margam AI is reasoning...'}
                  </span>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Floating Bottom Input Bar for Active Chat - ChatGPT Style */}
        {!isLanding && (
          <div className="absolute bottom-0 inset-x-0 p-3 sm:p-4 bg-gradient-to-t from-[#090E17] via-[#090E17]/95 to-transparent z-20">
            <div className="max-w-3xl mx-auto w-full">
              <div className="bg-[#151D2A]/95 backdrop-blur-xl rounded-[28px] border border-slate-700/80 shadow-2xl p-2.5 sm:p-3 focus-within:border-blue-500/80 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                {/* Document Attachment Chip if selected */}
                {attachedDoc && (
                  <div className="flex items-center justify-between px-3 py-1.5 mb-2 bg-blue-950/70 border border-blue-800/80 rounded-2xl text-xs text-blue-200 animate-stage">
                    <div className="flex items-center gap-2 min-w-0">
                      <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="font-semibold truncate max-w-[180px] sm:max-w-xs">{attachedDoc.filename}</span>
                      <span className="text-[10px] text-blue-300 shrink-0">
                        {attachedDoc.pageCount ? `(${attachedDoc.pageCount} pgs • ${formatFileSize(attachedDoc.fileSize)})` : `(${formatFileSize(attachedDoc.fileSize)})`}
                      </span>
                    </div>
                    <button
                      onClick={() => setAttachedDoc(null)}
                      className="p-1 hover:text-white hover:bg-blue-900/60 rounded-lg transition-colors cursor-pointer"
                      title="Remove attachment"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={activeFileInputRef}
                  onChange={handleFileUpload}
                  accept=".pdf,.doc,.docx,.txt,.csv"
                  className="hidden"
                />

                <textarea
                  ref={activeTextareaRef}
                  value={input}
                  onChange={e => {
                    setInput(e.target.value);
                    adjustTextareaHeight(e.target);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={attachedDoc ? `Ask about ${attachedDoc.filename}...` : "Ask a follow-up question..."}
                  rows={1}
                  className="w-full bg-transparent px-2 sm:px-3 py-1.5 text-sm sm:text-base text-white placeholder:text-slate-500 focus:outline-none resize-none leading-relaxed max-h-[200px] overflow-y-auto"
                  style={{ minHeight: '40px' }}
                />

                <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80 px-1">
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    {/* File Attachment Button */}
                    <button
                      type="button"
                      onClick={() => activeFileInputRef.current?.click()}
                      disabled={isUploadingDoc}
                      className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
                      title="Upload PDF, DOCX, or document"
                    >
                      {isUploadingDoc ? (
                        <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                      )}
                      <span className="hidden sm:inline text-xs font-medium">{isUploadingDoc ? 'Uploading...' : 'Attach'}</span>
                    </button>
                    
                    {/* Live Web Search */}
                    <button
                      onClick={() => setIncludeLatestInfo(!includeLatestInfo)}
                      className={`px-2 py-1 rounded-xl text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors ${
                        includeLatestInfo
                          ? 'text-blue-300 bg-blue-950/60 border border-blue-800'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                      title="Search live web data"
                    >
                      <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span className="hidden sm:inline">Live Search</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1 sm:gap-2">
                    {/* Voice Input (Mic) Aligned to Right */}
                    <button
                      onClick={toggleSpeechRecognition}
                      className={`p-2 rounded-full text-xs transition-colors flex items-center justify-center cursor-pointer ${
                        isListening
                          ? 'text-red-400 bg-red-950/60 ring-2 ring-red-500/40 animate-pulse'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                      title="Voice input (Mic)"
                    >
                      <svg className="w-4 h-4 sm:w-4.5 sm:h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    </button>

                    {/* Send Button */}
                    <button
                      onClick={() => handleSend()}
                      disabled={(!input.trim() && !attachedDoc) || isTyping}
                      className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-30 disabled:hover:from-blue-600 disabled:hover:to-indigo-600 text-white rounded-full flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
                      title="Send message"
                    >
                      <svg className="w-4 h-4 transform rotate-90" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                      </svg>
                    </button>
                  </div>
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
