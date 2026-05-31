import type {
  AppDatabase,
  ChunkDifficulty,
  ChunkTopic,
  FeedbackSource,
  GeminiModelId,
  GeminiModelInfo,
  IeltsDifficulty,
  IeltsPracticeMode,
  IeltsPrompt,
  IeltsTopic,
  PracticeMode,
  ToeicChunk,
  WritingAttempt,
} from '../types';
import { getStoredApiKey } from '../components/ApiKeySettings';

/** Build headers object with optional X-Gemini-Api-Key from localStorage. */
function withApiKey(init?: RequestInit): RequestInit {
  const key = getStoredApiKey();
  if (!key) return init ?? {};
  const existing = init?.headers ?? {};
  return {
    ...init,
    headers: { ...existing, 'X-Gemini-Api-Key': key },
  };
}

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
  const res = await fetch('/api/health', withApiKey());
  return handle(res);
}

export interface GetModelsResponse {
  defaultModel: GeminiModelId;
  models: GeminiModelInfo[];
  geminiEnabled: boolean;
}

export async function getModels(): Promise<GetModelsResponse> {
  const res = await fetch('/api/models', withApiKey());
  return handle<GetModelsResponse>(res);
}

export async function getHistory(): Promise<AppDatabase> {
  const res = await fetch('/api/history', withApiKey());
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
  const res = await fetch(
    '/api/analyze',
    withApiKey({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  );
  return handle<AnalyzeResponse>(res);
}

export async function deleteHistoryItem(id: string): Promise<void> {
  const res = await fetch(
    `/api/history/${encodeURIComponent(id)}`,
    withApiKey({ method: 'DELETE' }),
  );
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
  const res = await fetch(`/api/chunks${toQuery(filters)}`, withApiKey());
  const data = await handle<{ chunks: ToeicChunk[] }>(res);
  return data.chunks;
}

export async function getRandomChunk(filters?: ChunkFiltersClient): Promise<ToeicChunk> {
  const res = await fetch(`/api/chunks/random${toQuery(filters)}`, withApiKey());
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
  const res = await fetch(
    '/api/chunks',
    withApiKey({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  );
  const data = await handle<{ chunk: ToeicChunk }>(res);
  return data.chunk;
}

export async function deleteChunk(id: string): Promise<void> {
  const res = await fetch(`/api/chunks/${encodeURIComponent(id)}`, withApiKey({ method: 'DELETE' }));
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
  const res = await fetch(
    '/api/chunks/generate',
    withApiKey({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  );
  return handle<GenerateChunksResponse>(res);
}

export async function togglePatternFavorite(
  attemptId: string,
  patternIndex: number,
  favorite: boolean,
): Promise<void> {
  const res = await fetch(
    `/api/history/${encodeURIComponent(attemptId)}/patterns/${patternIndex}/favorite`,
    withApiKey({
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorite }),
    }),
  );
  await handle<{ ok: boolean }>(res);
}

export interface IeltsPromptFiltersClient {
  mode?: IeltsPracticeMode;
  topic?: IeltsTopic;
  difficulty?: IeltsDifficulty;
  search?: string;
}

function ieltsToQuery(filters: IeltsPromptFiltersClient | undefined): string {
  if (!filters) return '';
  const params = new URLSearchParams();
  if (filters.mode) params.set('mode', filters.mode);
  if (filters.topic) params.set('topic', filters.topic);
  if (filters.difficulty) params.set('difficulty', filters.difficulty);
  if (filters.search) params.set('search', filters.search);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function getIeltsPrompts(
  filters?: IeltsPromptFiltersClient,
): Promise<IeltsPrompt[]> {
  const res = await fetch(`/api/ielts/prompts${ieltsToQuery(filters)}`, withApiKey());
  const data = await handle<{ prompts: IeltsPrompt[] }>(res);
  return data.prompts;
}

export async function getRandomIeltsPrompt(
  filters?: IeltsPromptFiltersClient,
): Promise<IeltsPrompt> {
  const res = await fetch(`/api/ielts/prompts/random${ieltsToQuery(filters)}`, withApiKey());
  const data = await handle<{ prompt: IeltsPrompt }>(res);
  return data.prompt;
}
