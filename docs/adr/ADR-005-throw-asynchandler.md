# ADR-005 — `throw` + `asyncHandler` em vez de try/catch por controller

**Status:** Aceito · **Data:** 2026-05-15

## Contexto
Controllers anteriormente usavam `res.status(...).json(...)` em todo erro, com try/catch genérico. Resultado: middleware global de erro era código morto; respostas heterogêneas; stack trace vazava em prod por acidente.

## Decisão
- Classes de erro operacionais em `utils/errors.js` (`AppError`, `NotFoundError`, `BadRequestError`, `ForbiddenError`, etc.).
- `middleware/asyncHandler.js` envolve handlers async e propaga rejections.
- Controllers fazem `throw new NotFoundError(...)`; o handler global em `app.js` mapeia classe → status + body.

## Alternativas consideradas
- **Express 5 native promise handling** — disponível, mas asyncHandler explícito deixa intenção clara e funciona em qualquer versão.
- **Resultado tipado (Either)** — verboso para um projeto JS.

## Trade-offs
- ✅ ~30% menos código em controllers.
- ✅ Stack trace só em dev; respostas padronizadas.
- ✅ Correlation ID anexado automaticamente nos logs do handler global.
- ❌ Devs precisam aprender as classes de erro disponíveis — documentado em `utils/errors.js`.
