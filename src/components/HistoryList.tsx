import { useMemo, useState } from 'react';
import type { PracticeMode, WritingAttempt } from '../types';

type Filter = 'all' | PracticeMode;

interface Props {
  attempts: WritingAttempt[];
  onDelete: (id: string) => Promise<void>;
  onToggleFavorite?: (
    attemptId: string,
    patternIndex: number,
    favorite: boolean,
  ) => Promise<void> | void;
  isLoading: boolean;
}

export function HistoryList({ attempts, onDelete, onToggleFavorite, isLoading }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingFavorite, setPendingFavorite] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const byMode = filter === 'all' ? attempts : attempts.filter((a) => a.mode === filter);
    const sorted = [...byMode].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    if (!needle) return sorted;
    return sorted.filter((a) => {
      if (a.prompt.toLowerCase().includes(needle)) return true;
      if (a.userWriting.toLowerCase().includes(needle)) return true;
      if (a.feedback.correctedVersion.toLowerCase().includes(needle)) return true;
      return a.feedback.mistakes.some(
        (m) =>
          m.original.toLowerCase().includes(needle) ||
          m.correction.toLowerCase().includes(needle) ||
          m.explanation.toLowerCase().includes(needle),
      );
    });
  }, [attempts, filter, search]);

  async function handleDelete(id: string) {
    if (deletingId) return;
    if (!window.confirm('Delete this attempt? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="panel history-panel">
      <div className="history-header">
        <h2>History</h2>
        <div className="history-controls">
          <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            <option value="all">All</option>
            <option value="toeic_chunk">TOEIC Chunk</option>
            <option value="daily_journal">Daily Journal</option>
            <option value="mistake_review">Mistake Review</option>
          </select>
          <input
            type="search"
            placeholder="Search prompt, writing, or mistake…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading && <p className="muted">Loading history…</p>}

      {!isLoading && filtered.length === 0 && (
        <p className="muted">No saved attempts match the current filter.</p>
      )}

      <ul className="history-list">
        {filtered.map((a) => (
          <li key={a.id} className="history-card">
            <div className="history-card-head">
              <div>
                <span className={`tag tag-${a.mode}`}>
                  {a.mode === 'toeic_chunk'
                    ? 'TOEIC Chunk'
                    : a.mode === 'daily_journal'
                      ? 'Daily Journal'
                      : 'Mistake Review'}
                </span>
                <span className="muted history-date">
                  {new Date(a.createdAt).toLocaleString()}
                </span>
              </div>
              <button
                type="button"
                className="btn danger small"
                onClick={() => handleDelete(a.id)}
                disabled={deletingId === a.id}
              >
                {deletingId === a.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>

            <div className="history-row">
              <strong>Prompt:</strong> {a.prompt}
            </div>
            <div className="history-row">
              <strong>You wrote:</strong> {a.userWriting}
            </div>
            <div className="history-row">
              <strong>Corrected:</strong> {a.feedback.correctedVersion}
            </div>
            <div className="history-row">
              <strong>Natural:</strong> {a.feedback.naturalVersion}
            </div>
            <div className="history-row">
              <strong>Score:</strong>{' '}
              G {a.feedback.score.grammar}/10 ·{' '}
              V {a.feedback.score.vocabulary}/10 ·{' '}
              N {a.feedback.score.naturalness}/10
            </div>

            {a.feedback.mistakes.length > 0 && (
              <details className="history-details">
                <summary>{a.feedback.mistakes.length} mistake(s)</summary>
                <ul className="mistake-list">
                  {a.feedback.mistakes.map((m, i) => (
                    <li key={i} className="mistake-item">
                      <span className={`tag tag-${m.type}`}>{m.type}</span>
                      <div>
                        <div><strong>Original:</strong> {m.original}</div>
                        <div><strong>Correction:</strong> {m.correction}</div>
                        <div><strong>Explanation:</strong> {m.explanation}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {a.feedback.usefulPatterns.length > 0 && (
              <details className="history-details">
                <summary>{a.feedback.usefulPatterns.length} useful pattern(s)</summary>
                <ul className="pattern-list">
                  {a.feedback.usefulPatterns.map((p, i) => {
                    const isFav = !!p.favorite;
                    const key = `${a.id}_${i}`;
                    return (
                      <li key={i} className="pattern-item">
                        <div className="pattern-body">
                          <code>{p.pattern}</code>
                          <div className="muted">e.g. {p.example}</div>
                        </div>
                        {onToggleFavorite && (
                          <button
                            type="button"
                            className={`btn small ${isFav ? 'favorited' : 'secondary'}`}
                            disabled={pendingFavorite === key}
                            onClick={async () => {
                              if (pendingFavorite) return;
                              setPendingFavorite(key);
                              try {
                                await onToggleFavorite(a.id, i, !isFav);
                              } finally {
                                setPendingFavorite(null);
                              }
                            }}
                          >
                            {pendingFavorite === key
                              ? '…'
                              : isFav
                                ? 'Unfavorite'
                                : 'Favorite'}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </details>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
