# [Dashboard] Widgets carregados sob demanda

**PRD:** §5.2  
**Labels:** `otimizacao`, `fase-1`, `dashboard`  
**Prioridade:** P2

## Contexto

Mesmo com API agregada (issue 005), o payload do dashboard pode ser grande (listas de OS, clientes sem serviço, aniversariantes).

## Objetivo

Dividir em **core** (KPIs + produção + financeiro) e **secundário** (aniversariantes, uploads, anotações) carregado ao expandir ou ao scroll.

## Escopo

- [x] `GET /api/dashboard?escopo=core|completo`
- [x] Rota secundária via `escopo=secundario` (aniversariantes, clientes sem serviço, uploads)
- [x] Skeleton por widget; não bloquear paint do core
- [x] Frontend do dashboard migrado (core primeiro, secundário em segundo plano)

## Critérios de aceite

- Primeiro paint com core em < 2 s em ambiente local típico
- Widgets secundários não impedem uso dos painéis principais

## Dependência

- Issue 005 concluída ou em paralelo
