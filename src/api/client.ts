import type {
  AppDatabase,
  ChunkDifficulty,
  ChunkTopic,
  FeedbackSource,
  GeminiModelId,
  GeminiModelInfo,
  PracticeMode,
  ToeicChunk,
  WritingAttempt,
} from '../types';

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore JSON parse error
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export async function getHealth(): Promise<{
  ok: boolean;
  geminiEnabled: boolean;
  defaultModel: GeminiModelId;
}> {
  const res = await fetch('/api/health');
  return handle(res);
}

export interface GetModelsResponse {
  defaultModel: GeminiModelId;
  models: GeminiModelInfo[];
  geminiEnabled: boolean;
}

export async function getModels(): Promise<GetModelsResponse> {
  const res = await fetch('/api/models');
  return handle<GetModelsResponse>(res);
}

export async function getHistory(): Promise<AppDatabase> {
  const res = await fetch('/api/history');
  return handle<AppDatabase>(res);
}

export interface AnalyzeRequest {
  mode: PracticeMode;
  prompt: string;
  userWriting: string;
  model?: GeminiModelId;
}

export interface AnalyzeResponse {
  attempt: WritingAttempt;
  source: FeedbackSource;
  model: GeminiModelId;
}

export async function analyzeWriting(input: AnalyzeRequest): Promise<AnalyzeResponse> {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return handle<AnalyzeResponse>(res);
}

export async function deleteHistoryItem(id: string): Promise<void> {
  const res = await fetch(`/api/history/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  await handle<{ ok: boolean }>(res);
}

export interface ChunkFiltersClient {
  topic?: ChunkTopic;
  difficulty?: ChunkDifficulty;
  search?: string;
}

function toQuery(filters: ChunkFiltersClient | undefined): string {
  if (!filters) return '';
  const params = new URLSearchParams();
  if (filters.topic) params.set('topic', filters.topic);
  if (filters.difficulty) params.set('difficulty', filters.difficulty);
  if (filters.search) params.set('search', filters.search);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function getChunks(filters?: ChunkFiltersClient): Promise<ToeicChunk[]> {
  const res = await fetch(`/api/chunks${toQuery(filters)}`);
  const data = await handle<{ chunks: ToeicChunk[] }>(res);
  return data.chunks;
}

export async function getRandomChunk(filters?: ChunkFiltersClient): Promise<ToeicChunk> {
  const res = await fetch(`/api/chunks/random${toQuery(filters)}`);
  const data = await handle<{ chunk: ToeicChunk }>(res);
  return data.chunk;
}

export interface CreateChunkInput {
  text: string;
  meaningVi: string;
  topic: ChunkTopic;
  difficulty: ChunkDifficulty;
  example: string;
  tags: string[];
}

export async function createChunk(input: CreateChunkInput): Promise<ToeicChunk> {
  const res = await fetch('/api/chunks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await handle<{ chunk: ToeicChunk }>(res);
  return data.chunk;
}

export async function deleteChunk(id: string): Promise<void> {
  const res = await fetch(`/api/chunks/${encodeURIComponent(id)}`, { method: 'DELETE' });
  await handle<{ ok: boolean }>(res);
}

export interface GenerateChunksInput {
  topic: ChunkTopic;
  difficulty: ChunkDifficulty;
  count: number;
  model?: GeminiModelId;
}

export interface GenerateChunksResponse {
  created: ToeicChunk[];
  skippedDuplicates: string[];
  source: FeedbackSource;
  model: GeminiModelId;
}

export async function generateChunks(
  input: GenerateChunksInput,
): Promise<GenerateChunksResponse> {
  const res = await fetch('/api/chunks/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return handle<GenerateChunksResponse>(res);
}

export async function togglePatternFavorite(
  attemptId: string,
  patternIndex: number,
  favorite: boolean,
): Promise<void> {
  const res = await fetch(
    `/api/history/${encodeURIComponent(attemptId)}/patterns/${patternIndex}/favorite`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorite }),
    },
  );
  await handle<{ ok: boolean }>(res);
}
