# Uploads no Google Drive (sem Google Workspace)

Service account **não grava** no “Meu Drive”. Sem Workspace, use **OAuth** com a sua conta Google.

## Passo a passo (OAuth — caminho correto)

### A) Google Cloud Console

1. Abra [Google Cloud Console](https://console.cloud.google.com/) (mesmo projeto da API Drive).
2. **APIs e serviços** → **Biblioteca** → ative **Google Drive API**.
3. **APIs e serviços** → **Tela de consentimento OAuth**:
   - Tipo **Externo**
   - Preencha nome do app, e-mail de suporte
   - Escopos: adicione `.../auth/drive` (ou deixe e o script pede na autorização)
   - Em **Usuários de teste**, adicione o Gmail que terá o Drive (ex.: seu e-mail)
   - Salve (pode ficar em modo Teste)
4. **APIs e serviços** → **Credenciais** → **Criar credenciais** → **ID do cliente OAuth**
   - Tipo: **Aplicativo para computador** (Desktop)
   - Nome: `Lab Protese Drive`
   - Criar → copie **ID do cliente** e **Segredo do cliente**

### B) Pasta no Google Drive

1. No [Drive](https://drive.google.com), entre com a **mesma conta** que autorizar o OAuth.
2. Crie uma pasta (ex.: `Lab_Protese`).
3. Abra a pasta e copie o ID da URL: `.../folders/ID_AQUI`  
   (não precisa “compartilhar” com service account).

### C) `.env` na VPS (ou local para gerar o token)

```bash
UPLOAD_STORAGE=gdrive
GOOGLE_DRIVE_BACKUP_ENABLED=true
GOOGLE_DRIVE_FOLDER_ID=ID_AQUI

GOOGLE_DRIVE_CLIENT_ID=.....apps.googleusercontent.com
GOOGLE_DRIVE_CLIENT_SECRET=GOCSPX-.....
# GOOGLE_DRIVE_REFRESH_TOKEN=  (preenchido pelo script abaixo)
```

Comente/remova dependência só de service account se for usar só OAuth  
(`GOOGLE_APPLICATION_CREDENTIALS` pode ficar, mas **OAuth tem prioridade**).

### D) Gerar o refresh token

No PC (com Node), na pasta do projeto, com o `.env` já tendo CLIENT_ID e SECRET:

```bash
npm run uploads:gdrive-token
```

1. Abra o link no navegador  
2. Faça login na conta Google **dona da pasta**  
3. Autorize  
4. Cole a URL/`code` no terminal  
5. O script grava `.gdrive-refresh-token` e mostra a linha para o `.env`

Copie o arquivo `.gdrive-refresh-token` **ou** a variável `GOOGLE_DRIVE_REFRESH_TOKEN` para a VPS.

### E) Reiniciar

```bash
pm2 restart all
```

Teste um upload na OS. No Drive deve aparecer:

```
Lab_Protese/
  Lab_Protese_Backups/
    {Empresa}/
      uploads/...
      backups/...
```

## Se ainda aparecer erro de “Service Accounts do not have storage quota”

O servidor ainda está usando só a service account. Confira:

- `GOOGLE_DRIVE_CLIENT_ID`, `CLIENT_SECRET` e `REFRESH_TOKEN` (ou `.gdrive-refresh-token`) na VPS  
- PM2 reiniciado  
- `GET /api/uploads/status` deve mostrar conta OAuth (seu Gmail), não `...iam.gserviceaccount.com`

## Alternativa (só com Google Workspace)

Shared Drive + service account como Gerenciador de conteúdo — ver histórico do guia. Sem Workspace, use OAuth acima.

## Aviso automático (apagar no Drive → some da OS)

O servidor registra um webhook no Drive (`/api/google-drive/webhook`). Quando o arquivo é excluído ou vai para a lixeira, o Google avisa e a linha some da OS.

O canal do Drive dura menos de 1 dia e o sistema **renova sozinho**. Se o Google recusar o webhook, o sistema **consulta a pasta a cada 1 minuto** e limpa a OS mesmo assim.

### Para o aviso em tempo real funcionar

1. `URL_PUBLICA_DO_APP=https://www.denteartlab.com.br` (HTTPS público).
2. Google Cloud Console → **APIs e serviços** → **Verificação de domínio** → adicione `denteartlab.com.br` (o mesmo domínio do site).
3. Reinicie o PM2. Confira: `curl -s https://www.denteartlab.com.br/api/google-drive/webhook`

`watchAtivo: true` = o Drive está avisando. `false` = só a consulta a cada 1 min (ainda automático).

Para desligar o webhook (mantém a consulta): `GOOGLE_DRIVE_WATCH_ENABLED=false`.

## Segurança

Não compartilhe o JSON da service account nem o refresh token. Se vazou, revogue em  
https://myaccount.google.com/permissions e gere outro com `npm run uploads:gdrive-token`.
