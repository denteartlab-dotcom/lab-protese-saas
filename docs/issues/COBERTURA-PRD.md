# Cobertura PRD — issues de otimização

| Seção PRD | Issues |
|-----------|--------|
| §3 Modelo SaaS / assinatura | 024 |
| §4 Arquitetura / RNF | 001, 002, 003, 004, 025 |
| §5.1 Landing / onboarding | 021 |
| §5.2 Dashboard | 005, 006, 019, 020, 035 |
| §5.3 Produção | 004, 007, 008, 019, 032, 037 |
| §5.4 Financeiro | 009, 010, 011, 030, 038 |
| §5.5 Estoque | 014, 029, 034 |
| §5.6 Cadastros | 012, 013, 028, 031, 033 |
| §5.7 Relatórios | 015, 016 |
| §5.8 Configurações | 017, 026, 036 |
| §5.9 Portal público | 022, 029 |
| §5.10 Admin Master | 023, 027 |
| §5.11 Suporte / notificações | 018, 027 |
| §6 Integrações | 025, 030 |
| §7 Fluxos críticos | 024, 007, 009 |
| §12 Menu / shell | 019, 020 |

**Total: 38 issues** (+ inventário gerado em `inventario-modais.md`).

## Status de implementação (local)

| Issue | Status | Notas |
|-------|--------|-------|
| 001 | Concluído | `api-observabilidade.ts`, `server.ts`, `/api/dev/metricas-api`, `npm run metrics:api` |
| 005 | Concluído | `/api/dashboard` agrega `uploadsResumo` + `estoqueResumo`; início com 1 fetch |
| 009 | Concluído | `/api/financeiro/painel`, cache 30s, abas migradas |
| 004 | Concluído | `tv-notify-debounce.ts`, evento `tv:ordens:delta` |
| 007 | Concluído | `/api/trabalhos/contexto`, formulário OS integrado |
| 011 | Concluído | jobs `import_ofx` e `conciliacao_conta` |
| 012 | Concluído | import Excel async clientes + fornecedores via jobs |
| 015 | Concluído | PDF DRE e fluxo de caixa via job + visualizador único |
| 010 | Parcial | Fase 2a ok (recibo/fatura/extrato); fase 2b: despesas, SNC, extrato bancário, anexos |
| 019 | Parcial | API busca-rapida ok; fase 2b: leitor código inline, evitar empilhar busca paciente |
| 002 | Concluído | `JobExecucao`, `lib/jobs/`, `/api/jobs` |
| 006 | Concluído | `/api/dashboard?escopo=core|secundario`; widgets secundários lazy no início |
| 017 | Concluído | `/api/lab/bootstrap`, cache 60s, `lab-bootstrap-cliente.ts`, invalidação central |
| 020 | Concluído | `scripts/inventario-modais.mjs` |
| 003 | Concluído | `json-store-cache.ts`, TTL 60s, invalidação em `salvarJsonStoreTenant` |
| 008 | Concluído | `POST /api/trabalhos/batch-status`, `trabalho-status-servidor.ts`, TV debounce em lote |
| 025 | Concluído | `http-integracao.ts`, timeout 30s + retry + circuit breaker; Asaas/MP/Pluggy/NFS-e/Resend |
| 026 | Concluído | Jobs `backup_export`, `backup_import`, `backup_servidor`; runner compartilhado |
| 031 | Pendente | Tabela de preços — painel único (P1 fase 2) |
| 032 | Pendente | Produção entregas/impressão OS |
| 033 | Pendente | Cadastros CRUD painel lateral |
| 034 | Pendente | Estoque/orçamentos detalhe inline |
| 035 | Pendente | Dashboard drill-down |
| 036 | Pendente | Configurações backup/horário |
| 037 | Pendente | Módulo TV — resumo OS sem empilhar |
| 038 | Pendente | Financeiro — painéis/conciliação sem empilhar |
