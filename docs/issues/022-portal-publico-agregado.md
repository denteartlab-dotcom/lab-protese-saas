# [Portal público] Páginas por token em uma API

**PRD:** §5.9  
**Labels:** `otimizacao`, `fase-1`, `backend-only`, `portal`  
**Prioridade:** P1

## Objetivo

`/acompanhamento/[token]`, `/fatura/[token]`, `/extrato/[token]`, `/orcamento/[token]` — uma chamada inicial com todos os dados da página.

## Escopo

- [x] `GET /api/public/pagina?tipo=acompanhamento&token=` (ou rotas por tipo)
- [x] Payload: dados lab (branding mínimo) + entidade principal + ações permitidas
- [x] Rotas públicas atuais mantidas até migração

## Critérios de aceite

- Cada portal: 1 fetch no SSR/CSR inicial
- Tokens inválidos → 404 sem vazar dados de outro tenant
