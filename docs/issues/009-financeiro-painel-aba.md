# [Financeiro] Painel agregado por aba

**PRD:** §5.4 (Financeiro — abas via query)  
**Labels:** `otimizacao`, `fase-1`, `backend-only`, `financeiro`  
**Prioridade:** P0

## Contexto

`/app/financeiro?tipo=receita`, `?tipo=despesa`, `?aba=plano-de-contas`, etc. Cada aba monta vários estados e chama APIs distintas ao trocar aba ou filtrar.

Módulo com **maior densidade de modais** (~20+ em `src/components/financeiro/`).

## Objetivo

`GET /api/financeiro/painel?aba=receita|despesa|boletos|plano-de-contas|conta-bancaria|conta-digital` retorna dados da aba em um payload.

## Escopo

- [x] Mapear fetches atuais por aba (inventário na issue 020)
- [x] Implementar `painel` para **contas a receber** primeiro (piloto)
- [x] Incluir totais, lista paginada, filtros default
- [x] Cache curto (30 s) por `empresaId+aba` opcional

## Critérios de aceite

- Aba receber: 1 request inicial vs baseline
- Quitação/lançamento continua via rotas de mutação existentes

## Métricas

- Tempo até tabela visível na aba receber

## Referências

- `src/app/app/financeiro/`
- PRD §5.4 tabela de abas
