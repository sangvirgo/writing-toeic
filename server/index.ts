import { config as loadDotenv } from 'dotenv';
loadDotenv({ override: true });
import express, { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import {
  appendAttempt,
  deleteAttempt,
  ensureStoreFiles,
  readHistoryDb,
  setPatternFavorite,
} from './store.js';
import { generateMockFeedback } from './mockAi.js';
import {
  analyzeWritingWithGemini,
  isGeminiEnabled,
  resolveDefaultModel,
} from './gemini.js';
import {
  addManualChunk,
  generateChunks,
  getAllChunks,
  getRandomChunk,
  removeChunk,
  validateChunkDraft,
  validateGenerateRequest,
} from './chunkService.js';
import {
  AiFeedback,
  ChunkDifficulty,
  ChunkTopic,
  FeedbackSource,
  GEMINI_MODELS,
  GeminiModelId,
  isValidGeminiModel,
  PracticeMode,
  WritingAttempt,
} from './types.js';

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const MAX_WRITING_LENGTH = 5000;
const VALID_MODES: PracticeMode[] = ['toeic_chunk', 'daily_journal', 'mistake_review'];
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

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    geminiEnabled: isGeminiEnabled(),
    defaultModel: resolveDefaultModel(),
  });
});

app.get('/api/models', (_req, res) => {
  res.json({
    defaultModel: resolveDefaultModel(),
    models: GEMINI_MODELS,
    geminiEnabled: isGeminiEnabled(),
  });
});

app.get('/api/history', async (_req, res, next) => {
  try {
    const db = await readHistoryDb();
    res.json(db);
  } catch (err) {
    next(err);
  }
});

