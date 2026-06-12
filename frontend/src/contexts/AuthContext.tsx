import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { type User, onIdTokenChanged, signInAnonymously } from 'firebase/auth';
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
  // Tracked as its own primitive so registering an anon user re-renders: linking
  // a credential keeps the same `user` object reference (only mutating it in
  // place), so setUser alone would be a no-op render — flipping this boolean is
  // what propagates the now-registered state to consumers.
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    installSyncTriggers();
    // onIdTokenChanged (not onAuthStateChanged) so the listener also fires when
    // an anonymous user LINKS a credential — that refreshes the token without a
    // sign-in event, so onAuthStateChanged would miss it and leave the UI stale.
    return onIdTokenChanged(auth, (u) => {
      setUser(u);
      setIsAnonymous(u?.isAnonymous ?? true);
      setLoading(false);
      // Identity (anon or linked) just became available — push any backlog.
      // After a link this fires with the fresh email-bearing token, which is
      // what lets the server persist the newly-registered email.
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
    <AuthContext.Provider value={{ user, loading, isAnonymous }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
