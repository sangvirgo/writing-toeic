import type { GeminiModelId, GeminiModelInfo } from '../types';

interface Props {
  models: GeminiModelInfo[];
  value: GeminiModelId | null;
  onChange: (id: GeminiModelId) => void;
  geminiEnabled: boolean;
  isLoading?: boolean;
}

export function ModelSelector({
  models,
  value,
  onChange,
  geminiEnabled,
  isLoading,
}: Props) {
  return (
    <section className="panel model-selector-panel">
      <div className="model-selector-row">
        <label htmlFor="model-select"><strong>Gemini model</strong></label>
        <select
          id="model-select"
          value={value ?? ''}
          disabled={isLoading || models.length === 0}
          onChange={(e) => onChange(e.target.value as GeminiModelId)}
        >
          {isLoading && <option value="">Loading…</option>}
          {!isLoading &&
            models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
                {m.note ? ` — ${m.note}` : ''}
              </option>
            ))}
        </select>
        <span className={`source-badge ${geminiEnabled ? 'source-gemini' : 'source-mock'}`}>
          {geminiEnabled ? 'Gemini key set' : 'Mock only (no key)'}
        </span>
      </div>
      <p className="muted small model-selector-hint">
        Model selection affects Gemini calls only. If Gemini quota fails, mock fallback may be used
        (when <code>USE_MOCK_ON_GEMINI_ERROR=true</code>).
      </p>
    </section>
  );
}
