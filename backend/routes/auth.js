const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

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
    console.error('[AUTH] Erro no registro:', err.code || 'UNKNOWN');
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
    console.error('[AUTH] Erro no login:', err.code || 'UNKNOWN');
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
