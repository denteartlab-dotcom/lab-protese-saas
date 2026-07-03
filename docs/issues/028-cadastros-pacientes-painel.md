# [Cadastros] Pacientes — contexto com cliente

**PRD:** §5.6 (Pacientes)  
**Labels:** `otimizacao`, `fase-1`, `backend-only`, `cadastros`  
**Prioridade:** P2

## Objetivo

Tela `/app/pacientes`: uma API com lista + cliente vinculado + filtros.

## Escopo

- [x] `GET /api/pacientes/painel?clienteId=&busca=`
- [x] Incluir resumo do cliente dentista quando filtrado
- [x] Relacionar com issue 013 (contexto compartilhado)

## Critérios de aceite

- Listagem pacientes: 1 request após filtro
- CRUD unitário inalterado
