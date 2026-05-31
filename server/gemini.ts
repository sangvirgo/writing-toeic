import {
  AiFeedback,
  ChunkDifficulty,
  ChunkTopic,
  DEFAULT_GEMINI_MODEL,
  GeminiModelId,
  isValidGeminiModel,
  MistakeType,
  PracticeMode,
} from './types.js';

// Real Gemini call from the server only.
// The API key is read from process.env.GEMINI_API_KEY and must never reach the frontend.
//
// We hit the REST endpoint directly so there is no extra SDK dependency:
//   https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent?key=...

const GEMINI_ENDPOINT = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

/**
 * Returns the env-configured default model if it is in the allowlist;
 * otherwise falls back to DEFAULT_GEMINI_MODEL and logs a one-time warning.
 */
let warnedAboutInvalidEnvModel = false;
export function resolveDefaultModel(): GeminiModelId {
  const fromEnv = process.env.GEMINI_MODEL;
  if (!fromEnv) return DEFAULT_GEMINI_MODEL;
  if (isValidGeminiModel(fromEnv)) return fromEnv;
  if (!warnedAboutInvalidEnvModel) {
    console.warn(
      `[gemini] GEMINI_MODEL="${fromEnv}" is not in the allowlist; using default "${DEFAULT_GEMINI_MODEL}".`,
    );
    warnedAboutInvalidEnvModel = true;
  }
  return DEFAULT_GEMINI_MODEL;
}

interface GeminiInput {
  mode: PracticeMode;
  prompt: string;
  userWriting: string;
  model: GeminiModelId;
}

export function isGeminiEnabled(): boolean {
  return typeof process.env.GEMINI_API_KEY === 'string' && process.env.GEMINI_API_KEY.length > 0;
}

export async function analyzeWritingWithGemini(
  input: GeminiInput,
  apiKeyOverride?: string,
): Promise<AiFeedback> {
  const apiKey = apiKeyOverride || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set.');
  }

  console.log(`[gemini] analyze mode=${input.mode} model=${input.model}`);

  const userPrompt = buildUserPrompt(input);
  const systemInstruction = buildSystemInstruction();

  const body = {
    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      topP: 0.9,
      responseMimeType: 'application/json',
    },
  };

  const url = `${GEMINI_ENDPOINT(input.model)}?key=${encodeURIComponent(apiKey)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Gemini network error: ${message}`);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini returned HTTP ${res.status}: ${errText.slice(0, 500)}`);
  }

  const payload = (await res.json()) as GeminiResponse;
  const text = extractText(payload);
  if (!text) {
    throw new Error('Gemini response did not contain any text.');
  }

  const parsed = safeParseJson(text);
  return validateFeedback(parsed);
}

interface GeminiResponse {
  candidates?: {
    content?: {
      parts?: { text?: string }[];
    };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
}

function extractText(payload: GeminiResponse): string {
  if (payload.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked the request: ${payload.promptFeedback.blockReason}`);
  }
  const parts = payload.candidates?.[0]?.content?.parts;
  if (!parts || parts.length === 0) return '';
  return parts
    .map((p) => p.text ?? '')
    .join('')
    .trim();
}

