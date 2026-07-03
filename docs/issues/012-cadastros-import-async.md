# [Cadastros] Importação Excel assíncrona

**PRD:** §5.6 (Clientes — import Excel; Fornecedores)  
**Labels:** `otimizacao`, `fase-1`, `backend-only`, `cadastros`  
**Prioridade:** P1

## Contexto

`ImportarClientesExcelModal` e `ImportarFornecedoresExcelModal` processam upload no POST síncrono.

## Objetivo

Upload → job → polling; modal mostra progresso sem travar o servidor.

## Escopo

- [x] `POST /api/clientes/import` e `/api/fornecedores/import` retornam `jobId`
- [x] Job valida linhas, insere em lote, retorna relatório `{ ok, ignorados, erros[] }`
- [x] Frontend: modal com barra de progresso e polling (`ImportarClientesExcelModal`, `ImportarFornecedoresExcelModal`)

## Critérios de aceite

- Planilha 1000 linhas: HTTP inicial < 1 s
- Import não impede outras ações do mesmo laboratório

## Dependência

- Issue 002

## Referências

- `src/components/clientes/ImportarClientesExcelModal.tsx`
