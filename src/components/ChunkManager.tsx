import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createChunk,
  deleteChunk,
  generateChunks,
  getChunks,
} from '../api/client';
import type {
  ChunkDifficulty,
  ChunkTopic,
  FeedbackSource,
  GeminiModelId,
  ToeicChunk,
} from '../types';

const TOPICS: ChunkTopic[] = [
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
const DIFFICULTIES: ChunkDifficulty[] = ['easy', 'medium', 'hard'];

type TopicFilter = 'all' | ChunkTopic;
type DifficultyFilter = 'all' | ChunkDifficulty;

interface AddFormState {
  text: string;
  meaningVi: string;
  topic: ChunkTopic;
  difficulty: ChunkDifficulty;
  example: string;
  tags: string;
}

const EMPTY_ADD_FORM: AddFormState = {
  text: '',
  meaningVi: '',
  topic: 'meeting',
  difficulty: 'easy',
  example: '',
  tags: '',
};

interface GenerateFormState {
  topic: ChunkTopic;
  difficulty: ChunkDifficulty;
  count: number;
}

const EMPTY_GENERATE_FORM: GenerateFormState = {
  topic: 'meeting',
  difficulty: 'easy',
  count: 5,
};

export function ChunkManager({ model }: { model: GeminiModelId | null }) {
  const [chunks, setChunks] = useState<ToeicChunk[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [topicFilter, setTopicFilter] = useState<TopicFilter>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('all');
  const [search, setSearch] = useState('');

  const [addForm, setAddForm] = useState<AddFormState>(EMPTY_ADD_FORM);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [generateForm, setGenerateForm] = useState<GenerateFormState>(EMPTY_GENERATE_FORM);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateInfo, setGenerateInfo] = useState<
    | { created: number; skipped: number; source: FeedbackSource; model: GeminiModelId }
    | null
  >(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await getChunks();
      setChunks(list);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load chunks.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return chunks.filter((c) => {
      if (topicFilter !== 'all' && c.topic !== topicFilter) return false;
      if (difficultyFilter !== 'all' && c.difficulty !== difficultyFilter) return false;
      if (!needle) return true;
      const hay = `${c.text} ${c.meaningVi} ${c.example} ${c.tags.join(' ')}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [chunks, topicFilter, difficultyFilter, search]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    setIsAdding(true);
    try {
      const tags = addForm.tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      await createChunk({
        text: addForm.text.trim(),
        meaningVi: addForm.meaningVi.trim(),
        topic: addForm.topic,
        difficulty: addForm.difficulty,
        example: addForm.example.trim(),
        tags,
      });
      setAddForm(EMPTY_ADD_FORM);
      await reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add chunk.';
      setAddError(message);
    } finally {
      setIsAdding(false);
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerateError(null);
    setGenerateInfo(null);
    setIsGenerating(true);
    try {
      const result = await generateChunks({
        ...generateForm,
        ...(model ? { model } : {}),
      });
      setGenerateInfo({
        created: result.created.length,
        skipped: result.skippedDuplicates.length,
        source: result.source,
        model: result.model,
      });
      await reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate chunks.';
      setGenerateError(message);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleDelete(id: string) {
    if (deletingId) return;
    if (!window.confirm('Delete this chunk?')) return;
    setDeletingId(id);
    try {
      await deleteChunk(id);
      await reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete chunk.';
      window.alert(message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="panel chunk-manager-panel">
      <h2>Chunk Manager</h2>

      <p className="muted">Total chunks: {chunks.length}</p>

      <div className="chunk-controls">
        <select
          value={topicFilter}
          onChange={(e) => setTopicFilter(e.target.value as TopicFilter)}
        >
          <option value="all">All topics</option>
          {TOPICS.map((t) => (
            <option key={t} value={t}>
              {t.replace('_', ' ')}
            </option>
          ))}
        </select>
        <select
          value={difficultyFilter}
          onChange={(e) => setDifficultyFilter(e.target.value as DifficultyFilter)}
        >
          <option value="all">All difficulties</option>
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <input
          type="search"
          placeholder="Search text, meaning, example, tags…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="chunk-forms">
        <form className="chunk-form" onSubmit={handleAdd}>
          <h3>Add Chunk</h3>
          <input
            type="text"
            placeholder="Chunk text (e.g. set up a meeting)"
            value={addForm.text}
            onChange={(e) => setAddForm({ ...addForm, text: e.target.value })}
            required
          />
          <input
            type="text"
            placeholder="Vietnamese meaning"
            value={addForm.meaningVi}
            onChange={(e) => setAddForm({ ...addForm, meaningVi: e.target.value })}
            required
          />
          <div className="chunk-form-row">
            <select
              value={addForm.topic}
              onChange={(e) =>
                setAddForm({ ...addForm, topic: e.target.value as ChunkTopic })
              }
            >
              {TOPICS.map((t) => (
                <option key={t} value={t}>
                  {t.replace('_', ' ')}
                </option>
              ))}
            </select>
            <select
              value={addForm.difficulty}
              onChange={(e) =>
                setAddForm({ ...addForm, difficulty: e.target.value as ChunkDifficulty })
              }
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <input
            type="text"
            placeholder="Example sentence"
            value={addForm.example}
            onChange={(e) => setAddForm({ ...addForm, example: e.target.value })}
            required
          />
          <input
            type="text"
            placeholder="Tags (comma-separated)"
            value={addForm.tags}
            onChange={(e) => setAddForm({ ...addForm, tags: e.target.value })}
          />
          {addError && <p className="error-text">{addError}</p>}
          <button type="submit" className="btn primary" disabled={isAdding}>
            {isAdding ? 'Adding…' : 'Add Chunk'}
          </button>
        </form>

        <form className="chunk-form" onSubmit={handleGenerate}>
          <h3>Generate Chunks with Gemini</h3>
          <div className="chunk-form-row">
            <select
              value={generateForm.topic}
              onChange={(e) =>
                setGenerateForm({ ...generateForm, topic: e.target.value as ChunkTopic })
              }
            >
              {TOPICS.map((t) => (
                <option key={t} value={t}>
                  {t.replace('_', ' ')}
                </option>
              ))}
            </select>
            <select
              value={generateForm.difficulty}
              onChange={(e) =>
                setGenerateForm({
                  ...generateForm,
                  difficulty: e.target.value as ChunkDifficulty,
                })
              }
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              max={20}
              value={generateForm.count}
              onChange={(e) =>
                setGenerateForm({
                  ...generateForm,
                  count: Number(e.target.value) || 1,
                })
              }
            />
          </div>
          {generateError && <p className="error-text">{generateError}</p>}
          {generateInfo && (
            <p className="muted">
              Added {generateInfo.created} chunk{generateInfo.created === 1 ? '' : 's'} ·
              skipped {generateInfo.skipped} duplicate
              {generateInfo.skipped === 1 ? '' : 's'} · source:{' '}
              <span className={`source-badge source-${generateInfo.source}`}>
                {generateInfo.source === 'gemini' ? 'Gemini' : 'Mock'}
              </span>{' '}
              · model: <code>{generateInfo.model}</code>
            </p>
          )}
          <button type="submit" className="btn primary" disabled={isGenerating}>
            {isGenerating ? 'Generating…' : 'Generate Chunks with Gemini'}
          </button>
        </form>
      </div>

      {isLoading && <p className="muted">Loading chunks…</p>}

      {!isLoading && filtered.length === 0 && (
        <p className="muted">No chunks match the current filter.</p>
      )}

      <ul className="chunk-list">
        {filtered.map((c) => (
          <li key={c.id} className="chunk-card">
            <div className="chunk-card-head">
              <strong>{c.text}</strong>
              <div className="chunk-card-tags">
                <span className={`tag tag-${c.difficulty}`}>{c.difficulty}</span>
                <span className={`tag tag-${c.topic}`}>{c.topic.replace('_', ' ')}</span>
                <span className={`source-badge source-${c.source}`}>{c.source}</span>
              </div>
            </div>
            <div className="chunk-card-row">VI: {c.meaningVi}</div>
            <div className="chunk-card-row muted">e.g. {c.example}</div>
            {c.tags.length > 0 && (
              <div className="chunk-card-row chunk-tags-row">
                {c.tags.map((t) => (
                  <span key={t} className="chunk-tag-pill">
                    #{t}
                  </span>
                ))}
              </div>
            )}
            <button
              type="button"
              className="btn danger small"
              onClick={() => handleDelete(c.id)}
              disabled={deletingId === c.id}
            >
              {deletingId === c.id ? 'Deleting…' : 'Delete'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
