const Quota = require('../models/Quota');
const logger = require('../utils/logger');

/**
 * Rate Limiter de resumos — atômico, sem race condition.
 *
 * Usa findOneAndUpdate com condição `count: { $lt: DAILY_LIMIT }` para
 * incrementar a cota só se ainda houver folga. Operação atômica do MongoDB:
 * dois requests paralelos não conseguem ambos passar.
 *
 * Em caso de erro de banco, fail-open com log (não derruba o serviço).
 */
const DAILY_LIMIT = 5;

async function rateLimiter(req, res, next) {
  const today = new Date().toISOString().slice(0, 10);

  try {
    const quota = await Quota.findOneAndUpdate(
      { userId: req.userId, date: today, count: { $lt: DAILY_LIMIT } },
      { $inc: { count: 1 }, $setOnInsert: { userId: req.userId, date: today, createdAt: new Date() } },
      { new: true, upsert: true }
    );

    const remaining = Math.max(0, DAILY_LIMIT - quota.count);
    res.setHeader('X-RateLimit-Limit', DAILY_LIMIT);
    res.setHeader('X-RateLimit-Remaining', remaining);
    req.rateLimitRemaining = remaining;
    next();
  } catch (err) {
    // Conflito de unique index = limite atingido (upsert tentou criar doc existente
    // porque o findOneAndUpdate não casou pelo filtro count < LIMIT).
    if (err.code === 11000) {
      res.setHeader('X-RateLimit-Limit', DAILY_LIMIT);
      res.setHeader('X-RateLimit-Remaining', 0);
      return res.status(429).json({
        error: 'Limite diário atingido',
        message: `Você já usou seus ${DAILY_LIMIT} resumos de hoje. Tente novamente amanhã!`,
        limit: DAILY_LIMIT,
        remaining: 0
      });
    }
    logger.error({ err: err.message }, 'rateLimiter falhou — fail-open');
    next();
  }
}

module.exports = rateLimiter;
