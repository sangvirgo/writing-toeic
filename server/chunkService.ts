import { randomUUID } from 'node:crypto';
import { appendChunks, deleteChunkById, readChunkDb } from './store.js';
import { generateMockChunks } from './mockAi.js';
import { generateChunksWithGemini, isGeminiEnabled } from './gemini.js';
import {
  ChunkDifficulty,
  ChunkTopic,
  FeedbackSource,
  GeminiModelId,
  ToeicChunk,
} from './types.js';

export interface ChunkFilters {
  topic?: ChunkTopic;
  difficulty?: ChunkDifficulty;
  search?: string;
}

const VALID_TOPICS: ChunkTopic[] = [
  'meeting',
  'office',
  'travel',
  'customer_service',
  'shopping',
  'hr',
  'finance',
  'business',
  'general',
];
const VALID_DIFFICULTIES: ChunkDifficulty[] = ['easy', 'medium', 'hard'];

function applyFilters(chunks: ToeicChunk[], filters: ChunkFilters): ToeicChunk[] {
  const needle = filters.search?.trim().toLowerCase();
  return chunks.filter((c) => {
    if (filters.topic && c.topic !== filters.topic) return false;
    if (filters.difficulty && c.difficulty !== filters.difficulty) return false;
    if (needle) {
      const hay = `${c.text} ${c.meaningVi} ${c.example} ${c.tags.join(' ')}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

export async function getAllChunks(filters: ChunkFilters = {}): Promise<ToeicChunk[]> {
  const db = await readChunkDb();
  return applyFilters(db.chunks, filters);
}

export async function getRandomChunk(filters: ChunkFilters = {}): Promise<ToeicChunk | null> {
  const pool = await getAllChunks(filters);
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export interface ManualChunkInput {
  text: string;
  meaningVi: string;
  topic: string;
  difficulty: string;
  example: string;
  tags: unknown;
}

export interface ValidatedChunkDraft {
  text: string;
  meaningVi: string;
  topic: ChunkTopic;
  difficulty: ChunkDifficulty;
  example: string;
  tags: string[];
}

export type ChunkValidationError =
  | 'text_required'
  | 'meaning_required'
  | 'example_required'
  | 'topic_invalid'
  | 'difficulty_invalid';

export function validateChunkDraft(
  raw: Partial<ManualChunkInput> | undefined | null,
): { ok: true; draft: ValidatedChunkDraft } | { ok: false; error: ChunkValidationError } {
  const input = raw ?? {};
  const text = typeof input.text === 'string' ? input.text.trim() : '';
  if (!text) return { ok: false, error: 'text_required' };
  const meaningVi = typeof input.meaningVi === 'string' ? input.meaningVi.trim() : '';
  if (!meaningVi) return { ok: false, error: 'meaning_required' };
  const example = typeof input.example === 'string' ? input.example.trim() : '';
  if (!example) return { ok: false, error: 'example_required' };
  const topic = typeof input.topic === 'string' ? input.topic : '';
  if (!VALID_TOPICS.includes(topic as ChunkTopic)) return { ok: false, error: 'topic_invalid' };
  const difficulty = typeof input.difficulty === 'string' ? input.difficulty : '';
  if (!VALID_DIFFICULTIES.includes(difficulty as ChunkDifficulty)) {
    return { ok: false, error: 'difficulty_invalid' };
  }
  const rawTags = input.tags;
  let tags: string[] = [];
  if (Array.isArray(rawTags)) {
    tags = rawTags
      .map((t) => (typeof t === 'string' ? t.trim() : ''))
      .filter((t) => t.length > 0);
  } else if (typeof rawTags === 'string') {
    tags = rawTags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }
  return {
    ok: true,
    draft: {
      text,
      meaningVi,
      topic: topic as ChunkTopic,
      difficulty: difficulty as ChunkDifficulty,
      example,
      tags,
    },
  };
}

export async function addManualChunk(
  draft: ValidatedChunkDraft,
): Promise<{ ok: true; chunk: ToeicChunk } | { ok: false; reason: 'duplicate' }> {
  const db = await readChunkDb();
  const needle = draft.text.toLowerCase();
  if (db.chunks.some((c) => c.text.toLowerCase() === needle)) {
    return { ok: false, reason: 'duplicate' };
  }
  const chunk: ToeicChunk = {
    id: randomUUID(),
    text: draft.text,
    meaningVi: draft.meaningVi,
    topic: draft.topic,
    difficulty: draft.difficulty,
    example: draft.example,
    source: 'manual',
    tags: draft.tags,
  };
  await appendChunks([chunk]);
  return { ok: true, chunk };
}

export async function removeChunk(id: string): Promise<boolean> {
  return deleteChunkById(id);
}

export interface GenerateRequest {
  topic: ChunkTopic;
  difficulty: ChunkDifficulty;
  count: number;
  model: GeminiModelId;
}

export interface GenerateResult {
  created: ToeicChunk[];
  skippedDuplicates: string[];
  source: FeedbackSource;
  model: GeminiModelId;
}

export interface ValidatedGenerateDraft {
  topic: ChunkTopic;
  difficulty: ChunkDifficulty;
  count: number;
}

export function validateGenerateRequest(
  raw: { topic?: unknown; difficulty?: unknown; count?: unknown } | undefined | null,
):
  | { ok: true; draft: ValidatedGenerateDraft }
  | { ok: false; error: 'topic_invalid' | 'difficulty_invalid' | 'count_invalid' } {
  const input = raw ?? {};
  const topic = typeof input.topic === 'string' ? input.topic : '';
  if (!VALID_TOPICS.includes(topic as ChunkTopic)) return { ok: false, error: 'topic_invalid' };
  const difficulty = typeof input.difficulty === 'string' ? input.difficulty : '';
  if (!VALID_DIFFICULTIES.includes(difficulty as ChunkDifficulty)) {
    return { ok: false, error: 'difficulty_invalid' };
  }
  const countValue = typeof input.count === 'number' ? input.count : Number(input.count);
  if (!Number.isFinite(countValue) || countValue < 1 || countValue > 20) {
    return { ok: false, error: 'count_invalid' };
  }
  return {
    ok: true,
    draft: {
      topic: topic as ChunkTopic,
      difficulty: difficulty as ChunkDifficulty,
      count: Math.floor(countValue),
    },
  };
}

interface RawGeneratedChunk {
  text: string;
  meaningVi: string;
  example: string;
  tags: string[];
}

function sanitizeGenerated(
  raw: unknown,
  topic: ChunkTopic,
  difficulty: ChunkDifficulty,
): RawGeneratedChunk[] {
  if (!Array.isArray(raw)) return [];
  const out: RawGeneratedChunk[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const text = typeof obj.text === 'string' ? obj.text.trim() : '';
    const meaningVi = typeof obj.meaningVi === 'string' ? obj.meaningVi.trim() : '';
    const example = typeof obj.example === 'string' ? obj.example.trim() : '';
    if (!text || !meaningVi || !example) continue;
    // We trust topic/difficulty from the request rather than the model echo —
    // the model is asked to match, but we override to be safe.
    const itemTopic =
      typeof obj.topic === 'string' && VALID_TOPICS.includes(obj.topic as ChunkTopic)
        ? (obj.topic as ChunkTopic)
        : topic;
    const itemDifficulty =
      typeof obj.difficulty === 'string' &&
      VALID_DIFFICULTIES.includes(obj.difficulty as ChunkDifficulty)
        ? (obj.difficulty as ChunkDifficulty)
        : difficulty;
    if (itemTopic !== topic || itemDifficulty !== difficulty) continue;
    const tagsRaw = obj.tags;
    const tags = Array.isArray(tagsRaw)
      ? tagsRaw
          .map((t) => (typeof t === 'string' ? t.trim() : ''))
          .filter((t) => t.length > 0)
      : [];
    out.push({ text, meaningVi, example, tags });
  }
  return out;
}

export async function generateChunks(
  request: GenerateRequest,
  apiKeyOverride?: string,
): Promise<GenerateResult> {
  let raw: unknown;
  let source: FeedbackSource;

  if (isGeminiEnabled() || apiKeyOverride) {
    try {
      raw = await generateChunksWithGemini(request, apiKeyOverride);
      source = 'gemini';
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[generateChunks] Gemini failed:', message);
      if (process.env.USE_MOCK_ON_GEMINI_ERROR === 'true') {
        raw = generateMockChunks(request);
        source = 'mock';
      } else {
        throw err;
      }
    }
  } else {
    raw = generateMockChunks(request);
    source = 'mock';
  }

  const cleaned = sanitizeGenerated(raw, request.topic, request.difficulty);

  const db = await readChunkDb();
  const existing = new Set(db.chunks.map((c) => c.text.toLowerCase()));
  const created: ToeicChunk[] = [];
  const skippedDuplicates: string[] = [];
  const seenThisBatch = new Set<string>();

  for (const item of cleaned) {
    const key = item.text.toLowerCase();
    if (existing.has(key) || seenThisBatch.has(key)) {
      skippedDuplicates.push(item.text);
      continue;
    }
    seenThisBatch.add(key);
    created.push({
      id: randomUUID(),
      text: item.text,
      meaningVi: item.meaningVi,
      topic: request.topic,
      difficulty: request.difficulty,
      example: item.example,
      source: 'ai',
      tags: item.tags,
    });
  }

  await appendChunks(created);
  return { created, skippedDuplicates, source, model: request.model };
}
