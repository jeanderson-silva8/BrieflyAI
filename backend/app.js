/**
 * Configuração do Express app — separado do server.js para permitir
 * import nos testes (Supertest) sem iniciar o servidor HTTP.
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth');
const summarizeRoutes = require('./routes/summarize');
const chatRoutes = require('./routes/chat');
const historyRoutes = require('./routes/history');
const transcribeRoutes = require('./routes/transcribe');
const logger = require('./utils/logger');
const requestId = require('./middleware/requestId');
const { register: metricsRegister, metricsMiddleware } = require('./utils/metrics');

const app = express();

// [OBSERVABILIDADE] Correlation ID + métricas Prometheus
app.use(requestId);
app.use(metricsMiddleware);

// [SEGURANÇA] Headers HTTP de proteção (Helmet) com CSP estrita.
// A API é JSON-only — não serve HTML — então defaultSrc 'none' é seguro.
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"]
    }
  },
  strictTransportSecurity: { maxAge: 63072000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'no-referrer' },
  crossOriginResourcePolicy: { policy: 'same-site' }
}));

// [SEGURANÇA] CORS Restrito
const FIXED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://briefly-ai-nine.vercel.app'
];
const envOrigins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [];
const allowedOrigins = [...new Set([...FIXED_ORIGINS, ...envOrigins])];
const VERCEL_PREVIEW_REGEX = /^https:\/\/briefly[\w-]*\.vercel\.app$/;

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || VERCEL_PREVIEW_REGEX.test(origin)) {
      return callback(null, true);
    }
    logger.warn({ origin }, 'CORS bloqueado');
    return callback(new Error('Bloqueado pela política de CORS'));
  },
  credentials: true
}));

// [SEGURANÇA] Rate Limiting Global
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' }
});
app.use(globalLimiter);

// [SEGURANÇA] Rate Limiting de Login (desativado em testes para não envenenar a suite)
const authLimiter = process.env.NODE_ENV === 'test'
  ? (req, res, next) => next()
  : rateLimit({
      windowMs: 60 * 1000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Muitas tentativas de login. Aguarde 1 minuto.' }
    });

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));

// Rotas
app.use('/auth', authLimiter, authRoutes);
app.use('/api/summarize', summarizeRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/transcribe', transcribeRoutes);

// Health checks (liveness vs readiness)
app.get('/health/live', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/health/ready', (req, res) => {
  const mongoose = require('mongoose');
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    mongo: ready,
    timestamp: new Date().toISOString()
  });
});
// [OBSERVABILIDADE] Endpoint Prometheus — protegido por token simples (METRICS_TOKEN)
app.get('/metrics', async (req, res) => {
  const expected = process.env.METRICS_TOKEN;
  if (expected && req.headers['authorization'] !== `Bearer ${expected}`) {
    return res.status(401).end();
  }
  res.set('Content-Type', metricsRegister.contentType);
  res.end(await metricsRegister.metrics());
});

// Legado — mantém /health para compatibilidade com probes existentes
app.get('/health', (req, res) => {
  const mongoose = require('mongoose');
  res.json({ status: 'ok', mongo: mongoose.connection.readyState === 1, timestamp: new Date().toISOString() });
});

// [SEGURANÇA] Global Error Handler
app.use((err, req, res, next) => {
  if (err.isOperational) {
    logger.error({ err: err.name }, `AppError: ${err.message}`);
    return res.status(err.statusCode).json({ error: err.message });
  }
  if (err.name === 'ZodError') {
    return res.status(400).json({ error: 'Dados de entrada inválidos' });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'ID de recurso inválido' });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: 'Dados de entrada inválidos' });
  }
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
  logger.error({ err: err.name, stack: err.stack }, `Unhandled: ${err.message}`);
  res.status(500).json({
    error: 'Erro interno do servidor',
    ...(process.env.NODE_ENV !== 'production' && { detail: err.message })
  });
});

module.exports = app;
