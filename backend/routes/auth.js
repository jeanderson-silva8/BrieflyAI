const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { Resend } = require('resend');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const validate = require('../middleware/validate');
const {
  registerSchema, loginSchema,
  forgotPasswordSchema, resetPasswordBodySchema, resetPasswordParamsSchema
} = require('../middleware/schemas');
const logger = require('../utils/logger');
const audit = require('../utils/audit');
const { isPasswordBreached } = require('../utils/hibp');
const csrfCheck = require('../middleware/csrfCheck');

const router = express.Router();

// ═══════════════════════════════════════════════════════
// 📧 Resend API — Envio via HTTP (funciona no Render Free Tier)
// O Render bloqueia portas SMTP (25, 465, 587).
// O Resend usa HTTPS (porta 443) — sem bloqueio.
// ═══════════════════════════════════════════════════════
const resend = new Resend(process.env.RESEND_API_KEY);

// Garante que o banco está conectado antes de qualquer operação de auth
function ensureDbReady(res) {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ error: 'Serviço temporariamente indisponível (DB offline). Tente novamente em instantes.' });
    return false;
  }
  if (!process.env.JWT_SECRET) {
    logger.fatal('JWT_SECRET não está definido no ambiente');
    res.status(503).json({ error: 'Serviço de autenticação mal configurado' });
    return false;
  }
  return true;
}

// ═══════════════════════════════════════════════════════
// Camada de autenticação — bcrypt + JWT HS256 + refresh rotation
// ═══════════════════════════════════════════════════════

// [SEGURANÇA] Mascara email nos logs para evitar vazamento de PII
function maskEmail(email) {
  if (!email || !email.includes('@')) return '***';
  const [local, domain] = email.split('@');
  const maskedLocal = local.length <= 2 ? '*'.repeat(local.length) : local[0] + '*'.repeat(local.length - 2) + local[local.length - 1];
  return `${maskedLocal}@${domain}`;
}

// ═══════════════════════════════════════════════════════
// 🔄 REFRESH TOKEN — Helpers
// ═══════════════════════════════════════════════════════
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * Gera um refresh token seguro, salva hash no banco e retorna o token raw.
 */
async function generateRefreshToken(userId, familyId = null) {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const family = familyId || crypto.randomBytes(16).toString('hex');

  await RefreshToken.create({
    userId,
    tokenHash,
    familyId: family,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
  });

  return { rawToken, familyId: family };
}

/**
 * Seta o refresh token como cookie httpOnly seguro.
 */
function setRefreshCookie(res, rawToken) {
  res.cookie('brieflyai_refresh', rawToken, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: IS_PRODUCTION ? 'strict' : 'lax',
    path: '/auth',
    maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  });
}

function clearRefreshCookie(res) {
  res.clearCookie('brieflyai_refresh', {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: IS_PRODUCTION ? 'strict' : 'lax',
    path: '/auth'
  });
}

/**
 * POST /auth/register
 * Cria um novo usuário com email, nome e senha.
 */
