import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export default function LoginForm({ onLogin, onSwitchToRegister, error }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onLogin(email, password);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }}>
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
            <div className="password-wrapper">
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
              <button type="button" className="forgot-password-btn" tabIndex={-1}>
                Esqueceu a senha?
              </button>
            </div>
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
  );
}
