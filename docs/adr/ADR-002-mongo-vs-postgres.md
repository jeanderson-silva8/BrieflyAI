# ADR-002 — MongoDB Atlas em vez de PostgreSQL

**Status:** Aceito · **Data:** 2026-05-15

## Contexto
Domínio do BrieflyAI é dominado por documentos semi-estruturados: transcrições, resumos, histórico de chat aninhado por resumo. Relacionamentos são poucos e rasos (User → Summary → ChatHistory).

## Decisão
MongoDB Atlas Free Tier com Mongoose.

## Alternativas consideradas
- **PostgreSQL (Neon/Supabase)** — melhor para queries relacionais ricas; aqui seria over-engineering.
- **SQLite + Litestream** — descartado por incompatibilidade com Render Free (filesystem efêmero).

## Trade-offs
- ✅ Schema flexível (chatHistory aninhado evita JOIN).
- ✅ TTL nativo (usado em RefreshToken e AuditLog).
- ✅ Free tier generoso.
- ❌ Sem transactions cross-collection sem replica set local; aceitamos pois operações sensíveis usam `findOneAndUpdate` atômico.
- ❌ Risco de NoSQL injection se inputs não forem tipados — mitigado por Zod `.strict()` em 100% dos endpoints.

## Consequências
- Operações de delete viraram soft delete (`deletedAt`) sem custo de schema migration.
- Audit log e refresh token aproveitam TTL index.
