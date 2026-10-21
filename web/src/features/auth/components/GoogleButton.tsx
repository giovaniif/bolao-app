import { useEffect, useRef } from 'react';
import { renderGoogleButton } from '../api/socialProviders';

interface GoogleButtonProps {
  onToken: (idToken: string) => void;
  onError: (message: string) => void;
}

export function GoogleButton({ onToken, onError }: GoogleButtonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const handlers = useRef({ onToken, onError });

  useEffect(() => {
    handlers.current = { onToken, onError };
  }, [onToken, onError]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    renderGoogleButton(el, (token) => handlers.current.onToken(token)).catch((err: unknown) =>
      handlers.current.onError(err instanceof Error ? err.message : 'Erro ao carregar o login do Google')
    );
  }, []);

  return <div ref={ref} className="flex justify-center min-h-[44px]" />;
}
