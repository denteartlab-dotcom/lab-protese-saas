# [Infra] Debounce de notificações TV e Socket.IO

**PRD:** §5.3 (Módulo TV), §6 (Socket.IO)  
**Labels:** `otimizacao`, `fase-1`, `backend-only`, `infra`, `producao`  
**Prioridade:** P1

## Contexto

Após mutações em `Trabalho`, o SDD documenta:

```text
registrarLogAuditoria → notificarTvOrdensEmpresa
```

Várias edições seguidas (ex.: controle de produção) disparam **N eventos** socket e recálculos TV.

## Objetivo

Agrupar notificações por `empresaId` em janela de 1–2 s; emitir **delta** (ids alterados) em vez de snapshot completo quando possível.

## Escopo

- [x] `lib/tv-notify-debounce.ts` com fila por `empresaId`
- [x] Substituir chamadas diretas `notificarTvOrdensEmpresa` pelo debouncer
- [x] Payload socket: `{ tipo: 'ordens_delta', ids: string[] }` + fallback snapshot se TV pedir refresh
- [x] Testar módulo TV e controle de produção localmente (`scripts/tv-notify-debounce-smoke.mjs`)

## Critérios de aceite

- 10 updates rápidos na mesma OS → ≤ 2 emits TV por janela
- TV continua atualizando em tempo aceitável (< 3 s)
- Sem mudança obrigatória no frontend da TV

## Métricas

- Contagem de emits socket/min durante simulação de controle de produção

## Referências

- `docs/SDD.md` §10.3, §11
