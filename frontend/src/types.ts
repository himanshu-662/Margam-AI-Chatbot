
export enum MessageRole {
  USER = 'user',
  BOT = 'bot',
  ASSISTANT = 'assistant',
  SYSTEM = 'system'
}

export interface DocumentAttachment {
  filename: string;
  fileSize: number;
  text?: string;
  pageCount?: number;
}

export interface CitationItem {
  source: string;
  page?: number | string;
  snippet: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  sources?: string[];
  citations?: CitationItem[];
  suggestions?: string[];
  isStreaming?: boolean;
  attachments?: FileAttachment[];
  document?: DocumentAttachment;
  is_escalation?: boolean;
  cta_type?: string;
}

export interface FileAttachment {
  name: string;
  type: string;
  data: string; // base64
  previewUrl?: string;
}

export interface StudentProfile {
  target_country?: string;
  field_of_study?: string;
  budget_range?: string;
  target_intake?: string;
  degree_level?: string;
  test_scores?: string;
  concerns?: string[];
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  messages: Message[];
  profile?: StudentProfile;
}

export interface DocumentAnalysisResult {
  document_type?: string;
  overall_score: number;
  verdict: string;
  summary: string;
  strengths: string[];
  critical_gaps: string[];
  country_specific_advice: string;
  action_checklist: string[];
}

export interface TechStackItem {
  category: string;
  name: string;
  tech: string;
  description: string;
  why: string;
  icon: string;
}
