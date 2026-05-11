import { createContext, useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('brieflyai_token'));
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const savedUser = localStorage.getItem('brieflyai_user');
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch { setUser(null); }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro no login');
    localStorage.setItem('brieflyai_token', data.token);
    localStorage.setItem('brieflyai_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const register = async (name, email, password) => {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro no registro');
    localStorage.setItem('brieflyai_token', data.token);
    localStorage.setItem('brieflyai_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
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

  const resetPassword = async (token, password) => {
    const res = await fetch(`${API_URL}/auth/reset-password/${token}`, {
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

  const logout = () => {
    localStorage.removeItem('brieflyai_token');
    localStorage.removeItem('brieflyai_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ 
      user, token, loading, login, register, logout, 
      forgotPassword, resetPassword, successMessage, clearSuccess,
      isAuthenticated: !!token 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

