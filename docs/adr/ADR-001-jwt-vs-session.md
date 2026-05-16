# ADR-001 — Autenticação com JWT (HS256) + Refresh Token Rotation, em vez de sessão server-side

**Status:** Aceito · **Data:** 2026-05-15

## Contexto
Backend Node/Express monolítico em Render.com; frontend SPA na Vercel. Banco MongoDB Atlas. Tráfego baixo-médio, sem múltiplos serviços validando token.

## Decisão
Access token JWT HS256 de 15 min em memória do React; refresh token opaco (32 bytes CSPRNG) armazenado hash SHA-256 no Mongo, entregue em cookie httpOnly+secure+sameSite=strict, rotacionado a cada uso, com detecção de reuso que revoga a família inteira.

## Alternativas consideradas
- **Sessão server-side (express-session + Mongo store)** — requer hit no banco a cada request; complica horizontal scaling sem sticky sessions.
- **JWT RS256** — útil quando múltiplos serviços validam o token; aqui não há esse cenário, e RS256 adiciona complexidade de gerenciamento de chaves.
- **Apenas access token longo** — rejeitado: janela de comprometimento ampla; refresh rotation dá revogação real.

## Trade-offs
- ✅ Stateless no caminho quente (verify do JWT).
- ✅ Revogação real via família de refresh + detecção de reuso.
- ❌ Access token de 15 min não é revogável dentro da janela; aceitamos o risco pelo curto TTL.
- ❌ Requer cookie cross-site em produção — mitigado por CORS allowlist + sameSite=strict.

## Consequências
- Login/refresh tocam o banco (uma escrita); demais rotas não.
- Migrar para múltiplos backends no futuro exigirá apenas trocar para RS256 + JWKS.
