import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api } from '../api';

interface AdminInfo {
  id: string;
  username: string;
  role: string;
}

interface AuthContextType {
  admin: AdminInfo | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminInfo | null>(() => {
    const stored = localStorage.getItem('admin');
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(!!token);

  // Validate existing token on mount
  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    api.getMe()
      .then(({ admin: adminData }) => {
        setAdmin(adminData);
        localStorage.setItem('admin', JSON.stringify(adminData));
      })
      .catch(() => {
        setToken(null);
        setAdmin(null);
        localStorage.removeItem('token');
        localStorage.removeItem('admin');
      })
      .finally(() => setIsLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (username: string, password: string) => {
    const response = await api.login(username, password);
    setToken(response.token);
    setAdmin(response.admin);
    localStorage.setItem('token', response.token);
    localStorage.setItem('admin', JSON.stringify(response.admin));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setAdmin(null);
    localStorage.removeItem('token');
    localStorage.removeItem('admin');
  }, []);

  return (
    <AuthContext.Provider
      value={{
        admin,
        token,
        isAuthenticated: !!token && !!admin,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
