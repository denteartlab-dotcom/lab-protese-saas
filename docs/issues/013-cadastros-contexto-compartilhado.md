# [Cadastros] API de contexto compartilhado para formulários

**PRD:** §5.6 (todos os cadastros)  
**Labels:** `otimizacao`, `fase-1`, `backend-only`, `cadastros`  
**Prioridade:** P2

## Contexto

Cada modal de cadastro (fornecedor, colaborador, prestador, etc.) busca listas auxiliares separadamente (setores, plano de contas, cidades, etc.).

## Objetivo

`GET /api/cadastros/contexto?tipo=colaborador|fornecedor|...` com campos comuns + específicos por tipo.

## Escopo

- [x] Definir schema Zod por `tipo`
- [x] Piloto: colaboradores (setores, etapas, comissão defaults)
- [x] Piloto: fornecedores (categorias, plano contas despesa)
- [x] Não unificar UI ainda — só reduzir round-trips

## Critérios de aceite

- Abrir modal colaborador: ≤ 2 requests (contexto + registro se edição)
- Permissões `criar`/`editar` respeitadas

## Referências

- `FornecedorCadastroModal.tsx`, `CargaHorariaColaboradorModal.tsx`
