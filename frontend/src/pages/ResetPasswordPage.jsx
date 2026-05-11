import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

/* SVG do ícone personalizado — mesmo da AuthPage */
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

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { resetPassword } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => navigate('/'), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
        <div className="auth-glass-panel">
          <div className="auth-header">
            <div className="auth-logo-icon">
              <CustomLogoIcon />
            </div>
            <h1>BrieflyAI</h1>
            <p>{success ? 'Senha redefinida!' : 'Nova senha'}</p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="auth-card glass-card">
              {success ? (
                <div className="auth-success-block">
                  <CheckCircle size={48} className="auth-success-icon" />
                  <h3>Senha redefinida com sucesso!</h3>
                  <p>Você será redirecionado para o login em instantes...</p>
                </div>
              ) : (
                <>
                  <div className="auth-subtitle">
                    Digite sua nova senha abaixo.
                  </div>
                  <form className="auth-form" onSubmit={handleSubmit}>
                    {error && <div className="auth-error">{error}</div>}
                    <div className="form-group">
                      <input
                        id="reset-password"
                        type="password"
                        className="input-field auth-input"
                        placeholder="Nova senha"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        autoFocus
                      />
                    </div>
                    <div className="form-group">
                      <input
                        id="reset-confirm-password"
                        type="password"
                        className="input-field auth-input"
                        placeholder="Confirmar nova senha"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                    </div>
                    <button type="submit" className="btn btn-primary auth-submit-btn" disabled={loading}>
                      {loading ? <><span className="spinner" /> Redefinindo...</> : 'Redefinir senha'}
                    </button>
                  </form>
                </>
              )}
              <div className="auth-back-link">
                <button type="button" onClick={() => navigate('/')}>
                  <ArrowLeft size={14} />
                  Voltar ao login
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
