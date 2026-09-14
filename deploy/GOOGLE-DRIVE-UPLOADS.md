# Uploads no Google Drive (service account)

Substitui o OneDrive/Microsoft Graph. Anexos de OS, financeiro, produtos, WhatsApp e suporte vão direto para o Drive — **sem disco na VPS**.

## Pré-requisitos

1. Projeto no Google Cloud com **Google Drive API** ativada
2. Conta de serviço (JSON)
3. Pasta no Google Drive compartilhada com o e-mail da service account (**Editor**)
4. ID dessa pasta em `GOOGLE_DRIVE_FOLDER_ID`

## Variáveis no `.env` (VPS)

```bash
UPLOAD_STORAGE=gdrive

GOOGLE_DRIVE_BACKUP_ENABLED=true
GOOGLE_DRIVE_FOLDER_ID=xxxxxxxxxxxxxxxxxxxxxxxx
GOOGLE_APPLICATION_CREDENTIALS=/etc/lab-protese/gdrive-service-account.json
# opcional:
# GOOGLE_DRIVE_ROOT_FOLDER_NAME=Lab_Protese_Backups
# GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON=...  # alternativa ao arquivo
```

Remova (ou comente) o bloco `ONEDRIVE_GRAPH_*` e `ONEDRIVE_BACKUP_SYNC_*`.

Reinicie: `pm2 startOrReload deploy/ecosystem.config.cjs`

## Estrutura no Drive

```
{GOOGLE_DRIVE_FOLDER_ID}/
  Lab_Protese_Backups/
    {NomeEmpresa}/
      uploads/
        os/
        despesas/
        receitas/
        produtos/
        ...
      backups/
        lab-protese-backup-AAAA-MM-DD.json
```

No banco, `ArquivoUpload.storage = "gdrive"` e `remotePath = gdrive:{fileId}`.

## Diagnóstico

```bash
curl -sS https://SEU_DOMINIO/api/uploads/status -H "Cookie: ..."
```

Esperado: `ok: true`, `modo: "gdrive"`, `gdriveAtivo: true`.

## Observações

- Arquivos antigos com `storage: "onedrive"` **não** são migrados automaticamente; precisam de novo upload se ainda forem necessários.
- A cota “pool” da service account muitas vezes não aparece; o limite por laboratório (plano) continua valendo via soma dos arquivos.
- Backup JSON já usava o mesmo Drive; agora uploads e backup compartilham a mesma pasta raiz.
