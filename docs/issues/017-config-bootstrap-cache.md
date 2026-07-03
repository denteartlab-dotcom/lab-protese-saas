# [Configurações] Bootstrap cacheado por tenant

**PRD:** §5.8, §4.2 (JsonStore sync)  
**Labels:** `otimizacao`, `fase-1`, `backend-only`, `config`  
**Prioridade:** P1

## Contexto

`useLabConfigClient` e bootstrap do laboratório sincronizam JsonStore em várias telas. Config geral, modelos OS/fatura e permissões são relidas frequentemente.

## Objetivo

`GET /api/lab/bootstrap` retorna pacote único cacheável (60–120 s):

- dados lab (razão, logo ref)
- configs gerais usadas no shell
- flags de integração (Asaas, NFS-e) sem secrets

## Escopo

- [x] Consolidar leituras em `GET /api/lab/bootstrap`
- [x] Header `Cache-Control: private, max-age=60` para CDN/browser
- [x] Invalidar cache ao salvar em JsonStore (`salvarJsonStoreTenant` → `invalidarBootstrapCache`)

## Critérios de aceite

- Navegação entre módulos não refaz bootstrap completo a cada página (quando frontend adotar)
- Secrets (API keys) nunca no payload bootstrap

## Referências

- `src/lib/use-lab-config-client.ts`
- PRD §5.8 áreas de configuração
