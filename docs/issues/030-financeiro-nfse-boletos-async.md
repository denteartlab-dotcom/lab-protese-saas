# [Financeiro] NFS-e e boletos — emissão assíncrona

**PRD:** §5.4, §6 (Asaas, Plugnotas/Nuvem Fiscal)  
**Labels:** `otimizacao`, `fase-1`, `backend-only`, `financeiro`  
**Prioridade:** P1

## Objetivo

Emitir boleto ou NFS-e sem manter modal aguardando API externa.

## Escopo

- [x] Jobs `emitir-boleto-asaas`, `emitir-nfse`
- [x] Status: `pendente` → `processando` → `emitido` | `erro`
- [x] UI pode continuar com polling; backend pronto primeiro

## Critérios de aceite

- Timeout de integração não corrompe lançamento local
- Retry manual exposto na API

## Dependência

- Issue 002, 025
