# PIX de assinatura — Mercado Pago (DenteArt)

Renovação mensal do plano via **PIX único**. Quando o pagamento é confirmado (`approved`), o sistema:

1. Estende `dataVencimento` em **+30 dias** (empilha se ainda estiver ativo)
2. Atualiza limites do plano escolhido
3. Libera acesso ao laboratório

**Não é cobrança recorrente automática** no cartão — o cliente gera um PIX em `/assinatura-vencida` ou `/pagamento` (ou pelo banner no rodapé quando faltam ≤7 dias).

---

## 1. Credenciais no Mercado Pago

1. Acesse [Mercado Pago Developers](https://www.mercadopago.com.br/developers/panel/app)
2. Crie ou abra sua **aplicação**
3. Em **Credenciais de produção**, copie o **Access Token** (`APP_USR-...`)
4. Para testes, use credenciais de **teste** (`TEST-...`) e `MP_PLATAFORMA_AMBIENTE=sandbox`

---

## 2. Variáveis no `.env` da VPS

Edite `/opt/lab-protese-saas/.env`:

```env
# URL pública com HTTPS (obrigatório para webhook e QR PIX)
URL_PUBLICA_DO_APP=https://www.denteartlab.com.br
NEXT_PUBLIC_APP_URL=https://www.denteartlab.com.br
COOKIE_SECURE=true

# Mercado Pago — assinatura da plataforma
MP_PLATAFORMA_ACCESS_TOKEN=APP_USR-xxxxxxxx
MP_PLATAFORMA_AMBIENTE=producao
MP_PLATAFORMA_WEBHOOK_SECRET=

# Suporte (botão na tela de assinatura vencida)
SUPPORT_WHATSAPP=5533988466838
```

> Se `MP_PLATAFORMA_ACCESS_TOKEN` estiver preenchido, o **Mercado Pago** é usado.  
> Se estiver vazio, o sistema tenta **Asaas** (`ASAAS_PLATAFORMA_*`) como alternativa.

---

## 3. Webhook (renovação automática após pagamento)

Sem webhook, a renovação depende só do **polling** na tela (a cada 4s). Com webhook, confirma na hora mesmo se o usuário fechar a página.

### Cadastrar no painel MP

1. Developers → sua app → **Webhooks** → **Configurar**
2. **URL de produção:**

   ```
   https://www.denteartlab.com.br/api/mercadopago/webhook
   ```

3. Eventos: marque **Pagamentos** (`payment`)
4. Salve e copie a **assinatura secreta** gerada → cole em `MP_PLATAFORMA_WEBHOOK_SECRET`

### Conferir se está ok

Após deploy:

```bash
curl -s https://www.denteartlab.com.br/api/mercadopago/webhook | jq
```

Resposta esperada:

```json
{
  "ok": true,
  "configurado": true,
  "ambiente": "producao",
  "webhookSecretConfigurado": true,
  "webhookUrl": "https://www.denteartlab.com.br/api/mercadopago/webhook"
}
```

---

## 4. Deploy

```bash
cd /opt/lab-protese-saas
bash deploy/atualizar-producao.sh
pm2 restart lab-protese
```

Reinicie **depois** de alterar o `.env`.

---

## 5. Testar fluxo completo

### Sandbox (local ou VPS de teste)

1. `.env` com `TEST-...` e `MP_PLATAFORMA_AMBIENTE=sandbox`
2. Crie conta ou use empresa com assinatura vencida
3. Acesse `/assinatura-vencida` → escolha plano → `/pagamento`
4. Pague o PIX de teste (conta comprador de teste no MP)
5. Confirme no admin-master → **Cobranças assinatura** status pago
6. Empresa deve voltar para `ativo` com nova `dataVencimento`

### Produção

1. Use token `APP_USR-...` real
2. PIX real — valor conforme plano (Básico R$ 30,00 / Profissional R$ 40,00 / Premium R$ 50,00)
3. Verifique logs: `[assinatura-pix/mercadopago] Renovação automática: ...`

---

## 6. Planos e preços

Definidos em `src/lib/master-planos.ts`:

| Plano         | Valor/mês |
|---------------|-----------|
| Básico        | R$ 30,00  |
| Profissional  | R$ 40,00 |
| Premium       | R$ 50,00 |

Renovação sempre **+30 dias** por pagamento (`DIAS_RENOVACAO_MENSAL`).

---

## 7. Problemas comuns

| Sintoma | Causa provável | Solução |
|---------|----------------|---------|
| "PIX indisponível" | Token MP ausente | `MP_PLATAFORMA_ACCESS_TOKEN` no `.env` + restart |
| Pagou mas não renovou | Webhook bloqueado ou secret errado | Conferir curl GET webhook; secret no `.env` |
| Webhook 401 | `MP_PLATAFORMA_WEBHOOK_SECRET` incorreto | Recopiar secret do painel MP |
| QR não gera em dev local | `URL_PUBLICA_DO_APP=localhost` | Normal — use polling; webhook só com HTTPS público |
| Usa Asaas em vez de MP | Token MP vazio | Preencher MP primeiro (tem prioridade) |

---

## 8. Master admin

Em `/admin-master`:

- **Cobranças assinatura** — histórico PIX
- **Ativar assinatura** — renovação manual (dias) sem pagamento
