const mongoose = require('mongoose');

/**
 * Cota diária por usuário (atomic counter).
 * Usada pelo rate limiter de resumos para evitar race condition
 * no padrão "count → check → write".
 *
 * Chave única (userId, date) + TTL de 2 dias para auto-limpeza.
 */
const quotaSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // 'YYYY-MM-DD' em UTC
  count: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

quotaSchema.index({ userId: 1, date: 1 }, { unique: true });
quotaSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2 * 86400 });

module.exports = mongoose.model('Quota', quotaSchema);
