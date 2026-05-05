const express = require('express');
const Groq = require('groq-sdk');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const CHAT_SYSTEM_PROMPT = `Você é um assistente inteligente especializado em análise de documentos.
O usuário já tem um resumo de uma reunião/documento e quer fazer perguntas sobre ele.
Responda de forma clara, concisa e útil, sempre em Português do Brasil.
Base suas respostas EXCLUSIVAMENTE no contexto fornecido.
Se a pergunta não puder ser respondida com base no contexto, diga isso educadamente.`;

/**
 * POST /api/chat
 * Chat com o documento via SSE streaming.
 * Recebe { question, context } no body.
 */
router.post('/', authMiddleware, async (req, res) => {
  const { question, context } = req.body;

  if (!question || !context) {
    return res.status(400).json({
      error: 'Pergunta e contexto são obrigatórios'
    });
  }

  // Configurar headers SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  try {
    const stream = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: CHAT_SYSTEM_PROMPT },
        { role: 'user', content: `Contexto do documento:\n\n${context}\n\nPergunta do usuário: ${question}` }
      ],
      stream: true,
      temperature: 0.4,
      max_tokens: 1024
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        res.write(`data: ${JSON.stringify({ content, done: false })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ content: '', done: true })}\n\n`);
    res.end();

  } catch (err) {
    // [SEGURANÇA] Log Seguro
    console.error('[CHAT] Erro no chat:', err.code || 'UNKNOWN');
    res.write(`data: ${JSON.stringify({ error: 'Erro ao processar a pergunta', done: true })}\n\n`);
    res.end();
  }
});

module.exports = router;
