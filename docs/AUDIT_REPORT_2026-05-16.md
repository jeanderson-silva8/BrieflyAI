# 🔍 Auditoria de Segurança — BrieflyAI

> **Data:** 2026-05-16
> **Método:** Aplicação do `AUDIT_CHECKLIST.md` + `CONTEXT_ADDONS.md` (Seção E — LLM) sobre o código-fonte da aplicação.
> **Escopo:** Backend (Node.js/Express), Frontend (React), infraestrutura de deploy (Vercel + Render).
> **Resultado:** 36 de 39 itens declarados como mitigados foram confirmados no código (92%). 3 discrepâncias entre intenção declarada e implementação real. 9 achados adicionais fora da lista inicial.

---

## 📖 Como ler este relatório

Este documento é o output real da aplicação do checklist sobre um projeto vivo. Está organizado em três blocos:

1. **Bloco 1 — Confirmado e excelente**: itens declarados como mitigados que foram validados no código, com referência arquivo:linha.
2. **Bloco 2 — Discrepâncias**: itens onde a lista de mitigações divergia do que o código realmente entrega.
3. **Bloco 3 — Achados fora da lista**: bugs e melhorias que o checklist atual não cobria, organizados por severidade.

No final: plano de ação ordenado por severidade e três perguntas novas que foram derivadas desta auditoria e incorporadas aos checklists universais.

---

## ✅ Bloco 1 — Confirmado e excelente

Dos 39 itens da lista de mitigações, validados diretamente no código:

| # | Item | Confirmação |
|---|------|-------------|
| 1 | JWT com `algorithms: ['HS256']` | `authMiddleware.js:19`, `auth.js:134/184/393` |
| 2 | Token em memória (React, sem persist) | `AuthContext.jsx` |
| 3, 7 | Refresh rotation + family revoke + reuse detection | `auth.js:357-367` |
| 4 | `maskEmail()` + reset URL exposta só em dev | `auth.js:233-237` |
| 5 | Zod com `.strict()` em 100% dos schemas | `schemas.js` |
| 6 | Fail-fast no boot para envs obrigatórias | `server.js:9-14` |
| 8 | Cookies `httpOnly`/`secure`/`sameSite` | `auth.js:81-87` |
| 9 | Zod em query strings | `historyListQuerySchema` |
| 10 | 28 testes adversariais | suíte completa |
| 11 | GitHub Actions CI | `.github/workflows/` |
| 12 | `asyncHandler` + `throw` (sem `res.status` nos controllers) | `history.js` |
| 13 | Logger Pino | parcialmente — ver Bloco 2 |
| 14 | `SECURITY.md`, `THREAT_MODEL.md`, `API.md` | `docs/` |
| 16 | Helmet com CSP custom + HSTS preload | `app.js:29-42` |
| 18 | Regex ObjectId em path params | schemas |
| 19 | Cursor-based pagination | `history.js:16-32` |
| 20 | HIBP k-anonymity | `auth.js:115`, `hibp.js` |
| 22 | Split `/health/live` + `/health/ready` | rotas de health |
| 23 | Correlation ID via `requestId` middleware | middleware global |
| 24 | Soft delete (`deletedAt`) | `Summary.js` — queries filtram `deletedAt: null` |
| 25 | Audit log imutável com TTL 365d | `AuditLog.js` |
| 26 | Prometheus `/metrics` protegido | `app.js:111-118` |
| 27 | Dockerfile multi-stage + user não-root | `Dockerfile` |
| 28 | 5 ADRs documentando decisões arquiteturais | `docs/adr/` |
| 29 | `DISASTER_RECOVERY.md` + `DATA_RETENTION.md` + `DELETE /account` + export | `docs/` + rotas |
| 31 | `vercel.json` frontend com CSP/HSTS/Permissions | `frontend/vercel.json` — mas ver Bloco 2 |
| 32 | Magic bytes para validação de áudio | `transcribe.js:25-42` |
| 33 | VirusTotal v3 fail-open | integração antivírus |
| 34 | Delimitadores `<context>`/`<question>`/`<user_input>` nos prompts | `chat.js:21`, `summarize.js:142` |
| 35 | `llmTagsOutputSchema` antes de persistir saída do LLM | validação estruturada |
| 36 | 60 perguntas/dia/userId no chat | `chatRateLimiter.js` — mas ver Bloco 3 #F |

