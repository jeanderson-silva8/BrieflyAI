const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { Resend } = require('resend');
const User = require('../models/User');

const router = express.Router();
const resend = new Resend(process.env.RESEND_API_KEY);

// Garante que o banco está conectado antes de qualquer operação de auth
function ensureDbReady(res) {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ error: 'Serviço temporariamente indisponível (DB offline). Tente novamente em instantes.' });
    return false;
  }
  if (!process.env.JWT_SECRET) {
    console.error('[AUTH] FATAL: JWT_SECRET não está definido no ambiente');
    res.status(503).json({ error: 'Serviço de autenticação mal configurado' });
    return false;
  }
  return true;
}

// ═══════════════════════════════════════════════════════
// 🛡️ PROTOCOLO DE SEGURANÇA ENTERPRISE — AUTH (IAM)
// ═══════════════════════════════════════════════════════

// Helpers de Sanitização
function sanitizeString(str, maxLength = 200) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLength);
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 6 && password.length <= 128;
}

/**
 * POST /auth/register
 * Cria um novo usuário com email, nome e senha.
 */
router.post('/register', async (req, res) => {
  try {
    if (!ensureDbReady(res)) return;
    const email = sanitizeString(req.body.email, 254).toLowerCase();
    const name = sanitizeString(req.body.name, 100);
    const password = req.body.password;

    // [SEGURANÇA] Validação rigorosa de inputs
    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Formato de e-mail inválido' });
    }

    if (name.length < 2) {
      return res.status(400).json({ error: 'Nome deve ter pelo menos 2 caracteres' });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({ error: 'Senha deve ter entre 6 e 128 caracteres' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'Este e-mail já está cadastrado' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      email,
      name,
      passwordHash
    });

    // [SEGURANÇA] JWT expira em 15 minutos (antes era 7 dias)
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.status(201).json({
      token,
      user: { id: user._id, email: user.email, name: user.name }
    });
  } catch (err) {
    // [SEGURANÇA] Log Seguro — nunca expor detalhes internos
    console.error('[AUTH] Erro no registro:', err.name, '-', err.message);
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
router.post('/login', async (req, res) => {
  try {
    if (!ensureDbReady(res)) return;
    const email = sanitizeString(req.body.email, 254).toLowerCase();
    const password = req.body.password;

    // [SEGURANÇA] Validação de inputs
    if (!isValidEmail(email) || !isValidPassword(password)) {
      return res.status(400).json({ error: 'Credenciais inválidas' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // [SEGURANÇA] JWT expira em 15 minutos
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({
      token,
      user: { id: user._id, email: user.email, name: user.name }
    });
  } catch (err) {
    console.error('[AUTH] Erro no login:', err.name, '-', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * POST /auth/forgot-password
 * Gera token de recuperação, salva hash no banco, envia email via Resend.
 */
router.post('/forgot-password', async (req, res) => {
  try {
    if (!ensureDbReady(res)) return;
    const email = sanitizeString(req.body.email, 254).toLowerCase();

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Formato de e-mail inválido' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      // [SEGURANÇA] Retorna sucesso mesmo se o email não existir
      return res.json({ message: 'Se o e-mail estiver cadastrado, você receberá um link de recuperação.' });
    }

    // Gera token crypto seguro de 32 bytes
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Salva hash SHA-256 do token no banco (nunca armazena o token puro)
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
    await user.save();

    // Monta URL de recuperação
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const resetUrl = `${clientUrl}/reset-password/${resetToken}`;

    // Log no console (útil para debug)
    console.log(`\n🔑 [PASSWORD RESET] Link de recuperação gerado:`);
    console.log(`   Email: ${email}`);
    console.log(`   URL: ${resetUrl}\n`);

    // Envia email via Resend
    try {
      const { data, error: emailError } = await resend.emails.send({
        from: 'BrieflyAI <onboarding@resend.dev>',
        to: [email],
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

      if (emailError) {
        console.error('[AUTH] Erro ao enviar email Resend:', emailError);
      } else {
        console.log(`📧 [PASSWORD RESET] Email enviado com sucesso via Resend (ID: ${data?.id})`);
      }
    } catch (emailErr) {
      console.error('[AUTH] Falha ao enviar email:', emailErr.message);
      // Não falha a requisição — o link está no console como fallback
    }

    res.json({ message: 'Se o e-mail estiver cadastrado, você receberá um link de recuperação.' });
  } catch (err) {
    console.error('[AUTH] Erro no forgot-password:', err.name, '-', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * POST /auth/reset-password/:token
 * Valida token, verifica expiração, atualiza senha.
 */
router.post('/reset-password/:token', async (req, res) => {
  try {
    if (!ensureDbReady(res)) return;
    const { token } = req.params;
    const { password } = req.body;
    const tokenStr = Array.isArray(token) ? token[0] : token;

    if (!tokenStr || !password) {
      return res.status(400).json({ error: 'Token e senha são obrigatórios' });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({ error: 'Senha deve ter entre 6 e 128 caracteres' });
    }

    // Gera hash do token recebido para comparar com o banco
    const tokenHash = crypto.createHash('sha256').update(tokenStr).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Token inválido ou expirado. Solicite um novo link de recuperação.' });
    }

    // Atualiza senha e limpa campos de reset
    user.passwordHash = await bcrypt.hash(password, 12);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    console.log(`✅ [PASSWORD RESET] Senha redefinida com sucesso para: ${user.email}`);

    res.json({ message: 'Senha redefinida com sucesso! Faça login com sua nova senha.' });
  } catch (err) {
    console.error('[AUTH] Erro no reset-password:', err.name, '-', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;

