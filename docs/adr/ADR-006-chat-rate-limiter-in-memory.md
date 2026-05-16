# ADR-006 — Rate limiter de chat em memória (Map local) em vez de Redis/MongoDB

**Status:** Aceito (com plano de migração) · **Data:** 2026-05-16

## Contexto
O endpoint `POST /api/chat` precisa de um cap diário por usuário (60 perguntas/dia) para conter abuso de custo na API Groq. O rate limiter de resumos já usa MongoDB com `findOneAndUpdate` atômico, mas o chat tem volume muito maior e não justifica uma escrita no banco a cada mensagem.

## Decisão
`middleware/chatRateLimiter.js` mantém os timestamps em um `Map` em memória do processo Node, com limpeza periódica via `setInterval`.

## Alternativas consideradas
- **MongoDB (mesma estratégia da Quota dos resumos)** — adiciona ~30ms de latência por mensagem; cria pressão de escrita desnecessária para um limite cosmético.
- **Redis (Upstash free tier)** — dependência operacional extra; resolveria, mas não compensa enquanto o backend roda em instância única no Render.
- **Sem rate limit no chat** — rejeitado: deixaria a API Groq exposta a abuso.

## Trade-offs
- ✅ Zero latência adicional; zero infra extra.
- ✅ Funciona perfeitamente enquanto o backend é single-instance (caso atual no Render Free Tier).
- ❌ **Não distribui entre instâncias.** Se escalarmos para N instâncias, o limite efetivo vira `60 × N` por usuário.
- ❌ Reset ao reiniciar o processo (deploy/crash) — usuário pode "recuperar" cota gratuitamente. Aceitável para um limite cosmético; inaceitável para limite financeiro.

## Plano de migração
- Quando o backend escalar para **≥ 2 instâncias** ou for movido para plano com auto-scaling, **migrar para o mesmo padrão da `Quota`** (MongoDB com `findOneAndUpdate` atômico) ou Redis Upstash.
- Trigger objetivo: primeira ocorrência de `429` real em produção OU upgrade do plano Render.

## Consequências
- Decisão documentada e auditável.
- Implementação atual passa em todos os testes e cumpre o objetivo de evitar abuso ingênuo.
- Não bloqueia escala — apenas exige uma migração de 30 minutos quando o trigger ocorrer.
