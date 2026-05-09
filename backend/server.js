require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const summarizeRoutes = require('./routes/summarize');
const chatRoutes = require('./routes/chat');
const historyRoutes = require('./routes/history');
const transcribeRoutes = require('./routes/transcribe');

const app = express();
const PORT = process.env.PORT || 3001;

// [BOOT] Validação de variáveis de ambiente críticas
const REQUIRED_ENV = ['JWT_SECRET', 'MONGO_URI'];
const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missingEnv.length) {
  console.error(`[BOOT] FALTAM variáveis de ambiente: ${missingEnv.join(', ')}`);
  console.error('[BOOT] Configure-as no painel do Render antes de prosseguir.');
}

// ═══════════════════════════════════════════════════════
// 🛡️ PROTOCOLO DE SEGURANÇA ENTERPRISE — BRIEFLYAI
// ═══════════════════════════════════════════════════════

// [SEGURANÇA] Headers HTTP de proteção (Helmet)
app.use(helmet());

// [SEGURANÇA] CORS Restrito — combina env var + URLs fixas (à prova de falhas)
const FIXED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://briefly-ai-nine.vercel.app'
];
const envOrigins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [];
const allowedOrigins = [...new Set([...FIXED_ORIGINS, ...envOrigins])];

// Regex permite previews/deploys da Vercel do projeto BrieflyAI
const VERCEL_PREVIEW_REGEX = /^https:\/\/briefly[\w-]*\.vercel\.app$/;

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || VERCEL_PREVIEW_REGEX.test(origin)) {
      return callback(null, true);
    }
    console.warn('[CORS] Origem bloqueada:', origin);
    return callback(new Error('Bloqueado pela política de CORS'));
  },
  credentials: true
}));

// [SEGURANÇA] Rate Limiting Global — Proteção contra DDoS
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' }
});
app.use(globalLimiter);

// [SEGURANÇA] Rate Limiting de Login — Anti Força Bruta
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Aguarde 1 minuto.' }
});

app.use(express.json({ limit: '10mb' })); // Mantém 10mb para uploads de transcrição

// Rotas
app.use('/auth', authLimiter, authRoutes);
app.use('/api/summarize', summarizeRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/transcribe', transcribeRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', mongo: mongoose.connection.readyState === 1, timestamp: new Date().toISOString() });
});

// Conexão com MongoDB e start do servidor
const startServer = () => {
  app.listen(PORT, () => {
    console.log(`🚀 BrieflyAI Backend rodando na porta ${PORT}`);
  });
};

mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
})
  .then(() => {
    // [SEGURANÇA] Log Seguro — mostra apenas status, nunca a URI
    console.log('[DB] MongoDB conectado com sucesso');
    startServer();
  })
  .catch((err) => {
    // [SEGURANÇA] Log Seguro — não imprime err.message (pode conter URI)
    console.warn('[DB] MongoDB não conectou. Verifique MONGO_URI no .env');
    console.warn('[DB] Iniciando servidor SEM banco de dados (modo offline)...');
    startServer();
  });
