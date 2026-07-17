$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Encerrando processos na porta 3000/3001..."
Get-NetTCPConnection -LocalPort 3000,3001 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2

Write-Host "Instalando dependencias..."
npm install 2>&1 | Out-Host

Write-Host "Banco de dados..."
npx prisma generate 2>&1 | Out-Host
npx prisma db push 2>&1 | Out-Host
npm run db:seed 2>&1 | Out-Host

if (Test-Path .next) { Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue }

Write-Host ""
Write-Host "Iniciando em http://localhost:3000"
Write-Host "Login: defina SEED_SENHA_PROPRIETARIO / MASTER_ADMIN_PASSWORD no .env (min. 8 chars)"
npm run dev
