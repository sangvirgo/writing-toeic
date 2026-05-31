import { useState, useEffect } from 'react';

const STORAGE_KEY = 'gemini_api_key';

/**
 * Read the stored Gemini API key from localStorage.
 * Returns the key string or null if not set.
 */
export function getStoredApiKey(): string | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

function maskKey(key: string): string {
  if (key.length <= 8) return '••••••••';
  return key.slice(0, 4) + '••••' + key.slice(-4);
}

export function ApiKeySettings() {
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [showInput, setShowInput] = useState(false);

  useEffect(() => {
    setSavedKey(getStoredApiKey());
  }, []);

  function handleSave() {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    localStorage.setItem(STORAGE_KEY, trimmed);
    setSavedKey(trimmed);
    setInputValue('');
    setShowInput(false);
  }

  function handleClear() {
    localStorage.removeItem(STORAGE_KEY);
    setSavedKey(null);
    setInputValue('');
    setShowInput(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setShowInput(false);
      setInputValue('');
    }
  }

  return (
    <div className="api-key-settings">
      <div className="api-key-row">
        <span className="api-key-label">Gemini API Key:</span>
        {savedKey ? (
          <span className="api-key-value">{maskKey(savedKey)}</span>
        ) : (
          <span className="api-key-value muted">Not set</span>
        )}
        {!showInput && (
          <button
            type="button"
            className="btn-sm"
            onClick={() => setShowInput(true)}
          >
            {savedKey ? 'Change' : 'Set Key'}
          </button>
        )}
        {savedKey && !showInput && (
          <button
            type="button"
            className="btn-sm btn-danger"
            onClick={handleClear}
          >
            Clear
          </button>
        )}
      </div>

      {showInput && (
        <div className="api-key-input-row">
          <input
            type="password"
            placeholder="Paste your Gemini API key…"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <button
            type="button"
            className="btn-sm btn-primary"
            onClick={handleSave}
            disabled={!inputValue.trim()}
          >
            Save
          </button>
          <button
            type="button"
            className="btn-sm"
            onClick={() => {
              setShowInput(false);
              setInputValue('');
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