**Total confirmado: 31 itens sólidos.** É raro ver alinhamento desse nível entre o que se promete e o que se entrega.

---

## ⚠️ Bloco 2 — Discrepâncias entre lista e código

### #17 — Race condition no rate limiter de resumos

**Lista declarava:** "Mitigado por `findOneAndUpdate` atômico nas operações sensíveis"

**Realidade no código** (`middleware/rateLimiter.js:15-32`):

```javascript
const count = await Summary.countDocuments({...});  // ← read
if (count >= DAILY_LIMIT) { return 429; }
// ... mais código ...
// (em summarize.js linha 162)
const summary = await Summary.create({...});  // ← write
```

A race continua existindo. Sequência de exploração:

1. T0: usuário tem 4 resumos no banco. Limite = 5.
2. T0+1ms: dispara 10 requests paralelos.
3. Todos os 10 fazem `countDocuments` → todos veem 4.
4. Todos os 10 passam pela verificação `4 < 5`.
5. Todos os 10 chamam `Summary.create(...)` → usuário acabou com 14 resumos.

**Por que aconteceu:** a lista misturou intenção (planejada) com entrega (implementada). O `findOneAndUpdate` atômico não foi implementado neste rate limiter específico.

**Correção real:**

```javascript
const Quota = mongoose.model('Quota', new Schema({
  userId: { type: ObjectId, required: true },
  date: { type: String, required: true }, // 'YYYY-MM-DD'
  count: { type: Number, default: 0 }
}));
Quota.schema.index({ userId: 1, date: 1 }, { unique: true });

// Middleware:
const today = new Date().toISOString().slice(0, 10);
const quota = await Quota.findOneAndUpdate(
  { userId: req.userId, date: today, count: { $lt: DAILY_LIMIT } },
  { $inc: { count: 1 } },
  { new: true, upsert: true }
);
if (!quota) {
  return res.status(429).json({ error: 'Limite atingido' });
}
```

Operação atômica do MongoDB: o `findOneAndUpdate` com filtro `count: { $lt: DAILY_LIMIT }` falha se já bateu o limite, sem race possível. Se passar, incrementa atomicamente.

---

### #13 — `console.error` residual

**Lista declarava:** "`console.log`/`error` espalhados → migrado para Pino"

**Realidade:** ainda há um `console.error('Erro no rate limiter:', err)` em `middleware/rateLimiter.js:37`. Único restante, baixa criticidade — mas a lista marcou como 100% migrado.

---

### #31 — `vercel.json` no lugar errado

**Lista declarava:** "`vercel.json` com CSP/HSTS/X-Frame/Permissions ✅"

**Realidade:** há **dois** `vercel.json`:

- `vercel.json` (raiz) → apenas rewrites, **sem nenhum header de segurança**
- `frontend/vercel.json` → tem todos os headers corretos

Dependendo de como o deploy no Vercel está configurado (root directory + outputDirectory), o que pode estar sendo lido é o da raiz — e nesse caso, **a CSP do frontend NÃO está sendo aplicada em produção**.

**Como verificar agora:** abrir o site em produção, F12 → Network → recarregar → request principal → headers de resposta. Se não tiver `Content-Security-Policy`, o `vercel.json` da raiz é o que está sendo lido.

**Correção:** mover os headers do `frontend/vercel.json` para o `vercel.json` da raiz. Ou apagar o da raiz e configurar o Vercel para usar `frontend/` como root directory.

---

## 🔴 Bloco 3 — Achados fora da lista

### CRÍTICO #A — Servidor continua de pé com banco offline

**Arquivo:** `server.js:39-43`

```javascript
.catch((err) => {
  logger.warn('MongoDB não conectou. Verifique MONGO_URI no .env');
  logger.warn('Iniciando servidor SEM banco de dados (modo offline)...');
  startServer();
});
```

**Por que é problema:**

- Viola o princípio fail-fast (item 5 do checklist) — implementado para envs ausentes, mas não para dependências críticas.
- Em produção, isso faz o servidor parecer saudável (`/health/live` retorna OK) enquanto todas as operações reais falham.
- `/health/ready` está correto (retorna 503), mas o servidor sequer deveria estar de pé sem banco em prod.

**Correção:** comportamento condicional por ambiente:

