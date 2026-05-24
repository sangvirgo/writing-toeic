export type PracticeMode = 'toeic_chunk' | 'daily_journal' | 'mistake_review';

export type MistakeType = 'grammar' | 'vocabulary' | 'naturalness' | 'structure';

export interface AiFeedback {
  correctedVersion: string;
  naturalVersion: string;
  score: {
    grammar: number;
    vocabulary: number;
    naturalness: number;
  };
  mistakes: {
    type: MistakeType;
    original: string;
    correction: string;
    explanation: string;
  }[];
  usefulPatterns: {
    pattern: string;
    example: string;
    favorite?: boolean;
  }[];
  ankiCards: {
    front: string;
    back: string;
  }[];
}

export interface WritingAttempt {
  id: string;
  createdAt: string;
  mode: PracticeMode;
  prompt: string;
  userWriting: string;
  feedback: AiFeedback;
}

export interface AppDatabase {
  version: number;
  updatedAt: string | null;
  attempts: WritingAttempt[];
}

export type ChunkTopic =
  | 'meeting'
  | 'office'
  | 'travel'
  | 'customer_service'
  | 'shopping'
  | 'hr'
  | 'finance'
  | 'business'
  | 'general';

export type ChunkDifficulty = 'easy' | 'medium' | 'hard';

export interface ToeicChunk {
  id: string;
  text: string;
  meaningVi: string;
  topic: ChunkTopic;
  difficulty: ChunkDifficulty;
  example: string;
  source: 'seed' | 'manual' | 'ai';
  tags: string[];
}

export interface ChunkDatabase {
  version: number;
  updatedAt: string | null;
  chunks: ToeicChunk[];
}

export type FeedbackSource = 'gemini' | 'mock';

export type GeminiModelId =
  | 'gemini-3-flash-preview'
  | 'gemini-3.5-flash'
  | 'gemini-3.1-flash-lite'
  | 'gemini-2.5-flash'
  | 'gemini-2.0-flash';

export interface GeminiModelInfo {
  id: GeminiModelId;
  label: string;
  note?: string;
}

export const GEMINI_MODELS: GeminiModelInfo[] = [
  { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview', note: 'Primary model' },
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
];

export const DEFAULT_GEMINI_MODEL: GeminiModelId = 'gemini-3-flash-preview';

export function isValidGeminiModel(id: unknown): id is GeminiModelId {
  return typeof id === 'string' && GEMINI_MODELS.some((m) => m.id === id);
}
