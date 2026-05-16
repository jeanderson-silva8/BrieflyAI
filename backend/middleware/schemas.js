const { z } = require('zod');

// ═══════════════════════════════════════════════════════
// 🛡️ SCHEMAS ZOD — Validação estrita de todos os inputs
// ═══════════════════════════════════════════════════════

// Helpers reutilizáveis
const objectIdRegex = /^[a-f0-9]{24}$/;
const objectId = z.string().regex(objectIdRegex, 'ID inválido (deve ser ObjectId de 24 hex chars)');

const email = z.string()
  .trim()
  .toLowerCase()
  .email('Formato de e-mail inválido')
  .max(254, 'E-mail muito longo');

const password = z.string()
  .min(8, 'Senha deve ter no mínimo 8 caracteres')
  .max(128, 'Senha deve ter no máximo 128 caracteres');

const name = z.string()
  .trim()
  .min(2, 'Nome deve ter pelo menos 2 caracteres')
  .max(100, 'Nome deve ter no máximo 100 caracteres');

// ── AUTH ──

const registerSchema = z.object({
  email,
  name,
  password
}).strict();

const loginSchema = z.object({
  email,
  password
}).strict();

const forgotPasswordSchema = z.object({
  email
}).strict();

const resetPasswordBodySchema = z.object({
  password
}).strict();

const resetPasswordParamsSchema = z.object({
  token: z.string().min(1, 'Token é obrigatório').max(200, 'Token inválido')
});

// ── SUMMARIZE ──

const summarizeSchema = z.object({
  text: z.string()
    .min(50, 'O texto deve ter pelo menos 50 caracteres para gerar um resumo.')
    .max(500000, 'Texto excede o limite máximo de 500.000 caracteres')
}).strict();

// ── CHAT ──

const chatSchema = z.object({
  question: z.string()
    .min(1, 'Pergunta é obrigatória')
    .max(5000, 'Pergunta muito longa (máximo 5.000 caracteres)'),
  context: z.string()
    .min(1, 'Contexto é obrigatório')
    .max(500000, 'Contexto excede o limite máximo')
}).strict();

// ── HISTORY ──

const historyParamsSchema = z.object({
  id: objectId
});

const historyListQuerySchema = z.object({
  cursor: objectId.optional(),
  limit: z.coerce.number().int().min(1).max(50).optional()
}).strict();

const chatHistoryMessage = z.object({
  role: z.enum(['user', 'assistant', 'system'], { message: 'Role deve ser user, assistant ou system' }),
  content: z.string().max(50000, 'Mensagem muito longa')
});

const saveChatSchema = z.object({
  messages: z.array(chatHistoryMessage)
    .max(200, 'Máximo de 200 mensagens no histórico de chat')
}).strict();

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordBodySchema,
  resetPasswordParamsSchema,
  summarizeSchema,
  chatSchema,
  historyParamsSchema,
  historyListQuerySchema,
  saveChatSchema
};
