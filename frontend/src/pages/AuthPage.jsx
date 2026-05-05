import { useState } from 'react';
import LoginForm from '../components/LoginForm';
import RegisterForm from '../components/RegisterForm';
import { useAuth } from '../hooks/useAuth';

/* SVG do ícone personalizado — match exato com a nova referência */
function CustomLogoIcon() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="custom-logo-svg">
      <defs>
        <linearGradient id="pillGrad" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#1e1b4b" />
        </linearGradient>
        <linearGradient id="pillStroke" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0.1)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      <g transform="rotate(-40 32 32)">
        <rect x="22" y="16" width="36" height="14" rx="7" fill="url(#pillGrad)" stroke="url(#pillStroke)" strokeWidth="1.5" />
        <rect x="6" y="34" width="36" height="14" rx="7" fill="url(#pillGrad)" stroke="url(#pillStroke)" strokeWidth="1.5" />
      </g>
    </svg>
  );
}

export default function AuthPage() {
  const [mode, setMode] = useState('login');
  const [error, setError] = useState('');
  const { login, register } = useAuth();

  const handleLogin = async (email, password) => {
    setError('');
    try { await login(email, password); }
    catch (err) { setError(err.message); }
  };

  const handleRegister = async (name, email, password) => {
    setError('');
    try { await register(name, email, password); }
    catch (err) { setError(err.message); }
  };

  return (
    <div className="auth-layout">
      {/* Animated 3D fluid blobs */}
      <div className="auth-blobs">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
        <div className="blob blob-4" />
        <div className="blob blob-5" />
        <div className="blob blob-6" />
      </div>

      <div className="auth-container">
        {/* Glass card envolvente */}
        <div className="auth-glass-panel">
          <div className="auth-header">
            <div className="auth-logo-icon">
              <CustomLogoIcon />
            </div>
            <h1>BrieflyAI</h1>
            <p>{mode === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}</p>
          </div>
          {mode === 'login' ? (
            <LoginForm onLogin={handleLogin} onSwitchToRegister={() => { setMode('register'); setError(''); }} error={error} />
          ) : (
            <RegisterForm onRegister={handleRegister} onSwitchToLogin={() => { setMode('login'); setError(''); }} error={error} />
          )}
        </div>
      </div>
    </div>
  );
}
