import { useState } from 'react';
import { setConsent } from './analytics';

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;

function granted(): boolean {
  try {
    return localStorage.getItem('analytics-consent') === 'granted';
  } catch {
    return false;
  }
}

export function PrivacyToggle() {
  const [on, setOn] = useState(granted);
  if (!KEY) return null;
  return (
    <label className="flex items-start gap-3 mt-6">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => {
          setConsent(e.target.checked ? 'granted' : 'denied');
          setOn(e.target.checked);
        }}
        className="mt-1"
      />
      <span className="text-sm">
        Compartilhar dados de uso
        <br />
        <span className="text-xs text-text-muted">Sem seu nome ou e-mail. Ajuda a melhorar o app.</span>
      </span>
    </label>
  );
}
