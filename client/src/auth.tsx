import { createContext, useContext, useState, type ReactNode } from 'react';
import { loadSession, login, saveSession, type AuthSession } from './api';
import type { AuthUser } from './types';

// WHY React context for auth: the signed-in user is needed in unrelated
// corners of the tree (header, every StatusSelect) — threading it through
// props would couple every intermediate component to auth.
interface AuthContextValue {
  user: AuthUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // WHY lazy initial state from localStorage: a refresh keeps the agent
  // signed in without any "loading auth…" flicker or extra request.
  const [session, setSession] = useState<AuthSession | null>(loadSession);

  async function signIn(email: string, password: string) {
    const s = await login(email, password); // throws ApiError on bad credentials
    saveSession(s);
    setSession(s);
  }

  function signOut() {
    saveSession(null);
    setSession(null);
  }

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  // WHY throw instead of returning null: using auth outside the provider is a
  // programming error — fail at development time, loudly.
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
