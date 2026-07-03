# Baseline de métricas API (issue 001)

Registro inicial após uso local com `npm run dev:server` e tenant `denteart`.
Atualize este arquivo periodicamente para comparar ganhos das otimizações.

## Como coletar

```bash
npm run dev:server
# use o sistema normalmente por alguns minutos
npm run metrics:api
```

Ou abra `GET http://127.0.0.1:3000/api/dev/metricas-api` no navegador (somente dev).

Desativar métricas: `API_METRICAS=0 npm run dev:server`

## Top 10 rotas mais lentas (média observada)

| Método | Rota | Média | Máx | Notas |
|--------|------|-------|-----|-------|
| POST | `/api/financeiro/conta-bancaria/import-ofx` | ~7s | ~7s | 1ª compilação + enfileira job |
| GET | `/api/jobs/[id]` | ~2–3s | ~3s | Polling pós-import |
| GET | `/api/dashboard` | ~1–4s | ~5s | Agrega financeiro, produção, estoque, uploads |
| GET | `/api/financeiro/painel` | ~1–2s | ~3s | Painel agregado por aba |
| GET | `/api/trabalhos/contexto` | ~2s | ~4s | 1ª compilação OS |
| POST | `/api/financeiro/conciliacao` | ~1s | ~2s | Enfileira job |
| POST | `/api/clientes/import` | ~0,7s | ~1s | Enfileira job (issue 012) |
| POST | `/api/fornecedores/import` | ~0,5s | ~1s | Enfileira job (issue 012) |
| GET | `/api/armazenamento/bootstrap` | ~0,5–2s | ~3s | JsonStore tenant |
| GET | `/api/contas-bancarias` | ~0,3s | ~1s | Listagem |

> Tempos incluem cold start do Next em desenvolvimento. Em produção compilado tendem a ser menores.

## Top rotas por volume (sessão típica)

| Método | Rota | Chamadas típicas |
|--------|------|------------------|
| GET | `/api/auth/me` | A cada navegação / refresh |
| GET | `/api/armazenamento/bootstrap` | Login + revalidação |
| GET | `/api/socket.io` | Polling contínuo (não é `/api/*` app) |
| GET | `/api/jobs/[id]` | Durante imports/conciliação |
| GET | `/api/dashboard` | Início + filtros |

## Impacto das otimizações já feitas

| Issue | Antes | Depois |
|-------|-------|--------|
| **005** | 3 fetches no Início (`dashboard` + `uploads` + estoque) | **1** `GET /api/dashboard` |
| **009** | Vários fetches por aba financeiro | **1** `GET /api/financeiro/painel?aba=...` |
| **007** | ≥4 fetches ao abrir OS | **1** `GET /api/trabalhos/contexto` |
| **011/012** | POST síncrono longo | POST rápido + job background |

## Próximos candidatos a otimizar (por este baseline)

1. `/api/dashboard` — cache curto ou lazy widgets (issue 006)
2. `/api/financeiro/painel` — já tem cache 30s (009)
3. Relatórios PDF — mover para job (issue 015)
4. Bootstrap JsonStore — cache tenant (issue 017)

## Log estruturado (dev)

```
[api-metrica] ⚠ POST /api/financeiro/conta-bancaria/import-ofx 7125ms → 200 tenant=cmr2pekn
[api-metrica] ✓ GET /api/dashboard 1842ms → 200 tenant=cmr2pekn
```

Rotas autenticadas via `requireEmpresaContext` incluem `tenant=` (8 primeiros chars do `empresaId`).
