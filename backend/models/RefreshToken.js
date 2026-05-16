const mongoose = require('mongoose');

/**
 * RefreshToken Model
 * Armazena refresh tokens hasheados com controle de família para detecção de roubo.
 * 
 * Segurança:
 * - Token real NUNCA é armazenado — apenas hash SHA-256
 * - Família (familyId) permite revogar toda a cadeia se reuso for detectado
 * - TTL index auto-deleta tokens expirados do banco
 */
const refreshTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  tokenHash: {
    type: String,
    required: true,
    unique: true
  },
  familyId: {
    type: String,
    required: true,
    index: true
  },
  isRevoked: {
    type: Boolean,
    default: false
  },
  expiresAt: {
    type: Date,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// TTL index — MongoDB auto-deleta documentos expirados
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
