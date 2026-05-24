import { useCallback, useEffect, useState } from 'react';
import { PracticePanel } from './components/PracticePanel';
import { FeedbackResult } from './components/FeedbackResult';
import { HistoryList } from './components/HistoryList';
import { ChunkManager } from './components/ChunkManager';
import { LearningStats } from './components/LearningStats';
import { ModelSelector } from './components/ModelSelector';
import {
  MistakeReview,
  buildMistakeTaskPrompt,
  type MistakeEntry,
} from './components/MistakeReview';
import {
  analyzeWriting,
  deleteHistoryItem,
  getChunks,
  getHistory,
  getModels,
  getRandomChunk,
  getRandomIeltsPrompt,
  togglePatternFavorite,
} from './api/client';
import { randomPrompt } from './data/journalPrompts';
import type {
  FeedbackSource,
  GeminiModelId,
  GeminiModelInfo,
  IeltsPracticeMode,
  IeltsPrompt,
  PracticeMode,
  ToeicChunk,
  WritingAttempt,
} from './types';

export default function App() {
  const [mode, setMode] = useState<PracticeMode>('toeic_chunk');

  const [chunk, setChunk] = useState<ToeicChunk | null>(null);
  const [chunkWriting, setChunkWriting] = useState('');
  const [isLoadingChunk, setIsLoadingChunk] = useState(false);

  const [journalPrompt, setJournalPrompt] = useState<string>(() => randomPrompt());
  const [journalWriting, setJournalWriting] = useState('');

  const [selectedMistake, setSelectedMistake] = useState<MistakeEntry | null>(null);
  const [mistakeWriting, setMistakeWriting] = useState('');

  const [ieltsSubmode, setIeltsSubmode] = useState<IeltsPracticeMode>('ielts_sentence');
  const [ieltsPrompt, setIeltsPrompt] = useState<IeltsPrompt | null>(null);
  const [ieltsWriting, setIeltsWriting] = useState('');
  const [isLoadingIeltsPrompt, setIsLoadingIeltsPrompt] = useState(false);

  const [latest, setLatest] = useState<WritingAttempt | null>(null);
  const [latestSource, setLatestSource] = useState<FeedbackSource | null>(null);
  const [latestModel, setLatestModel] = useState<GeminiModelId | null>(null);

  const [attempts, setAttempts] = useState<WritingAttempt[]>([]);
  const [allChunks, setAllChunks] = useState<ToeicChunk[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [practiceError, setPracticeError] = useState<string | null>(null);

  const [models, setModels] = useState<GeminiModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<GeminiModelId | null>(null);
  const [geminiEnabled, setGeminiEnabled] = useState<boolean>(false);
  const [isLoadingModels, setIsLoadingModels] = useState(true);

  const reloadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const db = await getHistory();
      setAttempts(db.attempts);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  const reloadChunks = useCallback(async () => {
    try {
      const list = await getChunks();
      setAllChunks(list);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchNewChunk = useCallback(async () => {
    setIsLoadingChunk(true);
    setPracticeError(null);
    try {
      const next = await getRandomChunk();
      setChunk(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load chunk.';
      setPracticeError(message);
    } finally {
      setIsLoadingChunk(false);
    }
  }, []);

  const fetchIeltsPrompt = useCallback(async () => {
    setIsLoadingIeltsPrompt(true);
    setPracticeError(null);
    try {
      const next = await getRandomIeltsPrompt({ mode: ieltsSubmode });
      setIeltsPrompt(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load IELTS prompt.';
      setPracticeError(message);
    } finally {
      setIsLoadingIeltsPrompt(false);
    }
  }, [ieltsSubmode]);

  useEffect(() => {
    void reloadHistory();
    void reloadChunks();
    void fetchNewChunk();
    void (async () => {
      try {
        const data = await getModels();
        setModels(data.models);
        setSelectedModel(data.defaultModel);
        setGeminiEnabled(data.geminiEnabled);
      } catch (err) {
        console.error('Failed to load models:', err);
      } finally {
        setIsLoadingModels(false);
      }
    })();
  }, [reloadHistory, reloadChunks, fetchNewChunk]);

  function handlePracticeMistake(mistake: MistakeEntry) {
    setSelectedMistake(mistake);
    setMistakeWriting('');
    setMode('mistake_review');
    setPracticeError(null);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async function handleAnalyze() {
    let prompt = '';
    let userWriting = '';
    if (mode === 'toeic_chunk') {
      prompt = chunk?.text ?? '';
      userWriting = chunkWriting;
    } else if (mode === 'daily_journal') {
      prompt = journalPrompt;
      userWriting = journalWriting;
    } else if (mode === 'ielts_sentence' || mode === 'ielts_paragraph') {
      prompt = ieltsPrompt
        ? [
            ieltsPrompt.question,
            ieltsPrompt.targetPattern
              ? `Target pattern: ${ieltsPrompt.targetPattern}`
              : '',
            ieltsPrompt.instruction,
          ]
            .filter(Boolean)
            .join('\n')
        : '';
      userWriting = ieltsWriting;
    } else {
      if (!selectedMistake) return;
      prompt = buildMistakeTaskPrompt(selectedMistake);
      userWriting = mistakeWriting;
    }
    if (!prompt || !userWriting.trim()) return;

    setIsAnalyzing(true);
    setPracticeError(null);
    try {
      const { attempt, source, model } = await analyzeWriting({
        mode,
        prompt,
        userWriting,
        ...(selectedModel ? { model: selectedModel } : {}),
      });
      setLatest(attempt);
      setLatestSource(source);
      setLatestModel(model);
      await reloadHistory();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to analyze writing.';
      setPracticeError(message);
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteHistoryItem(id);
      if (latest?.id === id) {
        setLatest(null);
        setLatestSource(null);
        setLatestModel(null);
      }
      if (selectedMistake?.attemptId === id) {
        setSelectedMistake(null);
        setMistakeWriting('');
      }
      await reloadHistory();
    } catch (err) {
      console.error(err);
      window.alert(err instanceof Error ? err.message : 'Failed to delete attempt.');
    }
  }

  async function handleToggleFavorite(
    attemptId: string,
    patternIndex: number,
    favorite: boolean,
  ) {
    try {
      await togglePatternFavorite(attemptId, patternIndex, favorite);
      // Optimistic update for the visible latest attempt.
      if (latest && latest.id === attemptId) {
        const next: WritingAttempt = {
          ...latest,
          feedback: {
            ...latest.feedback,
            usefulPatterns: latest.feedback.usefulPatterns.map((p, i) =>
              i === patternIndex ? { ...p, favorite } : p,
            ),
          },
        };
        setLatest(next);
      }
      await reloadHistory();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to update favorite.');
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>English Writing Trainer</h1>
        <p className="subtitle">Practice TOEIC chunks and daily English journaling.</p>
      </header>

      <ModelSelector
        models={models}
        value={selectedModel}
        onChange={setSelectedModel}
        geminiEnabled={geminiEnabled}
        isLoading={isLoadingModels}
      />

      <main className="main-grid">
        <PracticePanel
          mode={mode}
          onModeChange={setMode}
          chunk={chunk}
          chunkWriting={chunkWriting}
          onChunkWritingChange={setChunkWriting}
          onGenerateChunk={fetchNewChunk}
          isLoadingChunk={isLoadingChunk}
          journalPrompt={journalPrompt}
          journalWriting={journalWriting}
          onJournalWritingChange={setJournalWriting}
          onJournalPromptChange={setJournalPrompt}
          selectedMistake={selectedMistake}
          mistakeWriting={mistakeWriting}
          onMistakeWritingChange={setMistakeWriting}
          ieltsSubmode={ieltsSubmode}
          onIeltsSubmodeChange={setIeltsSubmode}
          ieltsPrompt={ieltsPrompt}
          ieltsWriting={ieltsWriting}
          onIeltsWritingChange={setIeltsWriting}
          onGenerateIeltsPrompt={fetchIeltsPrompt}
          isLoadingIeltsPrompt={isLoadingIeltsPrompt}
          onAnalyze={handleAnalyze}
          isAnalyzing={isAnalyzing}
          errorMessage={practiceError}
        />
        <FeedbackResult
          attempt={latest}
          source={latestSource}
          model={latestModel}
          onToggleFavorite={handleToggleFavorite}
        />
      </main>

      <LearningStats attempts={attempts} chunks={allChunks} />

      <MistakeReview attempts={attempts} onPractice={handlePracticeMistake} />

      <ChunkManager model={selectedModel} />

      <HistoryList
        attempts={attempts}
        onDelete={handleDelete}
        onToggleFavorite={handleToggleFavorite}
        isLoading={isLoadingHistory}
      />

      <footer className="app-footer muted">
        History is stored locally in <code>store/writing-history.json</code>. Chunks live in{' '}
        <code>store/toeic-chunks.json</code>. No cloud sync.
      </footer>
    </div>
  );
}
