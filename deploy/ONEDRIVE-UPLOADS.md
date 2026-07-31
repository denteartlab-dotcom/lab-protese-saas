# Uploads diretos no OneDrive (Microsoft Graph) — sem disco na VPS

Os anexos/imagens do sistema **não são salvos na VPS**.  
Vão direto para o OneDrive via **Microsoft Graph API** (sem rclone no upload).

## Estrutura no OneDrive (por laboratório)

```
Lab_Protese_Backups/
  {slug-do-laboratorio}/
    backups/                 ← JSON de backup (rclone, opcional)
    uploads/
      os/
      despesas/
      receitas/
      produtos/
      disparos-whatsapp/
      suporte/
```

> Por padrão usamos a pasta **`Lab_Protese_Backups`** (já existente no OneDrive do lab).  
> Para mudar: `ONEDRIVE_GRAPH_ROOT_FOLDER=NomeDaPasta`

## 1) App no Azure (uma vez)

1. [portal.azure.com](https://portal.azure.com) → Azure Active Directory → Registros de aplicativo → Novo
2. Conta: contas pessoais + organizacionais (ou só organizacional)
3. Certificados e segredos → novo segredo do cliente
4. Permissões da API → Microsoft Graph → **delegadas**:
   - `Files.ReadWrite`
   - `Files.ReadWrite.All`
   - `offline_access`
   - `User.Read`
5. Conceda consentimento de admin se necessário

## 2) Obter refresh token

No navegador (substitua CLIENT_ID):

```
https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=CLIENT_ID&response_type=code&redirect_uri=http://localhost&response_mode=query&scope=offline_access%20Files.ReadWrite%20Files.ReadWrite.All%20User.Read
```

Troque o `code` por tokens:

```bash
curl -X POST https://login.microsoftonline.com/common/oauth2/v2.0/token \
  -d "client_id=CLIENT_ID" \
  -d "client_secret=CLIENT_SECRET" \
  -d "code=CODIGO" \
  -d "redirect_uri=http://localhost" \
  -d "grant_type=authorization_code" \
  -d "scope=offline_access Files.ReadWrite Files.ReadWrite.All User.Read"
```

Guarde o `refresh_token`.

## 3) .env na VPS

```env
UPLOAD_STORAGE=onedrive
ONEDRIVE_GRAPH_CLIENT_ID=...
ONEDRIVE_GRAPH_CLIENT_SECRET=...
ONEDRIVE_GRAPH_TENANT_ID=consumers
ONEDRIVE_GRAPH_REFRESH_TOKEN=...
ONEDRIVE_GRAPH_ROOT_FOLDER=Lab_Protese_Backups

# Backup JSON ainda pode usar rclone (pasta backups/ de cada cliente):
ONEDRIVE_BACKUP_SYNC_ENABLED=true
ONEDRIVE_RCLONE_REMOTE=onedrive-backup:Lab_Protese_Backups
```

**Importante**
- Deixe **só uma** linha `UPLOAD_STORAGE=onedrive` (apague `UPLOAD_STORAGE=database` se existir).
- PNG/JPEG/WebP/PDF da OS são aceitos — o formato **não** impede o OneDrive.
- Com Graph configurado, o app usa OneDrive mesmo se `UPLOAD_STORAGE` estiver errado (exceto `disk`).

Atalho (corrige `.env` + PM2 + teste):

```bash
cd /opt/lab-protese-saas
git pull
npm run build
chmod +x scripts/corrigir-env-onedrive-vps.sh
bash scripts/corrigir-env-onedrive-vps.sh
```

Ou manualmente:

```bash
cd /opt/lab-protese-saas
git pull
npx prisma db push
npm run build

# IMPORTANTE: pm2 restart NÃO relê o .env. Use startOrReload:
pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save

npm run uploads:testar-onedrive
# Diagnóstico logado: GET /api/uploads/status
```

No OneDrive da conta autorizada, procure:

`Lab_Protese_Backups/denteart-1/uploads/os/prova-....txt`

## 4) Migrar arquivos antigos da VPS

```bash
npm run uploads:migrar-onedrive -- --simular
npm run uploads:migrar-onedrive -- --limpar-disco
```

## Conferir

1. Configurações → Backup: “Uploads ativos no OneDrive”
2. Envie um anexo numa OS → deve aparecer em `Lab_Protese_Backups/{slug}/uploads/os/`
3. A pasta `var/uploads` na VPS **não deve crescer**

## Diferença importante

| Tipo | Como | Onde |
|------|------|------|
| **Upload do sistema** (OS, financeiro, produtos…) | Microsoft Graph (direto) | `…/uploads/{modulo}/` |
| **Backup automático** (JSON) | rclone (opcional) | `…/backups/` |

Não usa rclone nem disco da VPS para anexos do dia a dia.
