export type PracticeMode =
  | 'toeic_chunk'
  | 'daily_journal'
  | 'mistake_review'
  | 'ielts_sentence'
  | 'ielts_paragraph';

export type IeltsPracticeMode = 'ielts_sentence' | 'ielts_paragraph';

export type IeltsTopic =
  | 'education'
  | 'technology'
  | 'environment'
  | 'work'
  | 'health'
  | 'government'
  | 'society'
  | 'crime'
  | 'transport'
  | 'media';

export type IeltsDifficulty = 'easy' | 'medium' | 'hard';

export interface IeltsPrompt {
  id: string;
  mode: IeltsPracticeMode;
  topic: IeltsTopic;
  difficulty: IeltsDifficulty;
  question: string;
  targetPattern?: string;
  instruction: string;
}

export interface IeltsPromptDatabase {
  version: number;
  updatedAt: string | null;
  prompts: IeltsPrompt[];
}

export type MistakeType = 'grammar' | 'vocabulary' | 'naturalness' | 'structure';

export interface IeltsFeedback {
  estimatedBand?: number;
  taskResponse?: number;
  coherenceCohesion?: number;
  lexicalResource?: number;
  grammaticalRangeAccuracy?: number;
  mainAdvice?: string[];
}

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
  ielts?: IeltsFeedback;
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
