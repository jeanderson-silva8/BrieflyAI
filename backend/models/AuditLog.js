const mongoose = require('mongoose');

/**
 * Audit log imutável para ações sensíveis.
 * Sem updateMany/findOneAndUpdate na aplicação — apenas inserts.
 * TTL opcional: 1 ano (configurável via env AUDIT_LOG_TTL_DAYS).
 */
const auditLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  action: {
    type: String,
    required: true,
    enum: [
      'auth.login.success',
      'auth.login.failure',
      'auth.register',
      'auth.logout',
      'auth.refresh.reuse_detected',
      'auth.password.reset_requested',
      'auth.password.reset_completed',
      'summary.delete',
      'summary.create'
    ],
    index: true
  },
  targetType: { type: String, default: null },
  targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
  ip: { type: String, default: null },
  userAgent: { type: String, default: null },
  requestId: { type: String, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now, index: true }
});

// TTL: remove entradas após N dias (default 365)
const ttlDays = Number(process.env.AUDIT_LOG_TTL_DAYS || 365);
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: ttlDays * 86400 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
