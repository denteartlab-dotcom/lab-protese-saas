# [Configurações] Backup e restore assíncronos

**PRD:** §5.8 (Backup), §4.4  
**Labels:** `otimizacao`, `fase-1`, `backend-only`, `config`  
**Prioridade:** P1

## Objetivo

Backup manual e restore não bloqueiam UI nem PM2.

## Escopo

- [x] Jobs para `POST /api/backup/export` e restore
- [x] Progresso `{ fase, percentual, arquivo? }`
- [x] Backup automático diário já em cron — alinhar com mesmo runner

## Critérios de aceite

- Export grande: resposta inicial imediata + jobId
- Restore com confirmação e rollback documentado

## Dependência

- Issue 002