function safeParseJson(text: string): unknown {
  let cleaned = text.trim();
  // Strip ```json ... ``` fences if Gemini still includes them despite responseMimeType.
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  }
  // Sometimes the model returns prose before/after the JSON; extract first {...} block.
  if (!cleaned.startsWith('{')) {
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first >= 0 && last > first) {
      cleaned = cleaned.slice(first, last + 1);
    }
  }
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse Gemini JSON: ${message}`);
  }
}

const MISTAKE_TYPES: MistakeType[] = ['grammar', 'vocabulary', 'naturalness', 'structure'];

function clampScore(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(10, Math.round(v)));
}

function clampIeltsBand(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round(Math.max(0, Math.min(9, v)) * 10) / 10;
}

function validateFeedback(raw: unknown): AiFeedback {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Gemini JSON is not an object.');
  }
  const o = raw as Record<string, unknown>;
  const score = (o.score ?? {}) as Record<string, unknown>;
  const mistakes = Array.isArray(o.mistakes) ? o.mistakes : [];
  const usefulPatterns = Array.isArray(o.usefulPatterns) ? o.usefulPatterns : [];
  const ankiCards = Array.isArray(o.ankiCards) ? o.ankiCards : [];

  const feedback: AiFeedback = {
    correctedVersion: typeof o.correctedVersion === 'string' ? o.correctedVersion : '',
    naturalVersion: typeof o.naturalVersion === 'string' ? o.naturalVersion : '',
    score: {
      grammar: clampScore(score.grammar),
      vocabulary: clampScore(score.vocabulary),
      naturalness: clampScore(score.naturalness),
    },
    mistakes: mistakes.map((m) => {
      const obj = (m ?? {}) as Record<string, unknown>;
      const type = typeof obj.type === 'string' && MISTAKE_TYPES.includes(obj.type as MistakeType)
        ? (obj.type as MistakeType)
        : 'grammar';
      return {
        type,
        original: typeof obj.original === 'string' ? obj.original : '',
        correction: typeof obj.correction === 'string' ? obj.correction : '',
        explanation: typeof obj.explanation === 'string' ? obj.explanation : '',
      };
    }),
    usefulPatterns: usefulPatterns.map((p) => {
      const obj = (p ?? {}) as Record<string, unknown>;
      return {
        pattern: typeof obj.pattern === 'string' ? obj.pattern : '',
        example: typeof obj.example === 'string' ? obj.example : '',
      };
    }),
    ankiCards: ankiCards.map((c) => {
      const obj = (c ?? {}) as Record<string, unknown>;
      return {
        front: typeof obj.front === 'string' ? obj.front : '',
        back: typeof obj.back === 'string' ? obj.back : '',
      };
    }),
  };

  if (!feedback.correctedVersion || !feedback.naturalVersion) {
    throw new Error('Gemini JSON is missing correctedVersion or naturalVersion.');
  }

  if (o.ielts && typeof o.ielts === 'object') {
    const raw = o.ielts as Record<string, unknown>;
    const ielts: AiFeedback['ielts'] = {
      estimatedBand: clampIeltsBand(raw.estimatedBand),
      taskResponse: clampIeltsBand(raw.taskResponse),
      coherenceCohesion: clampIeltsBand(raw.coherenceCohesion),
      lexicalResource: clampIeltsBand(raw.lexicalResource),
      grammaticalRangeAccuracy: clampIeltsBand(raw.grammaticalRangeAccuracy),
      mainAdvice: Array.isArray(raw.mainAdvice)
        ? raw.mainAdvice.filter((s) => typeof s === 'string')
        : undefined,
    };
    feedback.ielts = ielts;
  }

  return feedback;
}

function buildSystemInstruction(): string {
  return [
    'You are an English writing coach for a Vietnamese learner.',
    'Always respond with a single JSON object that exactly matches the schema the user describes.',
    'Rules:',
    '- Keep corrections natural and practical.',
    '- Do not overcorrect into overly literary or advanced English.',
    '- Preserve the user\'s intended meaning.',
    '- Explanations must be short, clear, and helpful for an intermediate Vietnamese learner. You may include short Vietnamese hints in parentheses when useful.',
    '- All score fields are integers from 0 to 10.',
    '- mistake.type must be one of: grammar, vocabulary, naturalness, structure.',
    '- For IELTS modes, also include the optional "ielts" object when requested.',
    '- IELTS band scores must be between 0 and 9 (one decimal place allowed).',
    '- Never include markdown fences, comments, or explanations outside the JSON.',
  ].join('\n');
}

function buildUserPrompt(input: GeminiInput): string {
  const { mode, prompt, userWriting } = input;
  let modeBlock: string;
  if (mode === 'toeic_chunk') {
    modeBlock = [
      'Practice mode: TOEIC chunk practice.',
      `Target chunk/collocation: "${prompt}".`,
      'Check whether the chunk was used correctly and naturally. Suggest a more natural workplace-style sentence.',
    ].join('\n');
  } else if (mode === 'mistake_review') {
    modeBlock = [
      'Practice mode: Mistake review.',
      'The user is re-practicing a past mistake. The task below contains:',
      '  - Target correction (the pattern the user is trying to apply)',
      '  - Original mistake (what they wrote before)',
      '  - Explanation (why the correction is better)',
      '',
      'Task context:',
      '"""',
      prompt,
      '"""',
      '',
      'Focus your feedback on whether the new writing:',
      '  - avoids the previous mistake,',
      '  - applies the target correction pattern naturally,',
      '  - still sounds like simple, realistic workplace English.',
      'Acknowledge improvement when the previous mistake is gone. Keep explanations short and practical.',
    ].join('\n');
  } else if (mode === 'ielts_sentence') {
    modeBlock = [
      'Practice mode: IELTS Sentence Builder (Level 1).',
      `Prompt/task: "${prompt}".`,
      'Your job:',
      '- Correct grammar mistakes.',
      '- Improve naturalness and academic tone.',
      '- Make the sentences more IELTS-appropriate but keep them realistic, not overly advanced.',
      '- Check whether the target pattern was used correctly (if a target pattern is included in the prompt).',
      '- Give useful academic sentence patterns.',
      '- Explain mistakes simply for a Vietnamese learner.',
    ].join('\n');
  } else if (mode === 'ielts_paragraph') {
    modeBlock = [
      'Practice mode: IELTS Paragraph Builder (Level 2).',
      `Prompt/task: "${prompt}".`,
      'Your job — check the paragraph for:',
      '- Topic sentence (clear, relevant)',
      '- Development (explanation, reasoning)',
      '- Example (concrete support)',
      '- Coherence and cohesion (logical flow, linking words)',
      '- Lexical resource (vocabulary range and accuracy)',
      '- Grammatical range and accuracy',
      '- Whether the paragraph answers the prompt',
      '- Whether the paragraph is around 80–120 words (note if it is too short or too long)',
      '',
      'Also include an "ielts" object in the JSON with estimated band scores (0–9) and advice.',
    ].join('\n');
  } else {
    modeBlock = [
      'Practice mode: Daily English journal.',
      `Journal prompt: "${prompt}".`,
      'Correct grammar, make it sound natural and realistic, keep the style simple.',
    ].join('\n');
  }

  const ieltsSchema =
    mode === 'ielts_sentence' || mode === 'ielts_paragraph'
      ? [
          ',',
          '  "ielts": {',
          '    "estimatedBand": 6.5,',
          '    "taskResponse": 6,',
          '    "coherenceCohesion": 7,',
          '    "lexicalResource": 6,',
          '    "grammaticalRangeAccuracy": 6,',
          '    "mainAdvice": ["string"]',
          '  }',
        ].join('\n')
      : '';

  return [
    modeBlock,
    '',
    'User writing:',
    '"""',
    userWriting,
    '"""',
    '',
    'Return JSON in EXACTLY this shape (no extra keys, no markdown):',
    '{',
    '  "correctedVersion": "string",',
    '  "naturalVersion": "string",',
    '  "score": { "grammar": 0, "vocabulary": 0, "naturalness": 0 },',
    '  "mistakes": [',
    '    { "type": "grammar|vocabulary|naturalness|structure", "original": "string", "correction": "string", "explanation": "string" }',
    '  ],',
    '  "usefulPatterns": [ { "pattern": "string", "example": "string" } ],',
    '  "ankiCards": [ { "front": "string", "back": "string" } ]',
    ieltsSchema,
    '}',
  ].join('\n');
}

interface GenerateChunksInput {
  topic: ChunkTopic;
  difficulty: ChunkDifficulty;
  count: number;
  model: GeminiModelId;
}

export async function generateChunksWithGemini(
  input: GenerateChunksInput,
  apiKeyOverride?: string,
): Promise<unknown> {
  const apiKey = apiKeyOverride || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set.');
  }

  console.log(
    `[gemini] generate-chunks topic=${input.topic} difficulty=${input.difficulty} count=${input.count} model=${input.model}`,
  );

  const body = {
    systemInstruction: {
      parts: [{ text: buildChunkSystemInstruction() }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: buildChunkUserPrompt(input) }],
      },
    ],
    generationConfig: {
      temperature: 0.6,
      topP: 0.9,
      responseMimeType: 'application/json',
    },
  };

  const url = `${GEMINI_ENDPOINT(input.model)}?key=${encodeURIComponent(apiKey)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Gemini network error: ${message}`);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini returned HTTP ${res.status}: ${errText.slice(0, 500)}`);
  }

  const payload = (await res.json()) as GeminiResponse;
  const text = extractText(payload);
  if (!text) {
    throw new Error('Gemini response did not contain any text.');
  }
  return safeParseJsonArray(text);
}

