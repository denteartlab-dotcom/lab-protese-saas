# [Infra] Cache server-side para leituras JsonStore

**PRD:** §4.2 (JsonStore por tenant)  
**Labels:** `otimizacao`, `fase-1`, `backend-only`, `infra`  
**Prioridade:** P1

## Contexto

Cadastros flexíveis (etapas, setores, colaboradores, tabela de preços) usam JsonStore. Múltiplas APIs leem os mesmos prefixos `t:{empresaId}:` por requisição.

## Objetivo

Cache em memória por processo (Map + TTL) para leituras frequentes, invalidado em `write`.

## Escopo

- [x] `lib/json-store-cache.ts` com TTL configurável (ex.: 60 s)
- [x] Invalidação por `empresaId` + chave ao salvar
- [x] Aplicar em 3 leituras de alto volume (etapas, setores, plano contas JsonStore se houver)
- [x] Flag env `JSON_STORE_CACHE_TTL_MS` para desligar em debug

## Fora de escopo

- Redis (monólito VPS — memória local basta no curto prazo)

## Critérios de aceite

- Mesmas respostas API; testes manuais em OS e produção
- Segunda leitura da mesma chave no mesmo processo não hita disco/DB extra

## Métricas

- Redução mensurável em tempo de `/api/trabalhos` ou contexto OS (issue 007)
