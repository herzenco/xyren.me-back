import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;

    const withTimeout = async <T,>(p: PromiseLike<T>, ms: number, label: string): Promise<T> => {
      let t: number | undefined;
      try {
        return await Promise.race([
          Promise.resolve(p),
          new Promise<T>((_, reject) => {
            t = window.setTimeout(() => reject(new Error(`${label} timed out`)), ms) as unknown as number;
          }),
        ]);
      } finally {
        if (t !== undefined) window.clearTimeout(t);
      }
    };

    const checkAdminRole = async (userId: string) => {
      try {
        // Explicitly query for admin role - isAdmin is true if ANY admin row exists
        const rolePromise = supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('role', 'admin');

        const { data: roles } = await withTimeout(rolePromise, 4000, 'Role check');
        // isAdmin is true if we found at least one admin role entry
        if (mounted) setIsAdmin(Array.isArray(roles) && roles.length > 0);
      } catch (error) {
        console.warn('Role check failed:', error);
        if (mounted) setIsAdmin(false);
      }
    };

    // Safety valve: never let the app spin forever
    const safety = window.setTimeout(() => {
      if (mounted) setIsLoading(false);
    }, 6000);

    // INITIAL load (controls isLoading)
    const initializeAuth = async () => {
      try {
        const sessionPromise = supabase.auth.getSession();
        const { data: { session } } = await withTimeout(sessionPromise, 5000, 'Auth session');

        if (!mounted) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await checkAdminRole(session.user.id);
        } else {
          setIsAdmin(false);
        }
      } catch (error) {
        console.warn('Auth init failed:', error);
        if (mounted) {
          setSession(null);
          setUser(null);
          setIsAdmin(false);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    initializeAuth();

    // Listener for ONGOING auth changes (does NOT control initial isLoading)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        void checkAdminRole(session.user.id);
      } else {
        setIsAdmin(false);
      }
    });

    return () => {
      mounted = false;
      window.clearTimeout(safety);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, isAdmin, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
