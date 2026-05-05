const Summary = require('../models/Summary');

/**
 * Rate Limiter: Controla quantos resumos o usuário pode fazer por dia.
 * Limite free: 5 resumos/dia.
 * Retorna headers X-RateLimit-Limit e X-RateLimit-Remaining.
 */
const DAILY_LIMIT = 5;

async function rateLimiter(req, res, next) {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const count = await Summary.countDocuments({
      userId: req.userId,
      createdAt: { $gte: startOfDay }
    });

    const remaining = Math.max(0, DAILY_LIMIT - count);

    res.setHeader('X-RateLimit-Limit', DAILY_LIMIT);
    res.setHeader('X-RateLimit-Remaining', remaining);

    if (count >= DAILY_LIMIT) {
      return res.status(429).json({
        error: 'Limite diário atingido',
        message: `Você já usou seus ${DAILY_LIMIT} resumos de hoje. Tente novamente amanhã!`,
        limit: DAILY_LIMIT,
        remaining: 0
      });
    }

    req.rateLimitRemaining = remaining;
    next();
  } catch (err) {
    console.error('Erro no rate limiter:', err);
    next();
  }
}

module.exports = rateLimiter;
