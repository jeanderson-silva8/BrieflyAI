const AuditLog = require('../models/AuditLog');
const logger = require('./logger');

/**
 * Registra evento de auditoria sem bloquear a request.
 * Falhas de persistência são logadas mas não propagadas.
 */
function audit(req, action, extra = {}) {
  const entry = {
    action,
    userId: req?.userId || extra.userId || null,
    ip: req?.ip || null,
    userAgent: req?.headers?.['user-agent']?.slice(0, 300) || null,
    requestId: req?.id || null,
    targetType: extra.targetType || null,
    targetId: extra.targetId || null,
    metadata: extra.metadata || {}
  };

  AuditLog.create(entry).catch((err) => {
    logger.error({ err: err.message, action }, 'Falha ao gravar audit log');
  });
}

module.exports = audit;
