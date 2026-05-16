# ADR-003 — SSE (Server-Sent Events) em vez de WebSocket para streaming

**Status:** Aceito · **Data:** 2026-05-15

## Contexto
Resumo e chat precisam exibir tokens do LLM (Groq) em tempo real para evitar "spinner de minutos". Comunicação é unidirecional (servidor → cliente) e por requisição autenticada.

## Decisão
Usar SSE (`text/event-stream`) sobre HTTP/1.1.

## Alternativas consideradas
- **WebSocket (Socket.io)** — bidirecional, exige handshake separado, mais infra, mais superfície de ataque (rate limit via `socket.use`, rooms, etc.).
- **Polling longo** — desperdiça recursos, latência variável.

## Trade-offs
- ✅ Reusa autenticação JWT existente (Bearer no fetch).
- ✅ Atravessa proxies/HTTP/2 sem upgrade.
- ✅ Render permite conexão de até 60s — suficiente para um stream de resumo.
- ❌ Limite de conexões concorrentes do navegador por origem (~6 HTTP/1.1).
- ❌ Sem retry/reconnect nativo confiável — aceitável: cada requisição é uma operação isolada.

## Consequências
- Sem necessidade de `Socket.io`, simplifica deploy.
- Não dispara o capítulo A do CONTEXT_ADDONS (WebSocket security).
