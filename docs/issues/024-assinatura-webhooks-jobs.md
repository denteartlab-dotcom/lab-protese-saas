# [Assinatura SaaS] Webhooks e renovação resilientes

**PRD:** §3, §7.1  
**Labels:** `otimizacao`, `fase-1`, `backend-only`, `assinatura`  
**Prioridade:** P1

## Objetivo

PIX Mercado Pago / Asaas: processar webhook em job idempotente; renovação não bloqueia request.

## Escopo

- [x] Fila/job para `POST /api/mercadopago/webhook` e `/api/asaas/webhook`
- [x] Idempotência por `paymentId` / evento
- [x] `/assinatura-vencida` + renovação: status polling via job

## Critérios de aceite

- Webhook responde 200 em < 300 ms; processamento assíncrono
- Duplicata de webhook não duplica dias de assinatura
