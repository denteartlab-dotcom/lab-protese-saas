# Uploads no OneDrive (em vez da VPS)

Os anexos/imagens do laboratório podem ficar **só no OneDrive**, sem acumular em `var/uploads` na VPS.

## Pré-requisitos

1. `rclone` instalado e autenticado (mesmo remote dos backups):

```bash
rclone version
rclone listremotes
# deve aparecer: onedrive-backup:
```

2. Schema do banco atualizado (campos `storage` / `remotePath` em `ArquivoUpload`):

```bash
cd /opt/lab-protese-saas
npx prisma db push
```

## Ativar na VPS

No `.env`:

```env
UPLOAD_STORAGE=onedrive
ONEDRIVE_UPLOADS_REMOTE=onedrive-backup:Lab_Protese_Uploads
# (opcional) sync de backups continua separado:
ONEDRIVE_BACKUP_SYNC_ENABLED=true
ONEDRIVE_RCLONE_REMOTE=onedrive-backup:Lab_Protese_Backups
```

Reinicie o app:

```bash
pm2 restart lab-protese
```

Novos uploads vão para `Lab_Protese_Uploads/{slugEmpresa}/{pasta}/` e só metadados ficam no PostgreSQL. A API `/api/uploads/arquivo/{id}` faz proxy autenticado do OneDrive.

## Migrar arquivos antigos da VPS

Simular:

```bash
cd /opt/lab-protese-saas
npm run uploads:migrar-onedrive -- --simular
```

Migrar e apagar disco local:

```bash
npm run uploads:migrar-onedrive -- --limpar-disco
# ou só uma empresa:
npm run uploads:migrar-onedrive -- --empresa=denteart-1 --limpar-disco
```

URLs antigas `/api/uploads/disco/...` continuam funcionando (fallback para o OneDrive).

## Conferir

1. Configurações → Backup: deve aparecer **Uploads ativos no OneDrive**.
2. Envie um anexo numa OS e abra de novo.
3. No OneDrive: pasta `Lab_Protese_Uploads`.
4. Confirme que `var/uploads` não cresce (após migração + `--limpar-disco`).

## Notas

- Staging temporário ainda usa disco/RAM só durante o upload.
- WhatsApp (`forcarBanco`) continua no PostgreSQL de propósito.
- Backup automático **não** espelha uploads no disco quando `UPLOAD_STORAGE=onedrive` (já estão na nuvem).
