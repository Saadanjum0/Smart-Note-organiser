import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Error getting session:', error);
        toast.error('Error connecting to authentication service.');
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch(error => {
      console.error('Unhandled error getting session:', error);
      toast.error('Critical error initializing authentication.');
      setLoading(false); // Ensure loading is set to false even on critical error
    });

    // Listen for auth changes
    const { data: { subscription }, error: subscriptionError } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        // It's good practice to also check for an error when the callback is invoked,
        // though less common for onAuthStateChange itself to pass an error to the callback.
        // The primary concern is the initial subscription setup.
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    if (subscriptionError) {
      console.error('Error subscribing to auth state changes:', subscriptionError);
      toast.error('Error setting up authentication listener.');
      setLoading(false); // Also set loading to false if subscription setup fails
    }
    
    // Ensure setLoading(false) is called if subscription is null for some reason,
    // although supabase.auth.onAuthStateChange typically returns a subscription object.
    if (!subscription && !subscriptionError) {
        console.warn('Auth state change subscription was not established.');
        // Decide if this is critical enough to stop loading or if app can proceed.
        // For now, assume we should stop "initial loading" if subscription fails.
        setLoading(false);
    }

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  async function signIn(email: string, password: string) {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }
      
      toast.success("Successfully signed in!");
      navigate('/app', { replace: true });
    } catch (error) {
      console.error("Critical error during sign in process:", error);
      toast.error("Failed to sign in due to an unexpected error");
    }
  }

  async function signUp(email: string, password: string, fullName: string) {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: {
            full_name: fullName
          }
        }
      });
      
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }
      
      toast.success("Registration successful! Please check your email for verification.");
      navigate('/login', { replace: true });
    } catch (error) {
      console.error("Error signing up:", error);
      toast.error("Failed to sign up");
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    try {
      await supabase.auth.signOut();
      navigate('/', { replace: true });
      toast.success("You have been signed out");
    } catch (error) {
      console.error("Error signing out:", error);
      toast.error("Failed to sign out");
    }
  }

  async function resetPassword(email: string) {
    try {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        toast.error(error.message);
        return;
      }
      
      toast.success("Password reset instructions have been sent to your email");
    } catch (error) {
      console.error("Error resetting password:", error);
      toast.error("Failed to send password reset instructions");
    } finally {
      setLoading(false);
    }
  }

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