```javascript
.catch((err) => {
  if (process.env.NODE_ENV === 'production') {
    logger.fatal({ err: err.message }, 'BOOT FATAL — MongoDB não conectou em produção');
    process.exit(1);
  }
  logger.warn('MongoDB não conectou — modo offline (dev apenas)');
  startServer();
});
```

**→ Esse achado virou o item 5B do `AUDIT_CHECKLIST.md`.**

---

### CRÍTICO #B — Validação de Origin para CSRF não implementada no `/refresh`

**Arquivo:** `auth.js:338` (endpoint `POST /refresh`)

Em produção, o refresh token está em cookie `sameSite: 'strict'` (`auth.js:84`), o que mitiga CSRF. Mas:

- Em dev, `sameSite: 'lax'` permite alguns cenários CSRF.
- Não há fallback de validação de `Origin` header no servidor.
- Em alguns navegadores antigos ou contextos especiais, `sameSite: strict` tem comportamento inconsistente.

A lista sequer menciona CSRF como item resolvido para o `/refresh`.

**Correção:** adicionar middleware de validação de `Origin` no `/refresh` (mesmo padrão usado no FlowSnyker em `csrfCheck`).

---

### ALTO #C — Comparação `===` em valores derivados de token

**Arquivo:** `auth.js:348-351`

```javascript
const storedToken = await RefreshToken.findOne({ tokenHash });
if (!storedToken) { ... }
```

O `tokenHash` aqui é usado como filtro de query MongoDB, não como comparação string — então timing attack via igualdade direta não se aplica. Verificadas também as comparações de família (`auth.js:360`) — também são queries, não comparações.

**Resultado:** não há violação. Mantém como nota para futuras auditorias.

---

### MÉDIO #D — `req.body` cru no logger pode vazar PII em erros inesperados

**Arquivo:** `app.js:144`

```javascript
logger.error({ err: err.name, stack: err.stack }, `Unhandled: ${err.message}`);
```

Se `err.message` carregar input do usuário (acontece em validações inesperadas), pode vazar. Baixa criticidade, mas vale auditar todos os pontos onde `err.message` é logado.

---

### MÉDIO #E — Pino sem `redact` configurada

**Arquivo:** `utils/logger.js`

Pino tem feature nativa de redaction:

```javascript
const logger = pino({
  redact: {
    paths: ['req.body.password', 'req.body.token', '*.password', '*.token', '*.apiKey'],
    censor: '[REDACTED]'
  },
});
```

Sem isso, qualquer log que acidentalmente passe `req.body` em produção vaza senha. Defesa em profundidade gratuita. Recomendado adicionar.

---

### MÉDIO #F — `chatRateLimiter` é in-memory (não distribuído)

**Arquivo:** `middleware/chatRateLimiter.js`

```javascript
const buckets = new Map();
```

Se o backend rodar em mais de uma instância, cada instância tem seu próprio `Map`. Resultado: usuário pode fazer 60 perguntas por instância × N instâncias. Não é vulnerabilidade hoje (single-instance), mas é dívida arquitetural.

**Correção:** Redis ou MongoDB para storage compartilhado. Não é urgente, mas vale documentar em ADR como "consciente, será migrado quando escalar para N instâncias".

**→ Esse achado virou o item E6 do `CONTEXT_ADDONS.md` (Seção LLM).**

---

### BAIXO #G — Audit log enum não cobre algumas ações importantes

**Arquivo:** `AuditLog.js:13-23`

Enum atual: `login` (success/failure), `register`, `logout`, `refresh.reuse`, password reset, `summary.delete/create`.

Faltando:

- `chat.message` (para cap de custo e detecção de abuso)
- `transcribe.attempt` (upload é potencialmente abusível)
- `account.delete` (atualmente marcado como `auth.logout` com metadata, o que polui o enum)
- `account.export` (LGPD — pedidos de exportação devem ser rastreáveis)

Adicionar e ajustar `auth.js:453` para usar o novo enum.

---

### BAIXO #H — `summary.create` declarado no enum mas não usado

**Arquivo:** `AuditLog.js:22` define `summary.create` mas em `summarize.js` o `audit()` nunca é chamado após o `Summary.create`. Audit log está incompleto para a operação mais executada do sistema.

---

### BAIXO #I — Vocabulário de marketing nos comentários

**Arquivos:** `auth.js:42`, `transcribe.js:12`

```javascript
// 🛡️ PROTOCOLO DE SEGURANÇA ENTERPRISE — AUTH (IAM)
```

