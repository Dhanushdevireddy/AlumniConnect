import { createContext, useContext, useState, ReactNode } from 'react';
import { auth, clearTokens, User } from '../api/client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
}

interface RegisterData {
  email: string; password: string; role: string; fullName: string;
  university?: string; graduationYear?: number; company?: string; jobTitle?: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = sessionStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await auth.login(email, password);
      auth.initTokens(res.accessToken, res.refreshToken);
      sessionStorage.setItem('user', JSON.stringify(res.user));
      setUser(res.user);
    } finally { setLoading(false); }
  };

  const register = async (data: RegisterData) => {
    setLoading(true);
    try {
      const res = await auth.register(data);
      auth.initTokens(res.accessToken, res.refreshToken);
      sessionStorage.setItem('user', JSON.stringify(res.user));
      setUser(res.user);
    } finally { setLoading(false); }
  };

  const logout = async () => {
    const rt = sessionStorage.getItem('refreshToken');
    if (rt) await auth.logout(rt).catch(() => {});
    clearTokens();
    sessionStorage.removeItem('user');
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
