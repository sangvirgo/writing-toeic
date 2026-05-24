# English Writing Trainer

A small local app to practice English writing for Vietnamese learners — TOEIC chunks, workplace vocabulary, and daily journaling. All writing history and chunk data are saved as **real JSON files** in this project, never in your browser.

## What it does

- **TOEIC Chunk Practice** — pull a random chunk from `store/toeic-chunks.json` (text, Vietnamese meaning, topic, difficulty, example), write 2–3 sentences using it.
- **Daily Journal** — pick a prompt and write a short journal entry in English.
- **AI feedback** — corrected version, more natural rewrite, scores (grammar / vocabulary / naturalness), mistakes with explanations, useful patterns, and Anki cards. Powered by **Gemini** when `GEMINI_API_KEY` is set; otherwise falls back to a local **mock**.
- **Mistake Review** — every mistake from past attempts shows up in one list, with a "Practice this mistake" shortcut.
- **Chunk Manager** — add manual chunks, delete chunks, or generate fresh chunks with Gemini (with a mock fallback when no API key).
- **Learning Stats** — totals, mistakes by type, average scores, chunk counts, current/best daily streak, and favorite patterns.
- **History review** — filter by mode, search across prompt / writing / corrected version / mistakes, mark useful patterns as favorites, delete individual attempts.

## Tech stack

- Vite + React + TypeScript (frontend)
- Node.js + Express (local server, port 3001)
- JSON files as storage:
  - `store/writing-history.json` — saved attempts
  - `store/toeic-chunks.json` — TOEIC/workplace chunks
- Gemini REST API, called only from the server
- No database, no auth, no cloud sync, no `localStorage` / `IndexedDB`

## Install

```bash
npm install
```

## Run

```bash
npm run dev
```

This starts:
- Express API on **http://localhost:3001**
- Vite dev server on **http://localhost:5173** (proxies `/api/*` to the server)

Open http://localhost:5173.

## Where data is saved

| File | What it holds |
| --- | --- |
| `store/writing-history.json` | Every attempt with its feedback |
| `store/toeic-chunks.json` | The chunk pool (80+ seed chunks across 9 topics) |

The server reads/writes these files on every analyze/delete. Nothing is stored in the browser.

## Enable Gemini (Phase 2)

1. Copy `.env.example` to `.env`.
2. Set `GEMINI_API_KEY=your_real_key`.
3. (Recommended) set `USE_MOCK_ON_GEMINI_ERROR=true` so the server falls back to mock feedback when a Gemini call fails (quota, network blip, suspended key). With `false`, the UI surfaces an error instead.
4. (Optional) set `GEMINI_MODEL` to a model id from the allowlist below. Default is `gemini-3-flash-preview`. If `GEMINI_MODEL` is set to a value not in the allowlist, the server logs a warning and falls back to the default.
5. Restart `npm run dev`.

When Gemini is on and the call succeeds, `/api/analyze` returns `"source": "gemini"`; without a key or after a fallback it returns `"source": "mock"`. The UI shows a small badge plus the model id so you always know what produced the feedback.

The API key is read from `process.env.GEMINI_API_KEY` **only inside the server**. The React frontend never sees it — only the model id is sent in the request body.

### Choosing the Gemini model from the UI

A model dropdown at the top of the app lets you switch between supported Gemini models for every Gemini-backed call (analyze writing, generate chunks). The selection is held in React state and sent as `model` in the request body — there is no server-side per-user persistence.

Allowed model ids (set in `server/types.ts` → `GEMINI_MODELS`):

| ID | Label | Note |
| --- | --- | --- |
| `gemini-3-flash-preview` | Gemini 3 Flash Preview | Primary / default |
| `gemini-3.5-flash` | Gemini 3.5 Flash | |
| `gemini-3.1-flash-lite` | Gemini 3.1 Flash Lite | |
| `gemini-2.5-flash` | Gemini 2.5 Flash | |
| `gemini-2.0-flash` | Gemini 2.0 Flash | |

If you POST `/api/analyze` or `/api/chunks/generate` with a `model` value outside this list, the server returns 400 with the allowed list.

### When a model has no quota

Gemini quotas are per-project per-model. If you see HTTP 429 with `Quota exceeded for metric: ... generate_content_free_tier_input_token_count, limit: 0`, it means the project tied to your key has no free-tier allocation for that specific model.

What to try, in order:
1. Pick a different model from the UI dropdown — quotas differ per model.
2. Check https://ai.google.dev/gemini-api/docs/rate-limits and the linked AI Studio page to confirm which models your project can use.
3. Make sure `USE_MOCK_ON_GEMINI_ERROR=true` so the app keeps working via mock while you sort out quotas.

## How the frontend talks to the server

- Vite proxies `/api/*` → `http://localhost:3001` (see `vite.config.ts`).
- `src/api/client.ts` calls `fetch('/api/...')` — no hardcoded host.
- All write paths go through the server, which is the only thing that touches `store/*.json` and the only thing that talks to Gemini.

## How the server saves the JSON file

1. `server/store.ts` makes sure `store/` and both JSON files exist (it auto-creates empty ones if missing).
2. On `POST /api/analyze` the server validates the request, calls Gemini (or mock), builds a `WritingAttempt`, reads `writing-history.json`, appends the attempt, updates `updatedAt`, and writes the file back with 2-space indentation.
3. On `DELETE /api/history/:id` it filters out the matching id and rewrites the file.
4. Corrupted JSON is reported with a clear error instead of silently crashing.

