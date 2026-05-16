const logger = require('../utils/logger');

/**
 * Defesa em profundidade contra CSRF para endpoints que aceitam cookies.
 * Valida o header Origin (ou Referer como fallback) contra a allowlist do app.
 * sameSite=strict já cobre o caso comum; este check fecha edge cases
 * (sameSite=lax em dev, navegadores antigos, comportamento inconsistente).
 */
const FIXED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://briefly-ai-nine.vercel.app'
];
const VERCEL_PREVIEW_REGEX = /^https:\/\/briefly[\w-]*\.vercel\.app$/;

function isAllowed(origin) {
  if (!origin) return false;
  const envOrigins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [];
  if (FIXED_ORIGINS.includes(origin) || envOrigins.includes(origin)) return true;
  return VERCEL_PREVIEW_REGEX.test(origin);
}

function csrfCheck(req, res, next) {
  // GET/HEAD não mutam estado; pular
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const source = origin || (referer ? new URL(referer).origin : null);

  if (!source || !isAllowed(source)) {
    logger.warn({ origin, referer, ip: req.ip, requestId: req.id }, 'CSRF block — Origin/Referer não permitido');
    return res.status(403).json({ error: 'Origem não permitida' });
  }
  next();
}

module.exports = csrfCheck;
