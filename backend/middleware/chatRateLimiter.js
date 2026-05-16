const logger = require('../utils/logger');

/**
 * Rate limiter de chat por userId (in-memory).
 * Limite: 60 perguntas/dia para evitar abuso de custo do LLM.
 * Janela rolante de 24h.
 */
const DAILY_LIMIT = 60;
const WINDOW_MS = 24 * 60 * 60 * 1000;
const buckets = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [k, ts] of buckets) {
    const recent = ts.filter((t) => now - t < WINDOW_MS);
    if (recent.length === 0) buckets.delete(k);
    else buckets.set(k, recent);
  }
}, 60 * 60 * 1000).unref?.();

function chatRateLimiter(req, res, next) {
  try {
    const userId = String(req.userId);
    const now = Date.now();
    const arr = (buckets.get(userId) || []).filter((t) => now - t < WINDOW_MS);

    if (arr.length >= DAILY_LIMIT) {
      return res.status(429).json({
        error: 'Limite diário de chat atingido',
        message: `Você atingiu o limite de ${DAILY_LIMIT} perguntas nas últimas 24h.`,
        limit: DAILY_LIMIT,
        remaining: 0
      });
    }

    arr.push(now);
    buckets.set(userId, arr);

    res.setHeader('X-Chat-RateLimit-Limit', DAILY_LIMIT);
    res.setHeader('X-Chat-RateLimit-Remaining', DAILY_LIMIT - arr.length);
    next();
  } catch (err) {
    logger.error({ err: err.message }, 'chatRateLimiter falhou');
    next();
  }
}

module.exports = chatRateLimiter;
