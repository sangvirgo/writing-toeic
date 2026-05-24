import { useMemo } from 'react';
import type { ToeicChunk, WritingAttempt } from '../types';

interface Props {
  attempts: WritingAttempt[];
  chunks: ToeicChunk[];
}

interface StreakInfo {
  current: number;
  best: number;
  lastDate: string | null;
}

function localDateKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayKey(): string {
  return localDateKey(new Date().toISOString());
}

function previousDayKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return localDateKey(dt.toISOString());
}

function computeStreak(attempts: WritingAttempt[]): StreakInfo {
  if (attempts.length === 0) return { current: 0, best: 0, lastDate: null };
  const days = new Set<string>();
  for (const a of attempts) {
    const key = localDateKey(a.createdAt);
    if (key) days.add(key);
  }
  if (days.size === 0) return { current: 0, best: 0, lastDate: null };

  const sortedDays = [...days].sort();
  const lastDate = sortedDays[sortedDays.length - 1];

  // current streak: count back from today (or last date if today has no attempt)
  let current = 0;
  let cursor = todayKey();
  if (!days.has(cursor)) {
    // allow streak to count starting yesterday so a missed today doesn't reset until tomorrow
    cursor = previousDayKey(cursor);
  }
  while (days.has(cursor)) {
    current++;
    cursor = previousDayKey(cursor);
  }

  // best streak: walk sorted days
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of sortedDays) {
    if (prev === null) {
      run = 1;
    } else {
      run = previousDayKey(day) === prev ? run + 1 : 1;
    }
    if (run > best) best = run;
    prev = day;
  }

  return { current, best, lastDate };
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sum = nums.reduce((a, b) => a + b, 0);
  return Math.round((sum / nums.length) * 10) / 10;
}

export function LearningStats({ attempts, chunks }: Props) {
  const stats = useMemo(() => {
    let toeicCount = 0;
    let journalCount = 0;
    let mistakeReviewCount = 0;
    let ieltsSentenceCount = 0;
    let ieltsParagraphCount = 0;
    let grammarMistakes = 0;
    let vocabMistakes = 0;
    let naturalnessMistakes = 0;
    let structureMistakes = 0;
    const grammarScores: number[] = [];
    const vocabScores: number[] = [];
    const naturalnessScores: number[] = [];

    for (const a of attempts) {
      if (a.mode === 'toeic_chunk') toeicCount++;
      else if (a.mode === 'daily_journal') journalCount++;
      else if (a.mode === 'mistake_review') mistakeReviewCount++;
      else if (a.mode === 'ielts_sentence') ieltsSentenceCount++;
      else if (a.mode === 'ielts_paragraph') ieltsParagraphCount++;

      for (const m of a.feedback.mistakes) {
        if (m.type === 'grammar') grammarMistakes++;
        else if (m.type === 'vocabulary') vocabMistakes++;
        else if (m.type === 'naturalness') naturalnessMistakes++;
        else if (m.type === 'structure') structureMistakes++;
      }
      grammarScores.push(a.feedback.score.grammar);
      vocabScores.push(a.feedback.score.vocabulary);
      naturalnessScores.push(a.feedback.score.naturalness);
    }

    const totalMistakes =
      grammarMistakes + vocabMistakes + naturalnessMistakes + structureMistakes;

    let seedChunks = 0;
    let manualChunks = 0;
    let aiChunks = 0;
    for (const c of chunks) {
      if (c.source === 'seed') seedChunks++;
      else if (c.source === 'manual') manualChunks++;
      else if (c.source === 'ai') aiChunks++;
    }

    return {
      totalAttempts: attempts.length,
      toeicCount,
      journalCount,
      mistakeReviewCount,
      ieltsSentenceCount,
      ieltsParagraphCount,
      ieltsTotal: ieltsSentenceCount + ieltsParagraphCount,
      totalMistakes,
      grammarMistakes,
      vocabMistakes,
      naturalnessMistakes,
      structureMistakes,
      avgGrammar: average(grammarScores),
      avgVocab: average(vocabScores),
      avgNaturalness: average(naturalnessScores),
      totalChunks: chunks.length,
      seedChunks,
      manualChunks,
      aiChunks,
    };
  }, [attempts, chunks]);

  const streak = useMemo(() => computeStreak(attempts), [attempts]);

  const favoritePatterns = useMemo(() => {
    const entries: {
      attemptId: string;
      attemptCreatedAt: string;
      attemptPrompt: string;
      pattern: string;
      example: string;
    }[] = [];
    for (const a of attempts) {
      a.feedback.usefulPatterns.forEach((p) => {
        if (p.favorite) {
          entries.push({
            attemptId: a.id,
            attemptCreatedAt: a.createdAt,
            attemptPrompt: a.prompt,
            pattern: p.pattern,
            example: p.example,
          });
        }
      });
    }
    return entries.sort((a, b) => (a.attemptCreatedAt < b.attemptCreatedAt ? 1 : -1));
  }, [attempts]);

  return (
    <section className="panel learning-stats-panel">
      <h2>Learning Stats</h2>

      <div className="stats-grid">
        <StatCard label="Total attempts" value={stats.totalAttempts} />
        <StatCard label="TOEIC chunk" value={stats.toeicCount} />
        <StatCard label="Daily journal" value={stats.journalCount} />
        <StatCard label="IELTS sentence" value={stats.ieltsSentenceCount} />
        <StatCard label="IELTS paragraph" value={stats.ieltsParagraphCount} />
        <StatCard label="IELTS total" value={stats.ieltsTotal} />
        <StatCard label="Mistake review" value={stats.mistakeReviewCount} />
        <StatCard label="Total mistakes" value={stats.totalMistakes} />
        <StatCard label="Grammar mistakes" value={stats.grammarMistakes} />
        <StatCard label="Vocabulary mistakes" value={stats.vocabMistakes} />
        <StatCard label="Naturalness mistakes" value={stats.naturalnessMistakes} />
        <StatCard label="Structure mistakes" value={stats.structureMistakes} />
        <StatCard label="Avg grammar" value={`${stats.avgGrammar}/10`} />
        <StatCard label="Avg vocabulary" value={`${stats.avgVocab}/10`} />
        <StatCard label="Avg naturalness" value={`${stats.avgNaturalness}/10`} />
        <StatCard label="Total chunks" value={stats.totalChunks} />
        <StatCard label="Seed chunks" value={stats.seedChunks} />
        <StatCard label="Manual chunks" value={stats.manualChunks} />
        <StatCard label="AI chunks" value={stats.aiChunks} />
      </div>

      <div className="streak-row">
        <StatCard label="Current streak" value={`${streak.current} day${streak.current === 1 ? '' : 's'}`} />
        <StatCard label="Best streak" value={`${streak.best} day${streak.best === 1 ? '' : 's'}`} />
        <StatCard
          label="Last practice"
          value={streak.lastDate ?? '—'}
        />
      </div>

      <div className="favorite-patterns">
        <h3>Favorite Patterns</h3>
        {favoritePatterns.length === 0 ? (
          <p className="muted">
            No favorite patterns yet. Click the star next to a useful pattern in Feedback or
            History to save it here.
          </p>
        ) : (
          <ul className="favorite-pattern-list">
            {favoritePatterns.map((p) => (
              <li key={`${p.attemptId}_${p.pattern}`} className="favorite-pattern-item">
                <code>{p.pattern}</code>
                <div className="muted">e.g. {p.example}</div>
                <div className="muted small">
                  From: {p.attemptPrompt} ·{' '}
                  {new Date(p.attemptCreatedAt).toLocaleDateString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
