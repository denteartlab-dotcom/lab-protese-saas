# [Infra] Observabilidade de APIs — medir antes de otimizar

**PRD:** §4.4 (Performance) · **SDD:** §18  
**Labels:** `otimizacao`, `fase-0`, `backend-only`, `infra`  
**Prioridade:** P0

## Contexto

O sistema tem **114+ rotas API**. Sem métricas, não sabemos quais módulos sobrecarregam o Node ou disparam mais ações por clique do usuário.

## Objetivo

Registrar duração, status e rota de cada `GET/POST/PATCH/DELETE` autenticada, **sem alterar contratos de API nem frontend**.

## Escopo

- [x] Middleware HTTP em `server.ts` + vínculo de tenant em `requireEmpresaContext`
- [x] Log estruturado: `rota`, `metodo`, `duracaoMs`, `empresaId` (ref. curta), `status`
- [x] Endpoint `/api/dev/metricas-api` + script `npm run metrics:api`
- [x] Baseline em `docs/issues/metricas-baseline.md`

## Fora de escopo

- APM externo (Datadog, etc.) — pode vir depois
- Mudança em respostas JSON

## Critérios de aceite

- Toda rota `/api/*` autenticada gera log de duração em dev
- É possível listar top rotas por tempo médio sem ferramenta externa
- Zero impacto visível para o usuário

## Métricas de sucesso

- Baseline documentado: top 10 rotas por tempo e por volume
- Base para priorizar issues 005–018

## Referências

- `src/lib/empresa-context.ts`
- `docs/SDD.md` §9.2, §18
