# [Produção] Contexto da OS em uma única API

**PRD:** §5.3 (Ordem de Serviço)  
**Labels:** `otimizacao`, `fase-1`, `backend-only`, `producao`  
**Prioridade:** P1

## Contexto

Abrir/editar OS dispara múltiplos fetches: cliente, pacientes, tabela de preços, etapas, produtos, config bloqueio devedor, etc. Cada um é um “contexto” separado para o modal/formulário.

## Objetivo

`GET /api/trabalhos/contexto?osId=...` ou `GET /api/trabalhos/[id]/contexto` retornando:

- trabalho (se edição)
- clientes ativos (resumo)
- pacientes do cliente selecionado
- itens tabela preços usados na OS
- etapas/setores (JsonStore)
- flags config (bloqueio saldo, etc.)

## Escopo

- [x] Nova rota com queries Prisma + JsonStore em `Promise.all`
- [x] Reutilizar libs existentes (`lib/` — não duplicar regra de negócio)
- [x] Rota antiga `/api/trabalhos/[id]` inalterada
- [x] Documentar contrato JSON em comentário ou tipo exportado

## Critérios de aceite

- Uma chamada substitui ≥ 4 chamadas atuais na abertura do formulário OS
- Permissões e tenant respeitados (`requireEmpresaContext`)

## Métricas

- Comparar Network antes/depois na tela `/app/producao/os`

## Referências

- PRD §5.3: segmentos, tabela de preços, bloqueio devedor
