const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const Summary = require('../models/Summary');

const router = express.Router();

/**
 * GET /api/history
 * Lista os últimos 20 resumos do usuário autenticado.
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const summaries = await Summary.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('title createdAt _id');

    res.json(summaries);
  } catch (err) {
    console.error('Erro ao buscar histórico:', err);
    res.status(500).json({ error: 'Erro ao buscar histórico' });
  }
});

/**
 * GET /api/history/:id
 * Retorna um resumo específico completo.
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const summary = await Summary.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!summary) {
      return res.status(404).json({ error: 'Resumo não encontrado' });
    }

    res.json(summary);
  } catch (err) {
    console.error('Erro ao buscar resumo:', err);
    res.status(500).json({ error: 'Erro ao buscar resumo' });
  }
});

/**
 * DELETE /api/history/:id
 * Exclui um resumo específico do histórico.
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const summary = await Summary.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId
    });

    if (!summary) {
      return res.status(404).json({ error: 'Resumo não encontrado' });
    }

    res.json({ message: 'Resumo excluído com sucesso' });
  } catch (err) {
    console.error('Erro ao excluir resumo:', err);
    res.status(500).json({ error: 'Erro ao excluir resumo' });
  }
});

/**
 * PATCH /api/history/:id/chat
 * Salva o histórico de chat de um resumo específico.
 */
router.patch('/:id/chat', authMiddleware, async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages) return res.status(400).json({ error: 'O array de messages é obrigatório' });
    
    const summary = await Summary.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { chatHistory: messages },
      { new: true }
    );

    if (!summary) return res.status(404).json({ error: 'Resumo não encontrado' });
    res.json({ message: 'Chat salvo com sucesso' });
  } catch (err) {
    console.error('Erro ao salvar chat:', err);
    res.status(500).json({ error: 'Erro ao salvar chat' });
  }
});

module.exports = router;
