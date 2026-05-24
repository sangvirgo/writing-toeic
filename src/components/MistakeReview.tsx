import { useMemo, useState } from 'react';
import type { MistakeType, PracticeMode, WritingAttempt } from '../types';

export interface MistakeEntry {
  attemptId: string;
  attemptCreatedAt: string;
  attemptMode: PracticeMode;
  attemptPrompt: string;
  indexInAttempt: number;
  type: MistakeType;
  original: string;
  correction: string;
  explanation: string;
}

type TypeFilter = 'all' | MistakeType;

interface Props {
  attempts: WritingAttempt[];
  onPractice: (mistake: MistakeEntry) => void;
}

const MODE_LABEL: Record<PracticeMode, string> = {
  toeic_chunk: 'TOEIC Chunk Practice',
  daily_journal: 'Daily Journal',
  mistake_review: 'Mistake Review',
  ielts_sentence: 'IELTS Sentence',
  ielts_paragraph: 'IELTS Paragraph',
};

export function MistakeReview({ attempts, onPractice }: Props) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [search, setSearch] = useState('');

  const allMistakes = useMemo<MistakeEntry[]>(() => {
    const collected: MistakeEntry[] = [];
    for (const a of attempts) {
      a.feedback.mistakes.forEach((m, idx) => {
        collected.push({
          attemptId: a.id,
          attemptCreatedAt: a.createdAt,
          attemptMode: a.mode,
          attemptPrompt: a.prompt,
          indexInAttempt: idx,
          type: m.type,
          original: m.original,
          correction: m.correction,
          explanation: m.explanation,
        });
      });
    }
    return collected.sort((a, b) => (a.attemptCreatedAt < b.attemptCreatedAt ? 1 : -1));
  }, [attempts]);

  const counts = useMemo(() => {
    const c = { total: allMistakes.length, grammar: 0, vocabulary: 0, naturalness: 0, structure: 0 };
    for (const m of allMistakes) c[m.type]++;
    return c;
  }, [allMistakes]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return allMistakes.filter((m) => {
      if (typeFilter !== 'all' && m.type !== typeFilter) return false;
      if (!needle) return true;
      return (
        m.original.toLowerCase().includes(needle) ||
        m.correction.toLowerCase().includes(needle) ||
        m.explanation.toLowerCase().includes(needle) ||
        m.attemptPrompt.toLowerCase().includes(needle)
      );
    });
  }, [allMistakes, typeFilter, search]);

  return (
    <section className="panel mistake-review-panel">
      <div className="history-header">
        <h2>Mistake Review</h2>
        <div className="history-controls">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          >
            <option value="all">All</option>
            <option value="grammar">Grammar</option>
            <option value="vocabulary">Vocabulary</option>
            <option value="naturalness">Naturalness</option>
            <option value="structure">Structure</option>
          </select>
          <input
            type="search"
            placeholder="Search original, correction, explanation, prompt…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="mistake-summary">
        <SummaryChip label="Total" value={counts.total} />
        <SummaryChip label="Grammar" value={counts.grammar} type="grammar" />
        <SummaryChip label="Vocabulary" value={counts.vocabulary} type="vocabulary" />
        <SummaryChip label="Naturalness" value={counts.naturalness} type="naturalness" />
        <SummaryChip label="Structure" value={counts.structure} type="structure" />
      </div>

      {filtered.length === 0 ? (
        <p className="muted">
          {allMistakes.length === 0
            ? 'No mistakes yet. They will appear here after you analyze some writing.'
            : 'No mistakes match the current filter.'}
        </p>
      ) : (
        <ul className="mistake-review-list">
          {filtered.map((m) => (
            <li
              key={`${m.attemptId}_${m.indexInAttempt}`}
              className="mistake-review-card"
            >
              <div className="mistake-review-head">
                <span className={`tag tag-${m.type}`}>{m.type}</span>
                <span className="muted">
                  From: {MODE_LABEL[m.attemptMode]} · {m.attemptPrompt} ·{' '}
                  {new Date(m.attemptCreatedAt).toLocaleDateString()}
                </span>
              </div>
              <div className="history-row"><strong>Original:</strong> {m.original}</div>
              <div className="history-row"><strong>Correction:</strong> {m.correction}</div>
              <div className="history-row"><strong>Explanation:</strong> {m.explanation}</div>
              <button
                type="button"
                className="btn primary small practice-btn"
                onClick={() => onPractice(m)}
              >
                Practice this mistake
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SummaryChip({
  label,
  value,
  type,
}: {
  label: string;
  value: number;
  type?: MistakeType;
}) {
  return (
    <div className={`summary-chip${type ? ` chip-${type}` : ''}`}>
      <div className="summary-chip-label">{label}</div>
      <div className="summary-chip-value">{value}</div>
    </div>
  );
}

export function buildMistakeTaskPrompt(m: MistakeEntry): string {
  return [
    'Target correction:',
    m.correction,
    '',
    'Your task:',
    'Write 2–3 new sentences using the corrected pattern naturally.',
    '',
    'Original mistake:',
    m.original,
    '',
    'Explanation:',
    m.explanation,
  ].join('\n');
}
