import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function LoginForm({ onLogin, onSwitchToRegister, error }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

  const { forgotPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onLogin(email, password);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');
    setForgotLoading(true);
    try {
      const result = await forgotPassword(forgotEmail);
      setForgotSuccess(result.message);
    } catch (err) {
      setForgotError(err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  const switchToForgot = () => {
    setIsForgotMode(true);
    setForgotEmail(email); // Preenche com email do login se já digitou
    setForgotError('');
    setForgotSuccess('');
  };

  const switchToLogin = () => {
    setIsForgotMode(false);
    setForgotError('');
    setForgotSuccess('');
  };

  return (
    <AnimatePresence mode="wait">
      {!isForgotMode ? (
        /* ── FORMULÁRIO DE LOGIN ── */
        <motion.div
          key="login"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4 }}
        >
          <div className="auth-card glass-card">
            <form className="auth-form" onSubmit={handleSubmit}>
              {error && <div className="auth-error">{error}</div>}
              <div className="form-group">
                <input
                  id="login-email"
                  type="email"
                  className="input-field auth-input"
                  placeholder="Endereço de e-mail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <input
                  id="login-password"
                  type="password"
                  className="input-field auth-input"
                  placeholder="Senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div className="auth-forgot-link">
                <button type="button" onClick={switchToForgot}>
                  Esqueceu a senha?
                </button>
              </div>
              <button type="submit" className="btn btn-primary auth-submit-btn" disabled={loading}>
                {loading ? <><span className="spinner" /> Entrando...</> : 'Entrar'}
              </button>
            </form>
            <div className="auth-toggle">
              Ainda não tem conta?{' '}
              <button type="button" onClick={onSwitchToRegister}>Cadastre-se</button>
            </div>
          </div>
        </motion.div>
      ) : (
        /* ── FORMULÁRIO ESQUECI MINHA SENHA ── */
        <motion.div
          key="forgot"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4 }}
        >
          <div className="auth-card glass-card">
            <div className="auth-subtitle">
              Digite seu e-mail e enviaremos um link para redefinir sua senha.
            </div>
            <form className="auth-form" onSubmit={handleForgotSubmit}>
              {forgotError && <div className="auth-error">{forgotError}</div>}
              {forgotSuccess && <div className="auth-success">{forgotSuccess}</div>}
              <div className="form-group">
                <input
                  id="forgot-email"
                  type="email"
                  className="input-field auth-input"
                  placeholder="Endereço de e-mail"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <button type="submit" className="btn btn-primary auth-submit-btn" disabled={forgotLoading}>
                {forgotLoading ? <><span className="spinner" /> Enviando...</> : 'Enviar link de recuperação'}
              </button>
            </form>
            <div className="auth-back-link">
              <button type="button" onClick={switchToLogin}>
                <ArrowLeft size={14} />
                Voltar ao login
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
