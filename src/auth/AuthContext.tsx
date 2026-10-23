import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Session, SignupInput } from '../types';

interface AuthState {
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: SignupInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .me()
      .then(setSession)
      .finally(() => setLoading(false));
  }, []);

  // Clearing the cache on every login/logout guarantees one company's
  // data is never shown to another company's user.
  const value: AuthState = {
    session,
    loading,
    login: async (email, password) => {
      queryClient.clear();
      setSession(await api.login(email, password));
    },
    signup: async (input) => {
      queryClient.clear();
      setSession(await api.signup(input));
    },
    logout: async () => {
      await api.logout();
      queryClient.clear();
      setSession(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
