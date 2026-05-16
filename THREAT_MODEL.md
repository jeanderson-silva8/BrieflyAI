# THREAT_MODEL — BrieflyAI

## 1. Ativos protegidos

- **Credenciais de usuário** (hash de senha bcrypt cost 12, refresh tokens hashados SHA-256).
- **Resumos e históricos de reunião** — podem conter PII e segredos corporativos.
- **Chaves de API externas** (Groq, Resend) — só em variáveis de ambiente do servidor.
- **Integridade da sessão** — access token JWT 15min + refresh token rotacionado 7d.

## 2. Atores de ameaça

| Ator | Capacidade | Motivação |
|------|------------|-----------|
| Script kiddie | Tooling público, scanners | Defacement, curiosidade |
| Usuário malicioso autenticado | Conta válida, conhece o app | IDOR, escalação, abusar de cota LLM |
| Atacante externo | Sem credenciais | Brute force, XSS, prompt injection |
| Ex-usuário | Tokens antigos | Manter acesso após logout |

## 3. Superfícies de ataque

- Endpoints HTTP públicos (`/auth/*`).
- Endpoints autenticados (`/api/summarize`, `/api/chat`, `/api/history`, `/api/transcribe`).
- Upload de áudio em `/api/transcribe`.
- Conteúdo de usuário enviado ao LLM (Groq).
- Cookie de refresh token cross-origin.

## 4. STRIDE aplicado

| Categoria | Ameaça | Status | Mitigação |
|-----------|--------|--------|-----------|
| **S**poofing | Token JWT forjado / alg:none | ✅ | `algorithms: ['HS256']` explícito no verify ([authMiddleware.js:19](backend/middleware/authMiddleware.js#L19)) |
| **S**poofing | Reuso de refresh token | ✅ | Rotation + detecção de reuso revoga família inteira |
| **T**ampering | Cliente manda `userId` no body | ✅ | `userId` sempre vem de `req.userId` (do JWT) |
| **T**ampering | Campos extras em payload | ✅ | Zod `.strict()` em todos os schemas |
| **R**epudiation | Ações sem rastro | ⚠️ | Logs Pino estruturados; **audit log dedicado pendente** |
| **I**nformation Disclosure | PII em logs | ✅ | `maskEmail()` em auth; reset URL só em dev |
| **I**nformation Disclosure | Stack trace em prod | ✅ | Handler global oculta `detail` se `NODE_ENV=production` |
| **I**nformation Disclosure | XSS lê token | ✅ | Access token em memória React; refresh em cookie httpOnly |
| **D**oS | Brute force login | ✅ | Rate limit 5/min em `/auth/*` |
| **D**oS | Abuso de LLM | ✅ | 5 resumos/dia por `userId` |
| **D**oS | Rate limit por IP atrás de NAT | ⚠️ | Auth ainda por IP; resumos por userId |
| **E**levation | IDOR em `/history/:id` | ✅ | Query filtra `userId: req.userId` |
| **E**levation | CSRF no `/auth/refresh` | ✅ | `sameSite: strict` + CORS allowlist |

## 5. Riscos específicos de LLM

| Risco | Status | Mitigação |
|-------|--------|-----------|
| Prompt injection | ⚠️ Parcial | Input em mensagem separada (role: user); delimitadores XML pendentes |
| Output do LLM executado sem validação | ⚠️ | JSON parse com try/catch e fallback; sem schema Zod no output |
| Vazamento de PII em logs de prompt | ✅ | Conteúdo do prompt não é logado |
| Custo descontrolado | ✅ | Cap por usuário/dia |

## 6. Itens pendentes (não mitigados ainda)

- Audit log dedicado (login, logout, reset, delete).
- Correlation ID por request.
- Paginação cursor-based em `/history`.
- Soft delete (`deletedAt`) — hoje é hard delete.
- Dockerfile multi-stage com user não-root.
- Delimitadores XML no prompt do Groq (E1).
- CSP customizada no `vercel.json` (frontend).

## 7. Revisões

| Data | Mudança |
|------|---------|
| 2026-05-15 | Versão inicial após auditoria completa do checklist universal |
