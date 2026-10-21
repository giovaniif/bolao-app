interface AppleSignInResponse {
  authorization: { id_token: string };
}

interface AppleIDGlobal {
  auth: {
    init: (config: { clientId: string; scope: string; redirectURI: string; usePopup: boolean }) => void;
    signIn: () => Promise<AppleSignInResponse>;
  };
}

interface GoogleIDGlobal {
  accounts: {
    id: {
      initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
      renderButton: (el: HTMLElement, options: Record<string, string | number>) => void;
    };
  };
}

declare global {
  interface Window {
    AppleID?: AppleIDGlobal;
    google?: GoogleIDGlobal;
  }
}

const APPLE_SCRIPT = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/pt_BR/appleid.auth.js';
const GOOGLE_SCRIPT = 'https://accounts.google.com/gsi/client';

function envString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function appleServiceId(): string {
  return envString(import.meta.env.VITE_APPLE_SERVICE_ID);
}

export function googleClientId(): string {
  return envString(import.meta.env.VITE_GOOGLE_CLIENT_ID);
}

const loading = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  const existing = loading.get(src);
  if (existing) return existing;
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading.delete(src);
      reject(new Error('Não foi possível carregar o login. Tente novamente.'));
    };
    document.head.appendChild(script);
  });
  loading.set(src, promise);
  return promise;
}

export async function requestAppleIdToken(): Promise<string> {
  if (!window.AppleID) await loadScript(APPLE_SCRIPT);
  const appleID = window.AppleID;
  if (!appleID) throw new Error('Não foi possível carregar o login da Apple.');
  appleID.auth.init({ clientId: appleServiceId(), scope: 'email', redirectURI: window.location.origin, usePopup: true });
  const res = await appleID.auth.signIn();
  return res.authorization.id_token;
}

export async function renderGoogleButton(el: HTMLElement, onToken: (idToken: string) => void): Promise<void> {
  if (!window.google?.accounts?.id) await loadScript(GOOGLE_SCRIPT);
  const id = window.google?.accounts?.id;
  if (!id) throw new Error('Não foi possível carregar o login do Google.');
  id.initialize({ client_id: googleClientId(), callback: (response) => onToken(response.credential) });
  id.renderButton(el, {
    theme: 'filled_black',
    size: 'large',
    shape: 'pill',
    text: 'continue_with',
    locale: 'pt-BR',
    width: Math.min(el.offsetWidth || 320, 400),
  });
}
