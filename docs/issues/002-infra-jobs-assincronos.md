# [Infra] Jobs assíncronos para ações pesadas

**PRD:** §5.7 (relatórios), §5.6 (import Excel), §5.4 (OFX)  
**Labels:** `otimizacao`, `fase-1`, `backend-only`, `infra`  
**Prioridade:** P0

## Contexto

PDFs, importações Excel e conciliações rodam **síncronas** no request HTTP. Isso bloqueia o processo Node e força o usuário a ficar em modais de espera.

## Objetivo

Padrão reutilizável: `POST` inicia job → retorna `{ jobId }` → `GET /api/jobs/[id]` retorna `{ status, progress?, result? }`.

## Escopo

- [x] Tabela ou JsonStore `JobExecucao` por tenant (`empresaId`, `tipo`, `status`, `payload`, `resultado`, `erro`)
- [x] `lib/jobs/` com `criarJob`, `atualizarJob`, `executarJobEmBackground`
- [x] Rota `GET/POST /api/jobs/[id]`
- [x] Migrar **um** fluxo piloto (ex.: import clientes ou PDF DRE) sem remover rota antiga
- [x] Frontend **opcional** na mesma issue ou issue filha — rota antiga continua funcionando

## Critérios de aceite

- Job piloto completa em background; polling ou SSE opcional
- Falha de job grava `erro` legível; não derruba o servidor
- Rota síncrona legada ainda funciona (compatibilidade)

## Métricas

- Tempo de resposta do `POST` inicial < 500 ms
- Request HTTP não segura aberto > 30 s para o fluxo migrado

## Referências

- `docs/SDD.md` §14
- `src/components/clientes/ImportarClientesExcelModal.tsx`
