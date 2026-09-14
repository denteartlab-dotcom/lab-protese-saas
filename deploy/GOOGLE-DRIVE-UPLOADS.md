# Uploads no Google Drive (service account)

Substitui o OneDrive/Microsoft Graph. Anexos de OS, financeiro, produtos, WhatsApp e suporte vão direto para o Drive — **sem disco na VPS**.

## Importante: Shared Drive (obrigatório)

A Google **não permite** que service account grave arquivos no **"Meu Drive"** (pasta compartilhada normal).  
O erro típico é:

> Service Accounts do not have storage quota...

**Solução:** usar um **Shared Drive** (Drive compartilhado) do **Google Workspace**.

Conta Gmail pessoal **não** tem Shared Drive. É preciso Workspace (empresa) ou mudar para OAuth de usuário.

### Passo a passo Shared Drive

1. Entre no [Google Drive](https://drive.google.com) com uma conta **Google Workspace** (admin ou quem pode criar Shared Drives).
2. No menu esquerdo: **Drives compartilhados** → **Novo**.
3. Nome: ex. `Lab Protese Arquivos`.
4. Abra o Shared Drive → **Gerenciar membros** → **Adicionar membros**.
5. Cole o e-mail da service account (campo `client_email` do JSON), ex.:
   `lab-protese-drive@SEU-PROJETO.iam.gserviceaccount.com`
6. Função: **Gerenciador de conteúdo** (Content manager) — precisa criar pastas/arquivos.
7. Desmarque notificação → Confirmar.
8. Dentro do Shared Drive, crie uma pasta (ex. `Lab_Protese`) **ou** use a raiz do Shared Drive.
9. Abra a pasta e copie o ID da URL:
   `https://drive.google.com/drive/folders/ID_AQUI`
10. No `.env` da VPS:

```bash
UPLOAD_STORAGE=gdrive
GOOGLE_DRIVE_BACKUP_ENABLED=true
GOOGLE_DRIVE_FOLDER_ID=ID_AQUI
GOOGLE_APPLICATION_CREDENTIALS=/etc/lab-protese/gdrive-service-account.json
```

11. Reinicie: `pm2 restart all` (ou `pm2 startOrReload ...`)

O sistema cria sozinho:

```
{GOOGLE_DRIVE_FOLDER_ID}/
  Lab_Protese_Backups/
    {Empresa}/
      uploads/...
      backups/*.json
```

## Pré-requisitos

1. Projeto no Google Cloud com **Google Drive API** ativada  
2. Conta de serviço (JSON)  
3. **Shared Drive** com a SA como Gerenciador de conteúdo  
4. `GOOGLE_DRIVE_FOLDER_ID` = pasta **dentro** do Shared Drive  

## Diagnóstico

`GET /api/uploads/status` → esperado `ok: true`, `modo: "gdrive"`.

## Observações

- Compartilhar só uma pasta do **Meu Drive** com a SA **não basta** (erro de quota).
- Arquivos antigos do OneDrive não migram sozinhos.
- Se a chave JSON vazou (chat, e-mail, print), **gere uma chave nova** na Cloud Console e apague a antiga.
