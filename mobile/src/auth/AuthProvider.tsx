import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useQueryClient } from '@tanstack/react-query';
import { getToken, refreshSession, setToken } from '../api/client';
import { configureSession, expireSession, needsRefresh, setLoginNotice } from '../api/session';
import { resetAnalytics } from '../analytics/analytics';
import { clearSentryUser } from '../observability/sentry';
import type { LoginResponse } from '../api/auth';
import { unregisterForPush } from '../notifications/push';

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
  signOut: (notice?: string) => Promise<void>;
}

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const queryClient = useQueryClient();

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

  const clearSession = useCallback(async () => {
    setToken(null);
    setTokenState(null);
    setUser(null);
    queryClient.clear();
    resetAnalytics();
    clearSentryUser();
    await Promise.allSettled([SecureStore.deleteItemAsync(TOKEN_KEY), SecureStore.deleteItemAsync(USER_KEY)]);
  }, [queryClient]);

  const signOut = useCallback(
    async (notice?: string) => {
      await unregisterForPush().catch(() => undefined);
      if (notice) setLoginNotice(notice);
      await clearSession();
    },
    [clearSession]
  );

  useEffect(() => {
    configureSession({
      onRefreshed: async (next) => {
        setToken(next);
        setTokenState(next);
        await SecureStore.setItemAsync(TOKEN_KEY, next);
      },
      onExpired: clearSession,
    });
  }, [clearSession]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const current = getToken();
      if (state !== 'active' || !current || !needsRefresh(current)) return;
      void refreshSession().then((result) => {
        if (result.kind === 'unauthorized') void expireSession(current);
      });
    });
    return () => subscription.remove();
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
