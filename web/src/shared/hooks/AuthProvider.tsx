import { useState, useCallback, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getToken, refreshSession } from '../api/client';
import { configureSession, expireSession, needsRefresh, setLoginNotice } from '../api/session';
import type { ReactNode } from 'react';
import { AuthContext } from './useAuth';
import type { User } from './useAuth';

function loadUser(): User | null {
  try {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(loadUser);
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('token')
  );

  const login = useCallback((t: string, u: User) => {
    setToken(t);
    setUser(u);
    localStorage.setItem('token', t);
    localStorage.setItem('user', JSON.stringify(u));
  }, []);

  const queryClient = useQueryClient();

  const logout = useCallback(
    (notice?: string) => {
      if (notice) setLoginNotice(notice);
      setToken(null);
      setUser(null);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      queryClient.clear();
    },
    [queryClient]
  );

  useEffect(() => {
    configureSession({
      onRefreshed: (next) => {
        setToken(next);
        localStorage.setItem('token', next);
      },
      onExpired: () => logout(),
    });
  }, [logout]);

  useEffect(() => {
    const onFocus = () => {
      const current = getToken();
      if (!current || !needsRefresh(current)) return;
      void refreshSession().then((result) => {
        if (result.kind === 'unauthorized') void expireSession(current);
      });
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      localStorage.setItem('user', JSON.stringify(next));
      return next;
    });
  }, []);

  const isAdmin = useCallback(() => user?.is_admin ?? false, [user]);

  const value = useMemo(
    () => ({ user, token, login, logout, updateUser, isAdmin }),
    [user, token, login, logout, updateUser, isAdmin]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
