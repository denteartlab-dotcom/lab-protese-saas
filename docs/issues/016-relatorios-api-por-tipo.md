# [Relatórios] Uma rota de dados por tipo de relatório

**PRD:** §5.7 (14 relatórios)  
**Labels:** `otimizacao`, `fase-1`, `backend-only`, `relatorios`  
**Prioridade:** P2

## Contexto

Relatórios podem chamar múltiplas APIs auxiliares (clientes, trabalhos, lançamentos) antes de renderizar tabela ou modal de filtro.

## Objetivo

Padronizar `GET /api/relatorios/[tipo]?de=&ate=&...` retornando `{ colunas, linhas, totais, meta }` pronto para tela e PDF.

## Escopo

- [x] Documentar contrato comum `RelatorioResposta`
- [x] Migrar 2 relatórios piloto: fluxo de caixa, produção
- [x] CSV/Excel como `?formato=csv` na mesma rota (opcional)

## Critérios de aceite

- Tela do relatório: 1 fetch de dados após aplicar filtros
- Permissões de menu relatórios respeitadas

## Referências

- `src/lib/relatorios-nav.ts`, `src/app/app/relatorios/`
