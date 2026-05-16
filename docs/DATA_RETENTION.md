# Política de Retenção de Dados — BrieflyAI

> Cumprimento dos princípios LGPD (Lei 13.709/2018) e GDPR.

## 1. Dados coletados

| Categoria | Finalidade | Base legal LGPD | Retenção |
|---|---|---|---|
| E-mail, nome, hash de senha | Autenticação | Execução de contrato (Art. 7º V) | Enquanto a conta existir |
| Resumos e transcrições | Funcionalidade contratada | Execução de contrato | Até soft delete + 30 dias para hard delete |
| Histórico de chat por resumo | Funcionalidade contratada | Execução de contrato | Junto com o resumo |
| Refresh tokens (hash SHA-256) | Sessão | Legítimo interesse | TTL automático: 7 dias |
| Audit logs | Segurança / forense | Legítimo interesse (Art. 7º IX) | TTL: 365 dias (configurável via `AUDIT_LOG_TTL_DAYS`) |
| IP + User-Agent em audit log | Investigação de incidentes | Legítimo interesse | 365 dias |

## 2. Soft delete e hard delete

- `DELETE /api/history/:id` faz **soft delete** (`deletedAt = now`). O recurso some das queries mas é recuperável.
- Job de limpeza (a implementar) faz **hard delete** 30 dias após o soft delete.

## 3. Exclusão de conta (direito ao esquecimento — Art. 18 VI LGPD)

Endpoint: `DELETE /auth/account` (autenticado).

Ao chamar:
- Conta marcada como deletada; sessão revogada (todos os refresh tokens da família).
- Resumos do usuário marcados com `deletedAt`.
- Audit logs **preservados** sob legítimo interesse (rastro forense de atividade da conta), pseudonimizados — o `userId` fica órfão.
- Hard delete completo após 30 dias.

## 4. Portabilidade (Art. 18 V LGPD)

Endpoint: `GET /auth/account/export` (autenticado) → retorna JSON com:
```json
{ "user": {...}, "summaries": [...] }
```
(Para implementar — ver "Próximas etapas".)

## 5. Anonimização vs deleção

- E-mail e nome: deletados em hard delete.
- Audit log: `userId` mantido para integridade do log; sem PII direta lá dentro.

## 6. Contato do titular

Solicitações sob LGPD/GDPR: `silvajeanderson165@gmail.com`. Resposta em até **15 dias úteis** (LGPD Art. 19).

## Próximas etapas
- [ ] Implementar `GET /auth/account/export`.
- [ ] Cron job de hard delete pós-30d.
- [ ] Pseudonimização automática do `userId` em audit logs após hard delete.
