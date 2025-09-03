import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<any>
  signUp: (email: string, password: string) => Promise<any>
  signOut: () => Promise<any>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true) // Start in a loading state

  // --- RE-INTRODUCING THE VIP PASS CHECK ---
  // This is the original code that checks for an existing session on startup.
  useEffect(() => {
    async function initializeAuth() {
      console.log('Attempting to retrieve existing session...');
      try {
        // This is the network call that caused the original problem.
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Error getting session:', error.message);
          setUser(null);
        } else {
          console.log('Session retrieved:', session?.user?.email || 'No active session');
          setUser(session?.user ?? null);
        }
      } catch (e) {
        console.error('A critical exception occurred during auth initialization:', e);
        setUser(null);
      } finally {
        // This is crucial: no matter what happens, we stop loading.
        setLoading(false);
      }
    }

    initializeAuth();

    // Set up the listener for future changes (login, logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log(`Auth state changed. Event: ${event}`);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []); // The empty array [] means this effect runs only once when the app starts.


  // --- The login/signup/signout functions are the "triggers" for the listener ---
  // (These are the same as the previous working version)
  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) {
      console.error('Sign in error:', result.error.message);
      setLoading(false);
    }
    return result;
  };

  const signUp = async (email: string, password: string) => {
    setLoading(true);
    const result = await supabase.auth.signUp({ email, password });
    if (result.error) {
      console.error('Sign up error:', result.error.message);
      setLoading(false);
    }
    return result;
  };

  const signOut = async () => {
    setLoading(true);
    const result = await supabase.auth.signOut();
    if (result.error) {
      console.error('Sign out error:', result.error.message);
      setLoading(false);
    }
    return result;
  };

  const value = { user, loading, signIn, signUp, signOut };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}