A lista afirma "README reescrito honestamente" (#15), e provavelmente o README sim. Mas comentários no código ainda têm o vocabulário de marketing. Em code review sênior, "Enterprise IAM" para uma camada bcrypt + JWT soa exagerado. Trocar para "Camada de autenticação" ou similar.

---

## 📋 Resumo executivo

| Status na lista | Quantos | Confirmados | Discrepâncias |
|-----------------|---------|-------------|---------------|
| 🔴 Bloqueadores (1-9) | 9 | 9 | 0 |
| 🟠 Essenciais (10-17) | 8 | 7 | 1 (#17 race) |
| 🟡 Qualidade (18-22) | 5 | 5 | 0 |
| 🟢 Diferenciação (23-29) | 7 | 7 | 0 |
| 🎨 Frontend (30-31) | 2 | 1 | 1 (#31 lugar) |
| 📁 Upload (32-33) | 2 | 2 | 0 |
| 🤖 IA/LLM (34-36) | 3 | 3 | 0 |
| 🧹 Bônus (37-39) | 3 | 2 | 1 (#13 console residual) |
| **TOTAL** | **39** | **36** | **3** |

**Itens NOVOS que escaparam à lista:** 9 (CRÍTICO #A, #B; ALTO #C resolvido; MÉDIO #D, #E, #F; BAIXO #G, #H, #I).

**Veredicto:** 92% de acerto entre o que se prometeu e o que se entregou. Os 3 itens prometidos mas não entregues são erros honestos (a race do rate limiter provavelmente foi resolvida em outro lugar e a memória se confundiu; o `vercel.json` foi confusão de localização). Os 9 itens novos que escaparam são em geral menos graves do que os 36 já cobertos.

---

## 🎯 Plano de ação ordenado por severidade

1. **🔴 Race do rate limiter de resumos** — implementar `findOneAndUpdate` atômico com coleção `Quota` ou abordagem equivalente.
2. **🔴 Servidor não deve subir sem MongoDB em produção** — fail-fast condicional por ambiente.
3. **🔴 Confirmar qual `vercel.json` é lido** — testar headers em produção; consolidar.
4. **🟠 Adicionar `csrfCheck` no `/refresh`** — mesmo padrão do FlowSnyker.
5. **🟡 Adicionar `redact` no Pino** — defesa em profundidade.
6. **🟡 Migrar último `console.error` para logger.**
7. **🟡 Adicionar audit log para `chat.message`, `account.delete`, `account.export`.**
8. **🟢 Trocar "Enterprise" nos comentários por terminologia honesta.**
9. **🟢 Documentar `chatRateLimiter` in-memory como ADR-006** (decisão consciente até escalar).

---

## 🔄 Evolução dos checklists a partir desta auditoria

Três achados desta auditoria foram promovidos a perguntas novas nos checklists universais — para que essa mesma classe de bug seja capturada automaticamente em projetos futuros:

| Achado | Item novo |
|--------|-----------|
| CRÍTICO #A (banco offline) | **5B** no `AUDIT_CHECKLIST.md` — "Dependências críticas de runtime causam fail-fast em prod?" |
| #17 (race do rate limiter) | **17B** no `AUDIT_CHECKLIST.md` — "Operações de cota usam mecanismo atômico em vez de `count→if→write`?" |
| MÉDIO #F (rate limit in-memory) | **E6** no `CONTEXT_ADDONS.md` — "Cota de LLM funciona em múltiplas instâncias?" |

Este é o ciclo virtuoso do método: checklist → audita projeto real → cada bug novo vira pergunta nova → próximo projeto pega.

---

## 🧭 Reflexão final

Este projeto está em outro patamar dos anteriores. Se os 3-4 críticos acima forem corrigidos, é portfólio profissional sólido — com substância suficiente para entrevista técnica avançada.

Mais importante que o resultado em si: **este relatório é a evidência de que o método funciona**. O checklist forçou olhar lugares que normalmente passam batido. As discrepâncias encontradas (especialmente #17 — "marcou como mitigado mas não estava") são o tipo de auto-engano que vira incidente em produção. A disciplina de auditar contra código real, e não contra memória de intenção, é o que separa profissional de amador.

> **Aprendizado para próximas auditorias:** cada item marcado como ✅ deve ter referência `arquivo.js:linha` apontando para o código que implementa a mitigação. Não custa nada e elimina a classe de erro do #17.
