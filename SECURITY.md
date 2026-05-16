# Security Policy

## Versões suportadas

| Versão | Suporte de segurança |
| ------ | -------------------- |
| `main` | ✅ ativa             |
| `< main` | ❌ sem patches     |

## Como reportar uma vulnerabilidade

Se você descobrir uma vulnerabilidade no BrieflyAI, **não abra issue pública**.

- Envie um e-mail para: **silvajeanderson165@gmail.com** com o assunto `[SECURITY] BrieflyAI`.
- Inclua: descrição, passos para reproduzir, impacto estimado e (se possível) prova de conceito.
- Resposta inicial: até **72 horas úteis**.
- Tempo alvo de correção:
  - Críticos (RCE, auth bypass, vazamento de dados): **7 dias**.
  - Altos (IDOR, XSS persistente): **14 dias**.
  - Médios/baixos: próximo ciclo de release.

## Escopo

Em escopo: backend (`/backend`), frontend (`/frontend`), workflows de CI.
Fora de escopo: dependências de terceiros já com CVE público (reporte upstream).

## Reconhecimento

Quem reportar de forma responsável será creditado no `CHANGELOG.md` (se autorizar).

## Práticas adotadas

Veja [`THREAT_MODEL.md`](THREAT_MODEL.md) para a modelagem de ameaças e as mitigações implementadas.
