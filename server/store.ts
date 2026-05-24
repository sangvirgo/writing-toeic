import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  AppDatabase,
  ChunkDatabase,
  IeltsDifficulty,
  IeltsPracticeMode,
  IeltsPrompt,
  IeltsPromptDatabase,
  IeltsTopic,
  ToeicChunk,
  WritingAttempt,
} from './types.js';

const STORE_DIR = path.resolve(process.cwd(), 'store');
const HISTORY_FILE = path.join(STORE_DIR, 'writing-history.json');
const CHUNKS_FILE = path.join(STORE_DIR, 'toeic-chunks.json');
const IELTS_PROMPTS_FILE = path.join(STORE_DIR, 'ielts-prompts.json');

const EMPTY_HISTORY: AppDatabase = {
  version: 1,
  updatedAt: null,
  attempts: [],
};

const EMPTY_CHUNKS: ChunkDatabase = {
  version: 1,
  updatedAt: null,
  chunks: [],
};

const EMPTY_IELTS_PROMPTS: IeltsPromptDatabase = {
  version: 1,
  updatedAt: null,
  prompts: [],
};

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureStoreFiles(): Promise<void> {
  await fs.mkdir(STORE_DIR, { recursive: true });
  if (!(await fileExists(HISTORY_FILE))) {
    await fs.writeFile(HISTORY_FILE, JSON.stringify(EMPTY_HISTORY, null, 2), 'utf8');
  }
  if (!(await fileExists(CHUNKS_FILE))) {
    await fs.writeFile(CHUNKS_FILE, JSON.stringify(EMPTY_CHUNKS, null, 2), 'utf8');
  }
  if (!(await fileExists(IELTS_PROMPTS_FILE))) {
    await fs.writeFile(
      IELTS_PROMPTS_FILE,
      JSON.stringify(EMPTY_IELTS_PROMPTS, null, 2),
      'utf8',
    );
  }
}

async function readJsonFile<T>(filePath: string, label: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf8');
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`${label} is corrupted: ${message}`);
  }
}

export async function readHistoryDb(): Promise<AppDatabase> {
  await ensureStoreFiles();
  const db = await readJsonFile<AppDatabase>(HISTORY_FILE, 'writing-history.json');
  if (!db || !Array.isArray(db.attempts)) {
    throw new Error('writing-history.json has invalid shape.');
  }
  return db;
}

export async function writeHistoryDb(db: AppDatabase): Promise<void> {
  await ensureStoreFiles();
  await fs.writeFile(HISTORY_FILE, JSON.stringify(db, null, 2), 'utf8');
}

export async function appendAttempt(attempt: WritingAttempt): Promise<WritingAttempt> {
  const db = await readHistoryDb();
  db.attempts.push(attempt);
  db.updatedAt = new Date().toISOString();
  await writeHistoryDb(db);
  return attempt;
}

export async function deleteAttempt(id: string): Promise<boolean> {
  const db = await readHistoryDb();
  const before = db.attempts.length;
  db.attempts = db.attempts.filter((a) => a.id !== id);
  if (db.attempts.length === before) return false;
  db.updatedAt = new Date().toISOString();
  await writeHistoryDb(db);
  return true;
}

export async function readChunkDb(): Promise<ChunkDatabase> {
  await ensureStoreFiles();
  const db = await readJsonFile<ChunkDatabase>(CHUNKS_FILE, 'toeic-chunks.json');
  if (!db || !Array.isArray(db.chunks)) {
    throw new Error('toeic-chunks.json has invalid shape.');
  }
  return db;
}

export async function writeChunkDb(db: ChunkDatabase): Promise<void> {
  await ensureStoreFiles();
  await fs.writeFile(CHUNKS_FILE, JSON.stringify(db, null, 2), 'utf8');
}

export async function appendChunks(chunks: ToeicChunk[]): Promise<void> {
  if (chunks.length === 0) return;
  const db = await readChunkDb();
  db.chunks.push(...chunks);
  db.updatedAt = new Date().toISOString();
  await writeChunkDb(db);
}

export async function deleteChunkById(id: string): Promise<boolean> {
  const db = await readChunkDb();
  const before = db.chunks.length;
  db.chunks = db.chunks.filter((c) => c.id !== id);
  if (db.chunks.length === before) return false;
  db.updatedAt = new Date().toISOString();
  await writeChunkDb(db);
  return true;
}

export type PatternFavoriteResult =
  | { ok: true; attempt: WritingAttempt }
  | { ok: false; reason: 'attempt_not_found' | 'pattern_not_found' };

export async function readIeltsPromptDb(): Promise<IeltsPromptDatabase> {
  await ensureStoreFiles();
  const db = await readJsonFile<IeltsPromptDatabase>(IELTS_PROMPTS_FILE, 'ielts-prompts.json');
  if (!db || !Array.isArray(db.prompts)) {
    throw new Error('ielts-prompts.json has invalid shape.');
  }
  return db;
}

export interface IeltsPromptFilters {
  mode?: IeltsPracticeMode;
  topic?: IeltsTopic;
  difficulty?: IeltsDifficulty;
  search?: string;
}

export async function getIeltsPrompts(filters?: IeltsPromptFilters): Promise<IeltsPrompt[]> {
  const db = await readIeltsPromptDb();
  let list = db.prompts;
  if (filters?.mode) list = list.filter((p) => p.mode === filters.mode);
  if (filters?.topic) list = list.filter((p) => p.topic === filters.topic);
  if (filters?.difficulty) list = list.filter((p) => p.difficulty === filters.difficulty);
  if (filters?.search) {
    const needle = filters.search.toLowerCase();
    list = list.filter(
      (p) =>
        p.question.toLowerCase().includes(needle) ||
        p.instruction.toLowerCase().includes(needle) ||
        (p.targetPattern ?? '').toLowerCase().includes(needle) ||
        p.topic.toLowerCase().includes(needle) ||
        p.difficulty.toLowerCase().includes(needle),
    );
  }
  return list;
}

export async function getRandomIeltsPrompt(
  filters?: IeltsPromptFilters,
): Promise<IeltsPrompt | null> {
  const list = await getIeltsPrompts(filters);
  if (list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)];
}

export async function setPatternFavorite(
  attemptId: string,
  patternIndex: number,
  favorite: boolean,
): Promise<PatternFavoriteResult> {
  const db = await readHistoryDb();
  const attempt = db.attempts.find((a) => a.id === attemptId);
  if (!attempt) return { ok: false, reason: 'attempt_not_found' };
  const patterns = attempt.feedback.usefulPatterns;
  if (patternIndex < 0 || patternIndex >= patterns.length) {
    return { ok: false, reason: 'pattern_not_found' };
  }
  patterns[patternIndex] = { ...patterns[patternIndex], favorite };
  db.updatedAt = new Date().toISOString();
  await writeHistoryDb(db);
  return { ok: true, attempt };
}
