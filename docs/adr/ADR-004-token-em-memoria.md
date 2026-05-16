# ADR-004 — Access token em memória React + Refresh em cookie httpOnly

**Status:** Aceito · **Data:** 2026-05-15

## Contexto
Padrão antigo do projeto era `localStorage.setItem('brieflyai_token', ...)`. Qualquer XSS lê o token e o atacante sequestra a sessão. Auditoria sinalizou como bloqueador (item 39).

## Decisão
- Access token (15 min) só em `useState` no `AuthContext` — perde no reload, **isso é desejável**.
- Refresh token (7 dias) em cookie httpOnly + secure + sameSite=strict + path=/auth.
- No mount do `AuthContext`, `POST /auth/refresh` faz "refresh silencioso" — restaura a sessão sem o usuário relogar.

## Alternativas consideradas
- **Manter localStorage** — rejeitado: XSS exfiltra trivialmente.
- **Tudo em cookie httpOnly (incluindo access)** — torna requests cross-origin mais complexos e requer CSRF token explícito por request.
- **IndexedDB criptografado** — chave teria que estar no JS, então é taxa de carbono sem benefício real.

## Trade-offs
- ✅ XSS não vê o access token nem o refresh.
- ✅ CSRF no `/refresh` mitigado por sameSite=strict + CORS allowlist.
- ❌ Reload perde o access token até o refresh silencioso completar (~200ms) — UX aceitável.
- ❌ Cross-site navigation legítima ao app pode falhar no primeiro refresh com sameSite=strict; aceitamos por ser SPA com entrypoint próprio.
