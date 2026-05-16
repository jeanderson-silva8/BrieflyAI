# Disaster Recovery — BrieflyAI

## Objetivos
- **RPO (Recovery Point Objective):** ≤ 24h — perda máxima aceita é o último dia.
- **RTO (Recovery Time Objective):** ≤ 4h — restauração e re-deploy completos em até 4h.

## Componentes e seu DR

### MongoDB Atlas
- **Backups:** snapshots automáticos diários do Atlas (M0/M2/M5 tier — verificar plano atual).
- **Retenção:** padrão Atlas (2 dias no Free Tier; 7+ em planos pagos).
- **Criptografia em repouso:** habilitada por padrão pelo Atlas (AES-256 com chave gerenciada pelo Atlas).
- **Isolamento:** snapshots ficam na conta Atlas, separada da conta de aplicação.
- **Restauração:** via console Atlas → "Restore" → "Restore a snapshot".

### Backend (Render.com)
- **Sem estado:** processo é stateless; perda da instância não perde dados.
- **Re-deploy:** automático via push em `main` (ver `.github/workflows/ci.yml`).
- **Variáveis de ambiente:** mantidas no painel do Render — **exportar trimestralmente** para vault offline.

### Frontend (Vercel)
- Stateless; redeploy automático em push.

## Procedimento de restauração — banco
1. Identificar snapshot mais recente íntegro no Atlas.
2. Criar **novo cluster** a partir do snapshot (não restaurar sobre o de produção até validar).
3. Conectar via `mongosh`, validar contagens críticas: `users`, `summaries`, `refreshtokens`, `auditlogs`.
4. Atualizar `MONGO_URI` no Render para o novo cluster.
5. Redeploy do backend; smoke test em `/health/ready`.
6. Após validação, retirar cluster antigo.

## Limitações conhecidas
- Backup do Atlas Free Tier é mínimo — **antes de qualquer produção real, migrar para tier pago** com point-in-time recovery.
- Sem testes periódicos de restauração documentados ainda — **backup não testado não é backup**.
- Vault offline de envs ainda manual.

## Próximas melhorias
- [ ] Job mensal de export `mongodump` para bucket cloud com object lock.
- [ ] Runbook de DR testado a cada release maior.
- [ ] Replica em região secundária quando justificar custo.
