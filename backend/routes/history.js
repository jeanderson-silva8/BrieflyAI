const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const asyncHandler = require('../middleware/asyncHandler');
const validate = require('../middleware/validate');
const { historyParamsSchema, historyListQuerySchema, saveChatSchema } = require('../middleware/schemas');
const { NotFoundError } = require('../utils/errors');
const Summary = require('../models/Summary');
const audit = require('../utils/audit');

const router = express.Router();

/**
 * GET /api/history
 * Lista os últimos 20 resumos do usuário autenticado.
 */
router.get('/', authMiddleware, validate({ query: historyListQuerySchema }), asyncHandler(async (req, res) => {
  const { cursor, limit: rawLimit } = req.validatedQuery || {};
  const limit = rawLimit || 20;
  const filter = { userId: req.userId, deletedAt: null };
  if (cursor) filter._id = { $lt: cursor };

  const items = await Summary.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .select('title createdAt _id emoji tags');

  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? page[page.length - 1]._id : null;

  res.json({ items: page, nextCursor, hasMore });
}));

/**
 * GET /api/history/:id
 * Retorna um resumo específico completo.
 */
router.get('/:id', authMiddleware, validate({ params: historyParamsSchema }), asyncHandler(async (req, res) => {
  const summary = await Summary.findOne({
    _id: req.params.id,
    userId: req.userId,
    deletedAt: null
  });

  if (!summary) throw new NotFoundError('Resumo não encontrado');

  res.json(summary);
}));

/**
 * DELETE /api/history/:id
 * Exclui um resumo específico do histórico.
 */
router.delete('/:id', authMiddleware, validate({ params: historyParamsSchema }), asyncHandler(async (req, res) => {
  const summary = await Summary.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId, deletedAt: null },
    { deletedAt: new Date() },
    { new: true }
  );

  if (!summary) throw new NotFoundError('Resumo não encontrado');

  audit(req, 'summary.delete', { targetType: 'Summary', targetId: summary._id });
  res.json({ message: 'Resumo excluído com sucesso' });
}));

/**
 * PATCH /api/history/:id/chat
 * Salva o histórico de chat de um resumo específico.
 */
router.patch('/:id/chat', authMiddleware, validate({ params: historyParamsSchema, body: saveChatSchema }), asyncHandler(async (req, res) => {
  const { messages } = req.body;
  
  const summary = await Summary.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId, deletedAt: null },
    { chatHistory: messages },
    { new: true }
  );

  if (!summary) throw new NotFoundError('Resumo não encontrado');

  res.json({ message: 'Chat salvo com sucesso' });
}));

module.exports = router;
