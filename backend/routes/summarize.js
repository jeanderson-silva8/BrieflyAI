const express = require('express');
const Groq = require('groq-sdk');
const authMiddleware = require('../middleware/authMiddleware');
const rateLimiter = require('../middleware/rateLimiter');
const Summary = require('../models/Summary');

const router = express.Router();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const SYSTEM_PROMPT = `Você é um assistente de reuniões corporativo ultra-eficiente.
Receba a transcrição/texto abaixo e retorne EXATAMENTE neste formato:

## 📋 RESUMO
[Resumo estruturado em tópicos dos pontos-chave]

## ✅ AÇÕES
[Lista de tarefas extraídas com responsáveis e prazos, se mencionados]

## 📧 E-MAIL DE FOLLOW-UP
[Rascunho de e-mail profissional e breve resumindo a reunião para os participantes]

Regras:
- Seja conciso mas completo
- Use bullet points para melhor leitura
- O e-mail deve ser profissional e pronto para envio
- Se não houver responsáveis ou prazos claros, indique "[A definir]"
- Responda sempre em Português do Brasil`;

const CHUNK_PROMPT = `Você é um assistente que extrai os pontos-chave de textos longos.
Resuma este trecho de forma concisa em bullet points, preservando nomes, datas, valores e decisões importantes.
Responda sempre em Português do Brasil. Seja direto, sem introduções.`;

// Limite seguro de caracteres por chunk (~3000 tokens = ~12000 chars)
const MAX_CHARS_PER_CHUNK = 12000;

/**
 * Quebra o texto em chunks respeitando parágrafos quando possível.
 */
function splitTextIntoChunks(text, maxChars) {
  if (text.length <= maxChars) return [text];

  const chunks = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      chunks.push(remaining);
      break;
    }

    // Tenta cortar no último parágrafo duplo dentro do limite
    let cutPoint = remaining.lastIndexOf('\n\n', maxChars);
    if (cutPoint < maxChars * 0.3) {
      // Se não achou um bom ponto, tenta quebra de linha simples
      cutPoint = remaining.lastIndexOf('\n', maxChars);
    }
    if (cutPoint < maxChars * 0.3) {
      // Último recurso: corta no último espaço
      cutPoint = remaining.lastIndexOf(' ', maxChars);
    }
    if (cutPoint <= 0) {
      cutPoint = maxChars;
    }

    chunks.push(remaining.substring(0, cutPoint));
    remaining = remaining.substring(cutPoint).trim();
  }

  return chunks;
}

/**
 * Resumo parcial de um chunk (sem streaming, interno).
 */
async function summarizeChunk(chunkText, index, total) {
  const res = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [
      { role: 'system', content: CHUNK_PROMPT },
      { role: 'user', content: `[Parte ${index + 1} de ${total}]\n\n${chunkText}` }
    ],
    temperature: 0.2,
    max_tokens: 1024
  });
  return res.choices[0]?.message?.content || '';
}

/**
 * POST /api/summarize
 * Rota principal com SSE streaming.
 * Suporta textos de qualquer tamanho via Map-Reduce automático.
 */
router.post('/', authMiddleware, rateLimiter, async (req, res) => {
  const { text } = req.body;

  if (!text || text.trim().length < 50) {
    return res.status(400).json({
      error: 'Texto muito curto',
      message: 'O texto deve ter pelo menos 50 caracteres para gerar um resumo.'
    });
  }

  // Configurar headers SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  let fullResponse = '';

  try {
    const chunks = splitTextIntoChunks(text.trim(), MAX_CHARS_PER_CHUNK);
    let textToSummarize = text.trim();

    // ── MAP-REDUCE: Se o texto for grande demais, resume em etapas ──
    if (chunks.length > 1) {
      res.write(`data: ${JSON.stringify({ content: `⏳ Texto grande detectado (${chunks.length} partes). Processando com Map-Reduce...\n\n`, done: false })}\n\n`);

      const partialSummaries = [];
      for (let i = 0; i < chunks.length; i++) {
        res.write(`data: ${JSON.stringify({ content: `📄 Analisando parte ${i + 1} de ${chunks.length}...\n`, done: false })}\n\n`);
        
        // Pausa de 1.5s entre chamadas para respeitar rate limit da Groq
        if (i > 0) await new Promise(r => setTimeout(r, 1500));

        const partial = await summarizeChunk(chunks[i], i, chunks.length);
        partialSummaries.push(partial);
      }

      // O texto que vai pro resumo final é a concatenação dos resumos parciais
      textToSummarize = partialSummaries.join('\n\n---\n\n');
      res.write(`data: ${JSON.stringify({ content: `\n✅ Todas as partes analisadas. Gerando resumo executivo final...\n\n---\n\n`, done: false })}\n\n`);
      
      // Pausa antes do resumo final
      await new Promise(r => setTimeout(r, 1500));
    }

    // ── REDUCE: Resumo final com streaming ──
    const stream = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Transcrição/Texto para resumir:\n\n${textToSummarize}` }
      ],
      stream: true,
      temperature: 0.3,
      max_tokens: 2048
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ content, done: false })}\n\n`);
      }
    }

    // Gerar título automaticamente (primeiras palavras do texto original)
    const title = text.substring(0, 60).replace(/\s+/g, ' ').trim() + '...';

    // Salvar no MongoDB
    const summary = await Summary.create({
      userId: req.userId,
      inputText: text,
      summaryResult: fullResponse,
      title
    });

    // Enviar evento final com o ID do resumo salvo
    res.write(`data: ${JSON.stringify({ content: '', done: true, summaryId: summary._id })}\n\n`);
    res.end();

    // Inteligência em Background: Emojis e Tags (Fator SaaS)
    (async () => {
      try {
        const metaRes = await groq.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: 'Você é um classificador. Retorne APENAS um JSON válido no formato {"emoji": "🚀", "tags": ["Finanças", "RH"]}. O JSON deve ter apenas as chaves emoji e tags. Máximo de 1 emoji e 2 tags super curtas.' },
            { role: 'user', content: `Classifique este texto: ${text.substring(0, 500)}` }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1
        });
        const meta = JSON.parse(metaRes.choices[0].message.content);
        await Summary.findByIdAndUpdate(summary._id, { 
          emoji: meta.emoji || '📄', 
          tags: meta.tags || [] 
        });
      } catch (e) {
        // [SEGURANÇA] Log Seguro
        console.error('[SUMMARIZE] Erro na classificação de tags:', e.code || 'UNKNOWN');
      }
    })();

  } catch (err) {
    // [SEGURANÇA] Log Seguro
    console.error('[SUMMARIZE] Erro no streaming:', err.code || 'UNKNOWN');
    const errorMsg = err.message?.includes('rate_limit') 
      ? 'Limite de tokens atingido pela Groq. Reduza o texto ou mude o plano da API.'
      : 'Erro ao processar o resumo. Tente novamente.';
    res.write(`data: ${JSON.stringify({ error: errorMsg, done: true })}\n\n`);
    res.end();
  }
});

module.exports = router;
