import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { setToken } from '../api/client';
import type { LoginResponse } from '../api/auth';

export interface SessionUser {
  id: string;
  username: string;
  isAdmin: boolean;
}

interface AuthState {
  ready: boolean;
  token: string | null;
  user: SessionUser | null;
  signIn: (res: LoginResponse) => Promise<void>;
  signOut: () => Promise<void>;
}

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    Promise.all([SecureStore.getItemAsync(TOKEN_KEY), SecureStore.getItemAsync(USER_KEY)])
      .then(([storedToken, storedUser]) => {
        setToken(storedToken);
        setTokenState(storedToken);
        setUser(storedUser ? (JSON.parse(storedUser) as SessionUser) : null);
      })
      .finally(() => setReady(true));
  }, []);

  const signIn = useCallback(async (res: LoginResponse) => {
    const next = { id: res.user_id, username: res.username, isAdmin: res.is_admin };
    setToken(res.token);
    setTokenState(res.token);
    setUser(next);
    await SecureStore.setItemAsync(TOKEN_KEY, res.token);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(next));
  }, []);

  const signOut = useCallback(async () => {
    setToken(null);
    setTokenState(null);
    setUser(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
  }, []);

  const value = useMemo(() => ({ ready, token, user, signIn, signOut }), [ready, token, user, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
