import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { type User, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { auth } from '../firebase';
import { installSyncTriggers, syncNow } from '../sync/syncEngine';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  /** No registered account yet — local data only syncs after linking. */
  isAnonymous: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  isAnonymous: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    installSyncTriggers();
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      // Identity (anon or linked) just became available — push any backlog.
      if (u) void syncNow();
    });
  }, []);

  // Lazy anonymous sign-in: never blocks the app. The local store works
  // without any Firebase identity; the anon uid only enables server sync.
  // Retried whenever connectivity returns.
  useEffect(() => {
    if (loading || user) return;
    const tryAnon = () => {
      if (navigator.onLine) signInAnonymously(auth).catch(() => {});
    };
    tryAnon();
    window.addEventListener('online', tryAnon);
    return () => window.removeEventListener('online', tryAnon);
  }, [loading, user]);

  return (
    <AuthContext.Provider value={{ user, loading, isAnonymous: user?.isAnonymous ?? true }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
