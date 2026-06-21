# E-mail transacional — Resend (Lab Prótese)

Envio de e-mails do sistema (recuperação de senha, avisos, etc.) via [Resend](https://resend.com).

**Plano gratuito:** ~3.000 e-mails/mês — suficiente para começar.

---

## 1. Criar conta no Resend

1. Acesse [https://resend.com/signup](https://resend.com/signup)
2. Crie a conta com o e-mail da empresa (`denteartlab@gmail.com` ou outro)
3. Confirme o e-mail de verificação

---

## 2. Verificar o domínio `denteartlab.com.br`

Sem domínio verificado, os e-mails podem ir para **spam** ou ser bloqueados.

1. No painel Resend: **Domains** → **Add Domain**
2. Digite: `denteartlab.com.br`
3. O Resend mostrará registros DNS para adicionar no provedor do domínio (Registro.br, Cloudflare, Hostinger, etc.)

### Registros típicos (exemplo — use os valores que o Resend mostrar)

| Tipo | Nome / Host | Valor |
|------|-------------|--------|
| **TXT** | `@` ou `denteartlab.com.br` | SPF (ex.: `v=spf1 include:amazonses.com ~all`) |
| **CNAME** | `resend._domainkey` | valor fornecido pelo Resend (DKIM) |
| **TXT** | `_dmarc` | `v=DMARC1; p=none;` (opcional no início) |

4. Salve no DNS e aguarde propagação (5 min a 48 h; em geral &lt; 1 h)
5. No Resend, clique em **Verify** até o status ficar **Verified** (verde)

> **Dica:** Se o site usa Cloudflare, deixe o proxy **desligado** (nuvem cinza) nos CNAME do Resend.

---

## 3. Criar API Key

1. Resend → **API Keys** → **Create API Key**
2. Nome sugerido: `lab-protese-producao`
3. Permissão: **Sending access** (envio)
4. Copie a chave (`re_...`) — **só aparece uma vez**

Guarde em local seguro. Não commite no Git.

---

## 4. Variáveis no `.env` (local e VPS)

### Desenvolvimento (`.env` na raiz do projeto)

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
EMAIL_FROM=Lab Prótese <noreply@denteartlab.com.br>
EMAIL_REPLY_TO=denteartlab@gmail.com
```

### Produção (VPS: `/opt/lab-protese-saas/.env`)

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
EMAIL_FROM=Lab Prótese <noreply@denteartlab.com.br>
EMAIL_REPLY_TO=denteartlab@gmail.com
```

| Variável | Descrição |
|----------|-----------|
| `RESEND_API_KEY` | Chave da API Resend |
| `EMAIL_FROM` | Remetente (domínio **precisa** estar verificado no Resend) |
| `EMAIL_REPLY_TO` | E-mail para respostas (opcional) |

Após editar na VPS:

```bash
cd /opt/lab-protese-saas
bash deploy/atualizar-producao.sh && pm2 restart lab-protese
```

---

## 5. Testar envio (antes do “Esqueci minha senha”)

Com a API key configurada e o código de e-mail no projeto:

1. Use a rota de teste (quando disponível) ou o fluxo de recuperação de senha
2. No painel Resend → **Emails**, confira se o envio aparece como **Delivered**
3. Teste com Gmail e Outlook; se cair em spam, revise SPF/DKIM no domínio

### Teste manual via curl (opcional)

```bash
curl -X POST 'https://api.resend.com/emails' \
  -H "Authorization: Bearer re_SUA_CHAVE" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "Lab Prótese <noreply@denteartlab.com.br>",
    "to": ["seu-email@gmail.com"],
    "subject": "Teste Lab Prótese",
    "html": "<p>E-mail de teste OK.</p>"
  }'
```

---

## 6. O que o sistema vai usar (próxima etapa no código)

| Funcionalidade | Descrição |
|----------------|-----------|
| **Esqueci minha senha** | Link no login → e-mail com token → página de nova senha |
| **Boas-vindas** | Opcional após cadastro |
| **Avisos** | Assinatura, cobrança, etc. (futuro) |

Fluxo de recuperação de senha (resumo):

1. Usuário informa e-mail em `/recuperar-senha`
2. Sistema gera token seguro (validade ~1 h) e grava no banco
3. Resend envia link: `https://www.denteartlab.com.br/redefinir-senha?token=...`
4. Usuário define nova senha; token é invalidado

---

## 7. Checklist rápido

- [ ] Conta Resend criada
- [ ] Domínio `denteartlab.com.br` verificado (SPF + DKIM)
- [ ] API Key criada
- [ ] `RESEND_API_KEY` e `EMAIL_FROM` no `.env` da VPS
- [ ] Deploy + `pm2 restart lab-protese`
- [ ] E-mail de teste recebido (caixa de entrada, não spam)
- [ ] Implementar tela “Esqueci minha senha” no login

---

## 8. Custos

| Situação | Custo |
|----------|--------|
| Até ~3.000 e-mails/mês | **Grátis** (plano Free) |
| Acima do limite | Planos pagos a partir de ~US$ 20/mês |
| Recuperação de senha | Volume baixo — costuma ficar no free |

---

## 9. Problemas comuns

| Problema | Solução |
|----------|---------|
| `Domain not verified` | Concluir verificação DNS no Resend |
| E-mail em spam | Conferir SPF, DKIM e usar `noreply@seudominio` |
| `403` / API key inválida | Gerar nova key e atualizar `.env` |
| Remetente `@gmail.com` | Não use Gmail como `from` em produção — use o domínio verificado |

---

## Suporte Resend

- Documentação: [https://resend.com/docs](https://resend.com/docs)
- Status: [https://resend.com/status](https://resend.com/status)