function safeParseJsonArray(text: string): unknown {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  }
  if (!cleaned.startsWith('[')) {
    const first = cleaned.indexOf('[');
    const last = cleaned.lastIndexOf(']');
    if (first >= 0 && last > first) {
      cleaned = cleaned.slice(first, last + 1);
    }
  }
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse Gemini JSON array: ${message}`);
  }
}

function buildChunkSystemInstruction(): string {
  return [
    'You generate TOEIC/workplace English chunks for a Vietnamese learner.',
    'Always respond with a single JSON array that matches the schema the user describes.',
    'Rules:',
    '- Prefer useful chunks and collocations, not rare words.',
    '- Keep examples simple and original.',
    '- Vietnamese meaning should sound natural.',
    '- Topic must match the requested topic exactly.',
    '- Difficulty must match the requested difficulty exactly.',
    '- No copyrighted content.',
    '- No markdown.',
    '- No explanation outside JSON.',
  ].join('\n');
}

function buildChunkUserPrompt(input: GenerateChunksInput): string {
  return [
    `Generate ${input.count} TOEIC/workplace English chunks.`,
    `Topic: ${input.topic}`,
    `Difficulty: ${input.difficulty}`,
    '',
    'Return JSON only, no markdown, in EXACTLY this shape:',
    '[',
    '  {',
    '    "text": "string",',
    '    "meaningVi": "string",',
    `    "topic": "${input.topic}",`,
    `    "difficulty": "${input.difficulty}",`,
    '    "example": "string",',
    '    "tags": ["string"]',
    '  }',
    ']',
  ].join('\n');
}
