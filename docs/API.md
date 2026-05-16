# BrieflyAI — API Reference

Base URL (dev): `http://localhost:3001`
Auth: `Authorization: Bearer <accessToken>` (exceto rotas públicas).
Refresh: cookie httpOnly `refreshToken` (rotacionado a cada uso).

Todas as respostas de erro seguem `{ "error": "<mensagem>" }` com HTTP status apropriado.
Códigos comuns: `400` validação Zod, `401` token inválido/ausente, `403` autorização negada, `404` recurso não encontrado, `429` rate limit, `500` interno.

---

## Auth

### `POST /auth/register`
Cria conta. Público. Rate limit: 5/min por IP.

Body:
```json
{ "email": "user@ex.com", "name": "Nome", "password": "min 8 chars" }
```
`201` → `{ token, user: { id, email, name } }` + cookie `refreshToken`.

### `POST /auth/login`
Autentica. Público. Rate limit: 5/min.

Body: `{ "email", "password" }`
`200` → `{ token, user }` + cookie `refreshToken`.

### `POST /auth/refresh`
Rotaciona refresh token. Requer cookie `refreshToken`. Detecção de reuso revoga toda a família.

`200` → `{ token }` (novo access) + cookie atualizado.
`401` se token revogado/inválido.

### `POST /auth/logout`
Revoga refresh token atual e limpa cookie. `204`.

### `POST /auth/forgot-password`
Solicita reset. Sempre retorna `200` (não revela existência do e-mail).

Body: `{ "email" }`

### `POST /auth/reset-password/:token`
Aplica nova senha usando token enviado por e-mail.

Body: `{ "password" }`
`200` ou `400` se token expirado/inválido.

---

## Summarize

### `POST /api/summarize` 🔒
Gera resumo via streaming SSE. Rate limit: **5 resumos/dia por userId**.

Body: `{ "text": "min 50 / max 500.000 chars" }`
Resposta: `text/event-stream` com tokens do LLM. Persistência automática ao final.

---

## Chat

### `POST /api/chat` 🔒
Chat sobre o contexto de um resumo (streaming SSE).

Body:
```json
{ "question": "1..5000 chars", "context": "1..500.000 chars" }
```

---

## History

### `GET /api/history` 🔒
Lista resumos do usuário (limit fixo 20, mais recentes primeiro).
`200` → `[{ id, title, createdAt, ... }]`

### `GET /api/history/:id` 🔒
Detalhe de um resumo. `id` deve ser ObjectId 24-hex.
`404` se não pertencer ao `req.userId`.

### `DELETE /api/history/:id` 🔒
Remove resumo do usuário (hard delete atualmente).

### `PATCH /api/history/:id/chat` 🔒
Salva histórico de chat associado.

Body: `{ "messages": [{ "role": "user|assistant|system", "content": "..." }] }` (máx 200).

---

## Transcribe

### `POST /api/transcribe` 🔒
Upload de áudio (multipart, máx 25MB). Retorna transcrição.

Allowlist de extensões; arquivo deletado após processamento.

---

## Health

### `GET /health`
Público. `{ status, mongo, timestamp }`.

---

## Modelo de erros validados (Zod `.strict()`)

Todos os endpoints rejeitam campos extras. Schemas em [`backend/middleware/schemas.js`](../backend/middleware/schemas.js).

## Segurança

- JWT HS256 explícito, 15min de vida.
- Refresh token rotation + family revocation.
- Helmet, CORS allowlist, cookies `httpOnly + secure + sameSite=strict`.
- Logs Pino estruturados, PII mascarada.
Veja [`THREAT_MODEL.md`](../THREAT_MODEL.md).
