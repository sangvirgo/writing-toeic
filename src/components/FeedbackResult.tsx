import { useState } from 'react';
import type { FeedbackSource, GeminiModelId, WritingAttempt } from '../types';

interface Props {
  attempt: WritingAttempt | null;
  source: FeedbackSource | null;
  model: GeminiModelId | null;
  onToggleFavorite?: (
    attemptId: string,
    patternIndex: number,
    favorite: boolean,
  ) => Promise<void> | void;
}

export function FeedbackResult({ attempt, source, model, onToggleFavorite }: Props) {
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);

  if (!attempt) {
    return (
      <section className="panel">
        <h2>Feedback</h2>
        <div className="empty-state">
          <p>Your feedback will appear here after analysis.</p>
        </div>
      </section>
    );
  }

  const { feedback } = attempt;

  async function handleToggle(index: number, current: boolean) {
    if (!onToggleFavorite || !attempt) return;
    if (pendingIndex !== null) return;
    setPendingIndex(index);
    try {
      await onToggleFavorite(attempt.id, index, !current);
    } finally {
      setPendingIndex(null);
    }
  }

  return (
    <section className="panel">
      <div className="feedback-header">
        <h2>Feedback</h2>
        {source && (
          <span className={`source-badge source-${source}`}>
            {source === 'gemini' ? 'Gemini' : 'Mock'}
          </span>
        )}
        {model && <span className="muted small model-pill">model: {model}</span>}
      </div>

      <div className="feedback-block">
        <h3>Corrected Version</h3>
        <p className="corrected">{feedback.correctedVersion}</p>
      </div>

      <div className="feedback-block">
        <h3>More Natural Version</h3>
        <p className="natural">{feedback.naturalVersion}</p>
      </div>

      <div className="score-grid">
        <ScoreCard label="Grammar" value={feedback.score.grammar} />
        <ScoreCard label="Vocabulary" value={feedback.score.vocabulary} />
        <ScoreCard label="Naturalness" value={feedback.score.naturalness} />
      </div>

      <div className="feedback-block">
        <h3>Mistakes</h3>
        {feedback.mistakes.length === 0 ? (
          <p className="muted">No notable mistakes detected.</p>
        ) : (
          <ul className="mistake-list">
            {feedback.mistakes.map((m, i) => (
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
        )}
      </div>

      {feedback.usefulPatterns.length > 0 && (
        <div className="feedback-block">
          <h3>Useful Patterns</h3>
          <ul className="pattern-list">
            {feedback.usefulPatterns.map((p, i) => {
              const isFav = !!p.favorite;
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
                      onClick={() => handleToggle(i, isFav)}
                      disabled={pendingIndex === i}
                    >
                      {pendingIndex === i
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
        </div>
      )}

      {feedback.ankiCards.length > 0 && (
        <div className="feedback-block">
          <h3>Anki Cards</h3>
          <ul className="anki-list">
            {feedback.ankiCards.map((c, i) => (
              <li key={i}>
                <div><strong>Front:</strong> {c.front}</div>
                <div><strong>Back:</strong> {c.back}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {feedback.ielts && (
        <div className="feedback-block ielts-feedback-section">
          <h3>IELTS Feedback</h3>
          <div className="ielts-scores-grid">
            {feedback.ielts.estimatedBand != null && (
              <div className="score-card ielts-band-card">
                <div className="score-label">Estimated Band</div>
                <div className="score-value">{feedback.ielts.estimatedBand}</div>
              </div>
            )}
            {feedback.ielts.taskResponse != null && (
              <div className="score-card">
                <div className="score-label">Task Response</div>
                <div className="score-value">{feedback.ielts.taskResponse}<span className="score-suffix">/9</span></div>
              </div>
            )}
            {feedback.ielts.coherenceCohesion != null && (
              <div className="score-card">
                <div className="score-label">Coherence &amp; Cohesion</div>
                <div className="score-value">{feedback.ielts.coherenceCohesion}<span className="score-suffix">/9</span></div>
              </div>
            )}
            {feedback.ielts.lexicalResource != null && (
              <div className="score-card">
                <div className="score-label">Lexical Resource</div>
                <div className="score-value">{feedback.ielts.lexicalResource}<span className="score-suffix">/9</span></div>
              </div>
            )}
            {feedback.ielts.grammaticalRangeAccuracy != null && (
              <div className="score-card">
                <div className="score-label">Grammar Range &amp; Accuracy</div>
                <div className="score-value">{feedback.ielts.grammaticalRangeAccuracy}<span className="score-suffix">/9</span></div>
              </div>
            )}
          </div>
          {feedback.ielts.mainAdvice && feedback.ielts.mainAdvice.length > 0 && (
            <div className="ielts-advice">
              <h4>Main Advice</h4>
              <ul>
                {feedback.ielts.mainAdvice.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ScoreCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="score-card">
      <div className="score-label">{label}</div>
      <div className="score-value">{value}<span className="score-suffix">/10</span></div>
    </div>
  );
}
