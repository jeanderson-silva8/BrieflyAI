import { createContext, useState, useEffect, useCallback, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const AuthContext = createContext(null);

// ═══════════════════════════════════════════════════════
// 🛡️ AUTH CONTEXT — Token em memória + Refresh via cookie httpOnly
// ═══════════════════════════════════════════════════════
// Access token NUNCA fica em localStorage (previne XSS).
// Refresh token vive em cookie httpOnly (JS não consegue ler).
// No reload da página, faz refresh silencioso para obter novo access token.

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null); // [SEGURANÇA] Em memória, não localStorage
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const refreshTimerRef = useRef(null);

  /**
   * Agenda refresh automático 1 minuto antes do access token expirar.
   */
  const scheduleRefresh = useCallback((expiresInMs = 14 * 60 * 1000) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    // Renova 1 minuto antes de expirar (14 min para token de 15 min)
    const refreshIn = Math.max(expiresInMs - 60 * 1000, 30 * 1000);
    refreshTimerRef.current = setTimeout(() => silentRefresh(), refreshIn);
  }, []);

  /**
   * Refresh silencioso — usa o cookie httpOnly para obter novo access token.
   */
  const silentRefresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // Envia cookies httpOnly
        headers: { 'Content-Type': 'application/json' }
      });

      if (!res.ok) {
        // Refresh falhou — sessão expirada, limpa tudo
        setToken(null);
        setUser(null);
        return null;
      }

      const data = await res.json();
      setToken(data.token);
      setUser(data.user);
      scheduleRefresh();
      return data.token;
    } catch {
      setToken(null);
      setUser(null);
      return null;
    }
  }, [scheduleRefresh]);

  // No mount, tenta refresh silencioso (restaura sessão após reload)
  useEffect(() => {
    silentRefresh().finally(() => setLoading(false));
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  const login = async (email, password) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      credentials: 'include', // Recebe cookie httpOnly
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro no login');
    setToken(data.token); // Em memória, não localStorage
    setUser(data.user);
    scheduleRefresh();
    return data;
  };

  const register = async (name, email, password) => {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      credentials: 'include', // Recebe cookie httpOnly
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro no registro');
    setToken(data.token); // Em memória, não localStorage
    setUser(data.user);
    scheduleRefresh();
    return data;
  };

  const forgotPassword = async (email) => {
    const res = await fetch(`${API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao solicitar recuperação');
    setSuccessMessage(data.message);
    return data;
  };

  const resetPassword = async (resetToken, password) => {
    const res = await fetch(`${API_URL}/auth/reset-password/${resetToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao redefinir senha');
    setSuccessMessage(data.message);
    return data;
  };

  const clearSuccess = () => setSuccessMessage('');

  const logout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch { /* ignora erro de rede no logout */ }
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    setToken(null);
    setUser(null);
    // Limpa legado do localStorage (migração)
    localStorage.removeItem('brieflyai_token');
    localStorage.removeItem('brieflyai_user');
  };

  return (
    <AuthContext.Provider value={{ 
      user, token, loading, login, register, logout, 
      forgotPassword, resetPassword, successMessage, clearSuccess,
      isAuthenticated: !!token,
      silentRefresh
    }}>
      {children}
    </AuthContext.Provider>
  );
}