router.post('/register', validate({ body: registerSchema }), async (req, res) => {
  try {
    if (!ensureDbReady(res)) return;
    // Zod já validou, sanitizou e transformou (trim + lowercase)
    const { email, name, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'Este e-mail já está cadastrado' });
    }

    // [SEGURANÇA] HIBP — bloqueia senhas conhecidas em vazamentos
    const { breached, count } = await isPasswordBreached(password);
    if (breached) {
      return res.status(400).json({
        error: `Esta senha aparece em ${count.toLocaleString('pt-BR')} vazamentos públicos. Escolha uma senha diferente.`
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      email,
      name,
      passwordHash
    });

    // [SEGURANÇA] Access Token curto (15 min) + Refresh Token longo (7 dias)
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '15m', algorithm: 'HS256' }
    );

    // Gera refresh token e seta como cookie httpOnly
    const { rawToken } = await generateRefreshToken(user._id);
    setRefreshCookie(res, rawToken);

    req.userId = user._id;
    audit(req, 'auth.register', { targetType: 'User', targetId: user._id });

    res.status(201).json({
      token,
      user: { id: user._id, email: user.email, name: user.name }
    });
  } catch (err) {
    // [SEGURANÇA] Log Seguro — nunca expor detalhes internos
    logger.error({ err: err.name }, `Erro no registro: ${err.message}`);
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Este e-mail já está cadastrado' });
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * POST /auth/login
 * Valida credenciais e retorna JWT (expiração 15 minutos).
 */
router.post('/login', validate({ body: loginSchema }), async (req, res) => {
  try {
    if (!ensureDbReady(res)) return;
    // Zod já validou e transformou
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      audit(req, 'auth.login.failure', { metadata: { reason: 'unknown_email' } });
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      audit(req, 'auth.login.failure', { userId: user._id, metadata: { reason: 'bad_password' } });
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // [SEGURANÇA] Access Token curto (15 min) + Refresh Token longo (7 dias)
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '15m', algorithm: 'HS256' }
    );

    // Gera refresh token e seta como cookie httpOnly
    const { rawToken } = await generateRefreshToken(user._id);
    setRefreshCookie(res, rawToken);

    req.userId = user._id;
    audit(req, 'auth.login.success', { targetType: 'User', targetId: user._id });

    res.json({
      token,
      user: { id: user._id, email: user.email, name: user.name }
    });
  } catch (err) {
    logger.error({ err: err.name }, `Erro no login: ${err.message}`);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * POST /auth/forgot-password
 * Gera token de recuperação, salva hash no banco, envia email via Gmail SMTP.
 */
router.post('/forgot-password', validate({ body: forgotPasswordSchema }), async (req, res) => {
  try {
    if (!ensureDbReady(res)) return;
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // [SEGURANÇA] Retorna sucesso mesmo se o email não existir
      return res.json({ message: 'Se o e-mail estiver cadastrado, você receberá um link de recuperação.' });
    }
    audit(req, 'auth.password.reset_requested', { userId: user._id, targetType: 'User', targetId: user._id });

    // Gera token crypto seguro de 32 bytes
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Salva hash SHA-256 do token no banco (nunca armazena o token puro)
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
    await user.save();

    // Monta URL de recuperação
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const resetUrl = `${clientUrl}/reset-password/${resetToken}`;

    // [SEGURANÇA] Log seguro — mascara email, nunca loga URL de reset em produção
    if (process.env.NODE_ENV !== 'production') {
      logger.info({ email: maskEmail(email), url: resetUrl }, 'Password reset link gerado');
    } else {
      logger.info({ email: maskEmail(email) }, 'Password reset solicitado');
    }

    // Envia email via Resend API (HTTP — funciona no Render Free Tier)
    try {
      const { data, error } = await resend.emails.send({
        from: 'BrieflyAI <onboarding@resend.dev>',
        to: email,
        subject: '🔐 Recuperação de Senha — BrieflyAI',
        html: `
          <div style="max-width:520px;margin:0 auto;font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;background:#0a0a0f;padding:40px 32px;border-radius:16px;border:1px solid rgba(108,99,255,0.2);">
            <div style="text-align:center;margin-bottom:32px;">
              <h1 style="color:#ffffff;font-size:28px;font-weight:700;margin:0 0 8px;letter-spacing:-0.02em;">BrieflyAI</h1>
              <p style="color:rgba(255,255,255,0.5);font-size:14px;margin:0;">Recuperação de Senha</p>
            </div>
            <p style="color:#E8E8F0;font-size:15px;line-height:1.6;margin-bottom:8px;">Olá <strong>${user.name}</strong>,</p>
            <p style="color:#8888A0;font-size:14px;line-height:1.6;margin-bottom:28px;">Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo para criar uma nova senha:</p>
            <div style="text-align:center;margin-bottom:28px;">
              <a href="${resetUrl}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#6C63FF 0%,#00D9FF 100%);color:white;font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;box-shadow:0 4px 20px rgba(108,99,255,0.3);">Redefinir minha senha</a>
            </div>
            <p style="color:#55556A;font-size:12px;line-height:1.6;margin-bottom:4px;">⏰ Este link expira em <strong style="color:#8888A0;">1 hora</strong>.</p>
            <p style="color:#55556A;font-size:12px;line-height:1.6;">Se você não solicitou esta alteração, ignore este e-mail com segurança.</p>
            <hr style="border:none;border-top:1px solid rgba(108,99,255,0.15);margin:24px 0 16px;">
            <p style="color:#55556A;font-size:11px;text-align:center;">© ${new Date().getFullYear()} BrieflyAI — Inteligência que resume, decisões que transformam.</p>
          </div>
        `
      });

      if (error) {
        logger.error({ err: error.message }, 'Resend API erro');
      } else {
        logger.info({ email: maskEmail(email), resendId: data?.id }, 'Email de reset enviado');
      }
    } catch (emailErr) {
      logger.error({ err: emailErr.message }, 'Falha ao enviar email de reset');
      // Não falha a requisição — o link está no console como fallback
    }

    res.json({ message: 'Se o e-mail estiver cadastrado, você receberá um link de recuperação.' });
  } catch (err) {
    logger.error({ err: err.name }, `Erro no forgot-password: ${err.message}`);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * POST /auth/reset-password/:token
 * Valida token, verifica expiração, atualiza senha.
 */
router.post('/reset-password/:token', validate({ params: resetPasswordParamsSchema, body: resetPasswordBodySchema }), async (req, res) => {
  try {
    if (!ensureDbReady(res)) return;
    const { token } = req.params;
    const { password } = req.body;
    const tokenStr = Array.isArray(token) ? token[0] : token;

    // Gera hash do token recebido para comparar com o banco
    const tokenHash = crypto.createHash('sha256').update(tokenStr).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Token inválido ou expirado. Solicite um novo link de recuperação.' });
    }

    // [SEGURANÇA] HIBP — bloqueia senhas conhecidas em vazamentos
    const { breached, count } = await isPasswordBreached(password);
    if (breached) {
      return res.status(400).json({
        error: `Esta senha aparece em ${count.toLocaleString('pt-BR')} vazamentos públicos. Escolha uma senha diferente.`
      });
    }

    // Atualiza senha e limpa campos de reset
    user.passwordHash = await bcrypt.hash(password, 12);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    audit(req, 'auth.password.reset_completed', { userId: user._id, targetType: 'User', targetId: user._id });
    logger.info({ email: maskEmail(user.email) }, 'Senha redefinida com sucesso');

    res.json({ message: 'Senha redefinida com sucesso! Faça login com sua nova senha.' });
  } catch (err) {
    logger.error({ err: err.name }, `Erro no reset-password: ${err.message}`);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ═══════════════════════════════════════════════════════
// 🔄 REFRESH TOKEN — Endpoints
// ═══════════════════════════════════════════════════════

/**
 * POST /auth/refresh
 * Usa o refresh token do cookie httpOnly para emitir um novo access token.
 * Implementa Refresh Token Rotation: cada uso gera um novo refresh token.
 * Detecta reuso de token revogado (possível roubo) e revoga toda a família.
 */
router.post('/refresh', csrfCheck, async (req, res) => {
  try {
    if (!ensureDbReady(res)) return;

    const rawToken = req.cookies?.brieflyai_refresh;
    if (!rawToken) {
      return res.status(401).json({ error: 'Refresh token ausente' });
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const storedToken = await RefreshToken.findOne({ tokenHash });

    // Token não encontrado no banco
    if (!storedToken) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Refresh token inválido' });
    }

    // [SEGURANÇA] Detecção de reuso — possível roubo de token
    if (storedToken.isRevoked) {
      // Revoga TODA a família (todos os tokens derivados)
      await RefreshToken.updateMany(
        { familyId: storedToken.familyId },
        { isRevoked: true }
      );
      clearRefreshCookie(res);
      audit(req, 'auth.refresh.reuse_detected', { userId: storedToken.userId, metadata: { familyId: storedToken.familyId } });
      logger.warn({ familyId: storedToken.familyId, userId: storedToken.userId }, 'ALERTA: Reuso de refresh token detectado! Família revogada');
      return res.status(401).json({ error: 'Sessão comprometida. Faça login novamente.' });
    }

    // Token expirado
    if (storedToken.expiresAt < new Date()) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
    }

    // Verifica se o usuário ainda existe
    const user = await User.findById(storedToken.userId);
    if (!user) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    // [ROTATION] Revoga o token atual e emite um novo na mesma família
    storedToken.isRevoked = true;
    await storedToken.save();

    const { rawToken: newRawToken } = await generateRefreshToken(user._id, storedToken.familyId);
    setRefreshCookie(res, newRawToken);

    // Novo access token
    const accessToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '15m', algorithm: 'HS256' }
    );

    res.json({
      token: accessToken,
      user: { id: user._id, email: user.email, name: user.name }
    });
  } catch (err) {
    logger.error({ err: err.name }, `Erro no refresh: ${err.message}`);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * POST /auth/logout
 * Revoga o refresh token atual e limpa o cookie.
 */
router.post('/logout', csrfCheck, async (req, res) => {
  try {
    const rawToken = req.cookies?.brieflyai_refresh;
    if (rawToken) {
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const revoked = await RefreshToken.findOneAndUpdate({ tokenHash }, { isRevoked: true });
      if (revoked) audit(req, 'auth.logout', { userId: revoked.userId });
    }
    clearRefreshCookie(res);
    res.json({ message: 'Logout realizado com sucesso' });
  } catch (err) {
    logger.error({ err: err.name }, `Erro no logout: ${err.message}`);
    clearRefreshCookie(res);
    res.json({ message: 'Logout realizado' });
  }
});

// ═══════════════════════════════════════════════════════
// 🗑️ LGPD — Exclusão de conta e portabilidade
// ═══════════════════════════════════════════════════════

const authMiddleware = require('../middleware/authMiddleware');
const Summary = require('../models/Summary');

/**
 * DELETE /auth/account
 * Direito ao esquecimento (LGPD Art. 18 VI / GDPR Art. 17).
 * - Soft-delete dos resumos do usuário
 * - Revoga TODOS os refresh tokens
 * - Remove o User
 * - Audit log preservado
 */
router.delete('/account', authMiddleware, async (req, res) => {
  try {
    if (!ensureDbReady(res)) return;

    await Summary.updateMany(
      { userId: req.userId, deletedAt: null },
      { deletedAt: new Date() }
    );
    await RefreshToken.updateMany({ userId: req.userId }, { isRevoked: true });
    await User.findByIdAndDelete(req.userId);

    audit(req, 'account.delete', { userId: req.userId, targetType: 'User', targetId: req.userId });

    clearRefreshCookie(res);
    res.json({ message: 'Conta excluída. Seus dados serão apagados definitivamente em 30 dias.' });
  } catch (err) {
    logger.error({ err: err.name }, `Erro em DELETE /account: ${err.message}`);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /auth/account/export
 * Portabilidade (LGPD Art. 18 V / GDPR Art. 20).
 */
router.get('/account/export', authMiddleware, async (req, res) => {
  try {
    if (!ensureDbReady(res)) return;
    const user = await User.findById(req.userId).lean();
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    delete user.passwordHash;
    delete user.resetPasswordToken;
    delete user.resetPasswordExpires;

    const summaries = await Summary.find({ userId: req.userId, deletedAt: null }).lean();

    audit(req, 'account.export', { userId: req.userId, targetType: 'User', targetId: req.userId });
    res.setHeader('Content-Disposition', 'attachment; filename="brieflyai-export.json"');
    res.json({ exportedAt: new Date().toISOString(), user, summaries });
  } catch (err) {
    logger.error({ err: err.name }, `Erro em GET /account/export: ${err.message}`);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
