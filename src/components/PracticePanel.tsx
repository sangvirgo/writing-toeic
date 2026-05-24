import type { PracticeMode, ToeicChunk } from '../types';
import type { MistakeEntry } from './MistakeReview';
import { randomPrompt } from '../data/journalPrompts';

interface Props {
  mode: PracticeMode;
  onModeChange: (mode: PracticeMode) => void;

  chunk: ToeicChunk | null;
  chunkWriting: string;
  onChunkWritingChange: (value: string) => void;
  onGenerateChunk: () => Promise<void> | void;
  isLoadingChunk: boolean;

  journalPrompt: string;
  journalWriting: string;
  onJournalWritingChange: (value: string) => void;
  onJournalPromptChange: (value: string) => void;

  selectedMistake: MistakeEntry | null;
  mistakeWriting: string;
  onMistakeWritingChange: (value: string) => void;

  onAnalyze: () => Promise<void> | void;
  isAnalyzing: boolean;
  errorMessage: string | null;
}

export function PracticePanel({
  mode,
  onModeChange,
  chunk,
  chunkWriting,
  onChunkWritingChange,
  onGenerateChunk,
  isLoadingChunk,
  journalPrompt,
  journalWriting,
  onJournalWritingChange,
  onJournalPromptChange,
  selectedMistake,
  mistakeWriting,
  onMistakeWritingChange,
  onAnalyze,
  isAnalyzing,
  errorMessage,
}: Props) {
  const currentWriting =
    mode === 'toeic_chunk'
      ? chunkWriting
      : mode === 'daily_journal'
        ? journalWriting
        : mistakeWriting;

  const setWriting =
    mode === 'toeic_chunk'
      ? onChunkWritingChange
      : mode === 'daily_journal'
        ? onJournalWritingChange
        : onMistakeWritingChange;

  const hasPrompt =
    mode === 'toeic_chunk'
      ? !!chunk
      : mode === 'daily_journal'
        ? !!journalPrompt
        : !!selectedMistake;

  const placeholder =
    mode === 'toeic_chunk'
      ? 'Write 2–3 sentences using this chunk...'
      : mode === 'daily_journal'
        ? 'Write your daily journal in English...'
        : 'Write 2–3 new sentences using the corrected pattern...';

  function handleGenerate() {
    if (mode === 'toeic_chunk') {
      void onGenerateChunk();
    } else if (mode === 'daily_journal') {
      onJournalPromptChange(randomPrompt(journalPrompt));
    }
  }

  const showGenerate = mode === 'toeic_chunk' || mode === 'daily_journal';
  const analyzeLabel =
    mode === 'toeic_chunk'
      ? 'Analyze Writing'
      : mode === 'daily_journal'
        ? 'Analyze Journal'
        : 'Analyze Practice';

  return (
    <section className="panel">
      <h2>Practice</h2>

      <div className="mode-tabs" role="tablist">
        <button
          role="tab"
          className={mode === 'toeic_chunk' ? 'tab active' : 'tab'}
          onClick={() => onModeChange('toeic_chunk')}
        >
          TOEIC Chunk Practice
        </button>
        <button
          role="tab"
          className={mode === 'daily_journal' ? 'tab active' : 'tab'}
          onClick={() => onModeChange('daily_journal')}
        >
          Daily Journal
        </button>
        <button
          role="tab"
          className={mode === 'mistake_review' ? 'tab active' : 'tab'}
          onClick={() => onModeChange('mistake_review')}
        >
          Mistake Review
        </button>
      </div>

      {showGenerate && (
        <button
          type="button"
          className="btn secondary"
          onClick={handleGenerate}
          disabled={isLoadingChunk}
        >
          {mode === 'toeic_chunk'
            ? isLoadingChunk
              ? 'Loading…'
              : 'Generate Chunk'
            : 'Generate Journal Prompt'}
        </button>
      )}

      {mode === 'toeic_chunk' && chunk && (
        <div className="prompt-card">
          <div className="chunk-head">
            <strong className="prompt-text">{chunk.text}</strong>
            <span className={`tag tag-${chunk.difficulty}`}>{chunk.difficulty}</span>
            <span className={`tag tag-${chunk.topic}`}>{chunk.topic.replace('_', ' ')}</span>
          </div>
          <div className="chunk-meaning">VI: {chunk.meaningVi}</div>
          <div className="chunk-example">e.g. {chunk.example}</div>
        </div>
      )}

      {mode === 'daily_journal' && journalPrompt && (
        <div className="prompt-card">
          <span className="prompt-label">Journal prompt</span>
          <strong className="prompt-text">{journalPrompt}</strong>
        </div>
      )}

      {mode === 'mistake_review' && !selectedMistake && (
        <div className="prompt-card empty-state">
          <p>Choose a mistake from the Mistake Review section to practice.</p>
        </div>
      )}

      {mode === 'mistake_review' && selectedMistake && (
        <div className="prompt-card mistake-task-card">
          <span className="prompt-label">Target correction</span>
          <strong className="prompt-text">{selectedMistake.correction}</strong>

          <div className="mistake-task-row">
            <span className="prompt-label">Original mistake</span>
            <span>{selectedMistake.original}</span>
          </div>
          <div className="mistake-task-row">
            <span className="prompt-label">Explanation</span>
            <span>{selectedMistake.explanation}</span>
          </div>
          <div className="mistake-task-row">
            <span className="prompt-label">Your task</span>
            <span>Write 2–3 new sentences using the corrected pattern naturally.</span>
          </div>
        </div>
      )}

      {hasPrompt && (
        <>
          <textarea
            className="writing-area"
            rows={8}
            placeholder={placeholder}
            value={currentWriting}
            onChange={(e) => setWriting(e.target.value)}
            maxLength={5000}
          />
          <div className="char-count">{currentWriting.length} / 5000</div>

          <button
            type="button"
            className="btn primary"
            onClick={() => void onAnalyze()}
            disabled={isAnalyzing || !currentWriting.trim()}
          >
            {isAnalyzing ? 'Analyzing…' : analyzeLabel}
          </button>
        </>
      )}

      {errorMessage && <div className="error-banner">{errorMessage}</div>}
    </section>
  );
}
