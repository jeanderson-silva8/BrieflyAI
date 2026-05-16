const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Correlation ID por request:
 * - Aceita X-Request-ID do cliente (UUID v4) ou gera um novo
 * - Expõe req.id, req.log (child logger com requestId)
 * - Retorna no header X-Request-ID
 */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requestId(req, res, next) {
  const incoming = req.headers['x-request-id'];
  req.id = (typeof incoming === 'string' && UUID_V4.test(incoming))
    ? incoming
    : crypto.randomUUID();
  res.setHeader('X-Request-ID', req.id);
  req.log = logger.child({ requestId: req.id });
  next();
}

module.exports = requestId;