## API endpoints

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/health` | `{ ok, geminiEnabled, defaultModel }` |
| GET | `/api/models` | `{ defaultModel, models: [{ id, label, note? }], geminiEnabled }` — drives the UI dropdown |
| GET | `/api/history` | full history DB |
| POST | `/api/analyze` | body: `{ mode, prompt, userWriting, model? }` → `{ attempt, source, model }`. `model` is optional and defaults to `defaultModel`; an invalid model returns 400. |
| DELETE | `/api/history/:id` | 404 if not found |
| PATCH | `/api/history/:attemptId/patterns/:patternIndex/favorite` | body: `{ favorite: boolean }` → toggles a useful-pattern favorite flag inside the saved attempt |
| GET | `/api/chunks?topic=&difficulty=&search=` | filtered list |
| GET | `/api/chunks/random?topic=&difficulty=` | one random chunk |
| POST | `/api/chunks` | body: `{ text, meaningVi, topic, difficulty, example, tags[] }` → adds a manual chunk (`source: "manual"`) |
| DELETE | `/api/chunks/:id` | 404 if not found |
| POST | `/api/chunks/generate` | body: `{ topic, difficulty, count, model? }` → `{ created, skippedDuplicates, source, model }`. Calls Gemini with mock fallback (when `USE_MOCK_ON_GEMINI_ERROR=true`). |

## Manual test

1. `npm install`, then `npm run dev`.
2. Open http://localhost:5173.
3. Click **Generate Chunk**.
4. Write: `i just have reached an agreement with 3 customers`.
5. Click **Analyze Writing**. Feedback appears with a **Gemini** or **Mock** badge.
6. Open `store/writing-history.json` — your attempt is in the file.
7. Switch to **Daily Journal**, write a short entry, click **Analyze Journal**. Another attempt appears in the file.
8. Click **Delete** on a history card and confirm — the file shrinks by one entry.

## What to commit, what not to commit

Commit:
- All source files (`src/`, `server/`, `vite.config.ts`, `tsconfig.json`, `package.json`, etc.)
- `store/toeic-chunks.json`
- `store/writing-history.json` (only if the repo is private — see warning below)
- `.env.example`
- `README.md`

Do NOT commit:
- `.env` (your real Gemini key)
- `node_modules/`, `dist/`
- `.codegraph/`

## Privacy warning

`store/writing-history.json` contains your personal/journal writing. The `.gitignore` does **not** ignore it (you asked to keep it tracked). **If you push this repo to GitHub, make it private.** Same for `store/toeic-chunks.json` if you ever add company-specific phrasing.

## Before committing — pre-commit checklist

Don't `git add .` casually. Look at the diff first:

```bash
git status
git diff --stat
git diff store/writing-history.json
git diff store/toeic-chunks.json
```

Make sure:
- No `.env` is staged.
- The history file doesn't contain anything you don't want pushed.
- Only the chunks/files you meant to change appear in the diff.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Run frontend + server together |
| `npm run dev:client` | Vite only |
| `npm run dev:server` | Express only (`tsx watch`) |
| `npm run build` | Type-check and build the frontend |
| `npm run preview` | Preview the built frontend |

## Project layout

```
english-writing-trainer/
├─ server/
│  ├─ index.ts          # Express routes, validation, Gemini-first + mock fallback
│  ├─ store.ts          # fs/promises read/write for both JSON files
│  ├─ chunkService.ts   # filter + random pick for chunks
│  ├─ mockAi.ts         # local mock feedback
│  ├─ gemini.ts         # real Gemini REST call (server-only)
│  └─ types.ts
├─ src/
│  ├─ App.tsx
│  ├─ main.tsx
│  ├─ types.ts
│  ├─ index.css
│  ├─ api/client.ts
│  ├─ components/
│  │  ├─ PracticePanel.tsx
│  │  ├─ FeedbackResult.tsx
│  │  ├─ HistoryList.tsx
│  │  ├─ MistakeReview.tsx
│  │  ├─ ChunkManager.tsx
│  │  └─ LearningStats.tsx
│  └─ data/journalPrompts.ts
├─ store/
│  ├─ writing-history.json
│  └─ toeic-chunks.json
├─ .env.example
├─ .gitignore
├─ index.html
├─ package.json
├─ tsconfig.json
└─ vite.config.ts
```

## Phase 4 + 5 features

- **Chunk Manager** (in-app) — list, filter (topic/difficulty/search), add a manual chunk, delete, and generate new chunks with Gemini. Manual entries are persisted with `source: "manual"`, AI-generated ones with `source: "ai"`. Duplicate chunk text is detected case-insensitively and skipped.
- **Mock fallback for chunk generation** — when `GEMINI_API_KEY` is missing the server returns deterministic mock chunks per topic; when Gemini fails the server returns mock chunks only if `USE_MOCK_ON_GEMINI_ERROR=true`, otherwise a clear 502 error is returned and nothing is partially saved.
- **Learning Stats + Streak** — totals, mistakes by type, average scores, chunk counts, and current/best daily streak. Stats are computed in the frontend from existing `writing-history.json` + `toeic-chunks.json` data — no extra storage.
- **Favorite useful patterns** — click `Favorite` next to a useful pattern in Feedback or History. The server stamps `favorite: true` onto that pattern inside `writing-history.json` via `PATCH /api/history/:attemptId/patterns/:patternIndex/favorite`. The Favorite Patterns section in Learning Stats lists every favorited pattern, with the source attempt and date.