app.post('/api/analyze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { mode, prompt, userWriting, model } = req.body ?? {};

    if (!mode || !VALID_MODES.includes(mode)) {
      return res
        .status(400)
        .json({ error: 'mode is required and must be "toeic_chunk", "daily_journal", or "mistake_review".' });
    }
    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'prompt is required.' });
    }
    if (typeof userWriting !== 'string' || userWriting.trim().length === 0) {
      return res.status(400).json({ error: 'userWriting is required and must not be empty.' });
    }
    if (userWriting.length > MAX_WRITING_LENGTH) {
      return res
        .status(400)
        .json({ error: `userWriting must be ${MAX_WRITING_LENGTH} characters or fewer.` });
    }

    let chosenModel: GeminiModelId;
    if (model === undefined || model === null || model === '') {
      chosenModel = resolveDefaultModel();
    } else if (isValidGeminiModel(model)) {
      chosenModel = model;
    } else {
      return res.status(400).json({
        error: `model "${String(model)}" is not supported. Allowed: ${GEMINI_MODELS.map((m) => m.id).join(', ')}.`,
      });
    }

    const cleanPrompt = prompt.trim();
    let feedback: AiFeedback;
    let source: FeedbackSource;

    if (isGeminiEnabled()) {
      try {
        feedback = await analyzeWritingWithGemini({
          mode,
          prompt: cleanPrompt,
          userWriting,
          model: chosenModel,
        });
        source = 'gemini';
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[analyze] Gemini failed:', message);
        if (process.env.USE_MOCK_ON_GEMINI_ERROR === 'true') {
          feedback = generateMockFeedback({ mode, prompt: cleanPrompt, userWriting });
          source = 'mock';
        } else {
          return res.status(502).json({
            error: `Gemini analysis failed: ${message}. Set USE_MOCK_ON_GEMINI_ERROR=true in .env to fall back to mock feedback.`,
          });
        }
      }
    } else {
      feedback = generateMockFeedback({ mode, prompt: cleanPrompt, userWriting });
      source = 'mock';
    }

    const attempt: WritingAttempt = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      mode,
      prompt: cleanPrompt,
      userWriting,
      feedback,
    };

    await appendAttempt(attempt);
    res.json({ attempt, source, model: chosenModel });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/history/:id', async (req, res, next) => {
  try {
    const removed = await deleteAttempt(req.params.id);
    if (!removed) {
      return res
        .status(404)
        .json({ error: `Attempt with id "${req.params.id}" was not found.` });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.get('/api/chunks', async (req, res, next) => {
  try {
    const topic = parseTopic(req.query.topic);
    const difficulty = parseDifficulty(req.query.difficulty);
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const chunks = await getAllChunks({ topic, difficulty, search });
    res.json({ chunks });
  } catch (err) {
    next(err);
  }
});

app.get('/api/chunks/random', async (req, res, next) => {
  try {
    const topic = parseTopic(req.query.topic);
    const difficulty = parseDifficulty(req.query.difficulty);
    const chunk = await getRandomChunk({ topic, difficulty });
    if (!chunk) {
      return res
        .status(404)
        .json({ error: 'No chunks match the given filters.' });
    }
    res.json({ chunk });
  } catch (err) {
    next(err);
  }
});

app.post('/api/chunks', async (req, res, next) => {
  try {
    const validation = validateChunkDraft(req.body);
    if (!validation.ok) {
      return res.status(400).json({ error: chunkValidationMessage(validation.error) });
    }
    const result = await addManualChunk(validation.draft);
    if (!result.ok) {
      return res
        .status(409)
        .json({ error: `A chunk with the text "${validation.draft.text}" already exists.` });
    }
    res.json({ chunk: result.chunk });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/chunks/:id', async (req, res, next) => {
  try {
    const removed = await removeChunk(req.params.id);
    if (!removed) {
      return res
        .status(404)
        .json({ error: `Chunk with id "${req.params.id}" was not found.` });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.post('/api/chunks/generate', async (req, res, next) => {
  try {
    const validation = validateGenerateRequest(req.body);
    if (!validation.ok) {
      return res.status(400).json({ error: generateValidationMessage(validation.error) });
    }

    const rawModel = req.body?.model;
    let chosenModel: GeminiModelId;
    if (rawModel === undefined || rawModel === null || rawModel === '') {
      chosenModel = resolveDefaultModel();
    } else if (isValidGeminiModel(rawModel)) {
      chosenModel = rawModel;
    } else {
      return res.status(400).json({
        error: `model "${String(rawModel)}" is not supported. Allowed: ${GEMINI_MODELS.map((m) => m.id).join(', ')}.`,
      });
    }

    try {
      const result = await generateChunks({ ...validation.draft, model: chosenModel });
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[chunks/generate] failed:', message);
      return res.status(502).json({
        error: `Chunk generation failed: ${message}. Set USE_MOCK_ON_GEMINI_ERROR=true in .env to fall back to mock generation.`,
      });
    }
  } catch (err) {
    next(err);
  }
});

app.patch('/api/history/:attemptId/patterns/:patternIndex/favorite', async (req, res, next) => {
  try {
    const { attemptId, patternIndex } = req.params;
    const idx = Number(patternIndex);
    if (!Number.isInteger(idx) || idx < 0) {
      return res.status(400).json({ error: 'patternIndex must be a non-negative integer.' });
    }
    const favorite = req.body?.favorite;
    if (typeof favorite !== 'boolean') {
      return res.status(400).json({ error: 'favorite must be a boolean.' });
    }
    const result = await setPatternFavorite(attemptId, idx, favorite);
    if (!result.ok) {
      const status = result.reason === 'attempt_not_found' ? 404 : 404;
      const msg =
        result.reason === 'attempt_not_found'
          ? `Attempt with id "${attemptId}" was not found.`
          : `Pattern index ${idx} is out of range for this attempt.`;
      return res.status(status).json({ error: msg });
    }
    res.json({ ok: true, attempt: result.attempt });
  } catch (err) {
    next(err);
  }
});

function chunkValidationMessage(
  err:
    | 'text_required'
    | 'meaning_required'
    | 'example_required'
    | 'topic_invalid'
    | 'difficulty_invalid',
): string {
  switch (err) {
    case 'text_required':
      return 'text is required.';
    case 'meaning_required':
      return 'meaningVi is required.';
    case 'example_required':
      return 'example is required.';
    case 'topic_invalid':
      return 'topic must be one of meeting, office, travel, customer_service, shopping, hr, finance, business, general.';
    case 'difficulty_invalid':
      return 'difficulty must be one of easy, medium, hard.';
  }
}

function generateValidationMessage(
  err: 'topic_invalid' | 'difficulty_invalid' | 'count_invalid',
): string {
  switch (err) {
    case 'topic_invalid':
      return 'topic must be one of meeting, office, travel, customer_service, shopping, hr, finance, business, general.';
    case 'difficulty_invalid':
      return 'difficulty must be one of easy, medium, hard.';
    case 'count_invalid':
      return 'count must be a number between 1 and 20.';
  }
}

function parseTopic(value: unknown): ChunkTopic | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  return VALID_TOPICS.includes(value as ChunkTopic) ? (value as ChunkTopic) : undefined;
}

function parseDifficulty(value: unknown): ChunkDifficulty | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  return VALID_DIFFICULTIES.includes(value as ChunkDifficulty)
    ? (value as ChunkDifficulty)
    : undefined;
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : 'Unknown server error';
  console.error('[server error]', err);
  res.status(500).json({ error: message });
});

ensureStoreFiles()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[server] listening on http://localhost:${PORT}`);
      console.log(`[server] Gemini ${isGeminiEnabled() ? 'enabled' : 'disabled (using mock feedback)'}`);
      console.log(`[server] default model: ${resolveDefaultModel()}`);
    });
  })
  .catch((err) => {
    console.error('[server] failed to initialize store:', err);
    process.exit(1);
  });
