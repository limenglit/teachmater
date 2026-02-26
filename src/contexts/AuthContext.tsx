import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  approvalStatus: string | null; // 'pending' | 'approved' | 'rejected' | null
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  approvalStatus: null,
  isAdmin: false,
  signOut: async () => {},
  refreshStatus: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [approvalStatus, setApprovalStatus] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchStatus = async (currentUser: User | null) => {
    if (!currentUser) {
      setApprovalStatus(null);
      setIsAdmin(false);
      return;
    }
    const { data: status } = await supabase.rpc('get_my_status');
    setApprovalStatus(status as string || null);

    const { data: adminCheck } = await supabase.rpc('has_role', {
      _user_id: currentUser.id,
      _role: 'admin',
    });
    setIsAdmin(!!adminCheck);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      // Defer status fetch to avoid deadlock
      setTimeout(() => fetchStatus(session?.user ?? null), 0);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      fetchStatus(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setApprovalStatus(null);
    setIsAdmin(false);
  };

  const refreshStatus = async () => {
    await fetchStatus(user);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, approvalStatus, isAdmin, signOut, refreshStatus }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
