# Issues — Menos contexto por ação

Backlog local para otimizar o Lab Prótese SaaS: **menos janelas/modais**, **menos requisições por tela** e **menos carga no servidor**, sem quebrar módulos existentes.

Baseado no [PRD](../PRD.md) (seções 5.x) e no [SDD](../SDD.md).

## Como usar

1. Trabalhe **localmente** — implemente a issue, teste, depois commit/push.
2. Ao publicar no GitHub: use `gh issue create` (ver [IMPORTAR-GITHUB.md](./IMPORTAR-GITHUB.md)) ou crie manualmente copiando o corpo de cada arquivo.
3. Respeite a ordem de **prioridade** (P0 → P3) dentro de cada fase.

## Fases

| Fase | Foco | Mexe no frontend? |
|------|------|-------------------|
| **0** | Observabilidade e métricas | Não |
| **1** | Backend: agregação, cache, jobs, side effects | Não (ou opcional depois) |
| **2** | UX: menos modais, fluxos unificados | Sim (módulo a módulo) |

## Épicos e issues

| # | Issue | Módulo PRD | Prioridade | Fase |
|---|-------|------------|------------|------|
| 001 | [Observabilidade de APIs](./001-infra-observabilidade-apis.md) | 4.4 | P0 | 0 |
| 002 | [Infraestrutura de jobs assíncronos](./002-infra-jobs-assincronos.md) | 4.4 / 14 | P0 | 1 |
| 003 | [Cache server-side JsonStore](./003-infra-cache-jsonstore.md) | 4.2 | P1 | 1 |
| 004 | [Debounce TV e Socket.IO](./004-infra-socket-tv-debounce.md) | 5.3 / 11 | P1 | 1 |
| 005 | [Dashboard — uma requisição no login](./005-dashboard-agregacao-fetch.md) | 5.2 | P0 | 1 |
| 006 | [Dashboard — widgets sob demanda](./006-dashboard-widgets-lazy.md) | 5.2 | P2 | 1 |
| 007 | [Produção — contexto OS em uma API](./007-producao-contexto-os.md) | 5.3 | P1 | 1 |
| 008 | [Produção — auditoria e TV em lote](./008-producao-side-effects-lote.md) | 5.3 | P1 | 1 |
| 009 | [Financeiro — painel por aba agregado](./009-financeiro-painel-aba.md) | 5.4 | P0 | 1 |
| 010 | [Financeiro — visualizador PDF único](./010-financeiro-pdf-unificado.md) | 5.4 | P2 | 2 |
| 011 | [Financeiro — jobs para OFX e conciliação](./011-financeiro-jobs-pesados.md) | 5.4 | P1 | 1 |
| 012 | [Cadastros — importação Excel assíncrona](./012-cadastros-import-async.md) | 5.6 | P1 | 1 |
| 013 | [Cadastros — API de contexto compartilhado](./013-cadastros-contexto-compartilhado.md) | 5.6 | P2 | 1 |
| 014 | [Estoque — contexto produto + movimentos](./014-estoque-contexto-produto.md) | 5.5 | P2 | 1 |
| 015 | [Relatórios — PDF em background](./015-relatorios-pdf-background.md) | 5.7 | P1 | 1 |
| 016 | [Relatórios — dados por relatório em uma rota](./016-relatorios-api-por-tipo.md) | 5.7 | P2 | 1 |
| 017 | [Configurações — bootstrap cacheado por tenant](./017-config-bootstrap-cache.md) | 5.8 | P1 | 1 |
| 018 | [Notificações — sininho em batch](./018-notificacoes-batch.md) | 5.11 | P2 | 1 |
| 019 | [Shell — busca OS sem empilhar modais](./019-shell-busca-os-fluxo.md) | 5.2 / 12.1 | P2 | 2 |
| 020 | [Mapa de modais por módulo (inventário)](./020-inventario-modais.md) | 5.x | P0 | 0 |
| 021 | [Landing / onboarding](./021-landing-onboarding.md) | 5.1 | P2 | 1 |
| 022 | [Portal público agregado](./022-portal-publico-agregado.md) | 5.9 | P1 | 1 |
| 023 | [Admin Master agregado](./023-admin-master-agregado.md) | 5.10 | P2 | 1 |
| 024 | [Assinatura — webhooks em jobs](./024-assinatura-webhooks-jobs.md) | §3 | P1 | 1 |
| 025 | [Integrações — timeout padrão](./025-integracoes-timeout-padrao.md) | §6 | P1 | 1 |
| 026 | [Backup/restore assíncrono](./026-config-backup-async.md) | 5.8 | P1 | 1 |
| 027 | [Suporte chat agregado](./027-suporte-chat-agregado.md) | 5.11 | P2 | 1 |
| 028 | [Pacientes — painel](./028-cadastros-pacientes-painel.md) | 5.6 | P2 | 1 |
| 029 | [Orçamentos — async](./029-estoque-orcamentos-async.md) | 5.5 / 5.9 | P2 | 1 |
| 030 | [NFS-e e boletos async](./030-financeiro-nfse-boletos-async.md) | 5.4 / §6 | P1 | 1 |
| 031 | [Tabela de preços — painel único](./031-tabela-precos-painel-unico.md) | 5.6 | P1 | 2 |
| 032 | [Produção — entregas/OS sem empilhar](./032-producao-entregas-sem-empilhar.md) | 5.3 | P2 | 2 |
| 033 | [Cadastros CRUD — painel lateral](./033-cadastros-crud-painel-lateral.md) | 5.6 | P2 | 2 |
| 034 | [Estoque/Orçamentos — detalhe inline](./034-estoque-orcamentos-detalhe-inline.md) | 5.5 | P2 | 2 |
| 035 | [Dashboard — drill-down sem modais](./035-dashboard-drilldown-drawer.md) | 5.2 | P3 | 2 |
| 036 | [Configurações — modais unificados](./036-configuracoes-modais-unificados.md) | 5.8 | P3 | 2 |
| 037 | [Módulo TV — resumo OS sem empilhar](./037-modulo-tv-sem-empilhar.md) | 5.3 / 11 | P3 | 2 |
| 038 | [Financeiro — painéis sem empilhar](./038-financeiro-paineis-sem-empilhar.md) | 5.4 | P2 | 2 |

Ver mapa completo: [COBERTURA-PRD.md](./COBERTURA-PRD.md).

## Prioridade fase 2 (menos modais)

Auditoria jul/2026 — ordem para reduzir janelas de multi-ações:

```
031 (Tabela de preços) → 010b + 019b → 038 → 032 → 033 → 034 → 035 → 036 → 037
```

Módulos **sem issue necessária** (já razoáveis): Disparos WhatsApp (wizard inline), Assinatura UX (1 modal), PDF relatórios (issue 015).  
Lacunas fechadas nesta rodada: TV (037), Financeiro formulários (038).

## Labels sugeridas (GitHub)

- `otimizacao` — melhoria de performance/arquitetura
- `fase-0` / `fase-1` / `fase-2`
- `backend-only` — sem mudança obrigatória de UI
- `dashboard` | `producao` | `financeiro` | `cadastros` | `estoque` | `relatorios` | `config` | `infra`

## Milestone sugerida

**Menos contexto por ação** — reduzir requisições, modais e bloqueio do Node por fluxo do usuário.

## Ordem de implementação recomendada

```
020 → 001 → 005 → 002 → 009 → 004 → 007 → 011 → 012 → 015 → 017 → demais
```

Comece pelo **inventário (020)** e **observabilidade (001)** para medir ganho real antes de refatorar UI.
