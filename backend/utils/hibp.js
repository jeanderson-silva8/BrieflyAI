const crypto = require('crypto');
const logger = require('./logger');

/**
 * Have I Been Pwned — verificação de senha vazada via k-anonymity.
 * Envia apenas os 5 primeiros chars do SHA-1 da senha; a senha em si nunca sai.
 * Fail-open: se a API estiver fora, NÃO bloqueia o cadastro.
 *
 * @returns {Promise<{breached: boolean, count: number}>}
 */
async function isPasswordBreached(password) {
  if (process.env.HIBP_DISABLED === 'true') return { breached: false, count: 0 };

  try {
    const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      signal: ctrl.signal,
      headers: { 'Add-Padding': 'true', 'User-Agent': 'BrieflyAI-Security' }
    });
    clearTimeout(t);

    if (!res.ok) {
      logger.warn({ status: res.status }, 'HIBP indisponível — permitindo cadastro (fail-open)');
      return { breached: false, count: 0 };
    }

    const text = await res.text();
    for (const line of text.split('\n')) {
      const [hashSuffix, countStr] = line.trim().split(':');
      if (hashSuffix === suffix) {
        const count = parseInt(countStr, 10) || 1;
        return { breached: count > 0, count };
      }
    }
    return { breached: false, count: 0 };
  } catch (err) {
    logger.warn({ err: err.message }, 'HIBP falhou — permitindo cadastro (fail-open)');
    return { breached: false, count: 0 };
  }
}

module.exports = { isPasswordBreached };
