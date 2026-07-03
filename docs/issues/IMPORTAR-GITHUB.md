# Importar issues para o GitHub

O `gh` CLI não está instalado neste ambiente. Quando estiver disponível:

## Pré-requisitos

```bash
gh auth login
gh repo set-default denteartlab-dotcom/lab-protese-saas
```

## Criar labels (uma vez)

```bash
gh label create "otimizacao" --color "1D76DB" --description "Performance e menos contexto por ação"
gh label create "fase-0" --color "FEF2C0" --description "Observabilidade"
gh label create "fase-1" --color "C2E0C6" --description "Backend sem quebrar UI"
gh label create "fase-2" --color "BFD4F2" --description "UX — menos modais"
gh label create "backend-only" --color "5319E7" --description "Sem mudança obrigatória no frontend"
```

## Criar milestone

```bash
gh api repos/{owner}/{repo}/milestones -f title="Menos contexto por ação" -f description="Reduzir requisições, modais e carga por fluxo"
```

## Criar issue a partir de um arquivo

No PowerShell, a partir da raiz do repo:

```powershell
$body = Get-Content "docs/issues/001-infra-observabilidade-apis.md" -Raw
# Remover frontmatter YAML se houver; usar só o markdown após ---
gh issue create --title "[Infra] Observabilidade de APIs" --body $body --label "otimizacao,fase-0,backend-only,infra"
```

Repita para cada arquivo em `docs/issues/00*.md`.

## Script em lote (PowerShell)

```powershell
$map = @{
  "001-infra-observabilidade-apis.md" = "[Infra] Observabilidade de APIs"
  "002-infra-jobs-assincronos.md" = "[Infra] Jobs assíncronos para ações pesadas"
  # ... completar conforme README
}
foreach ($file in $map.Keys) {
  $body = (Get-Content "docs/issues/$file" -Raw) -replace '(?s)^---.*?---\s*',''
  gh issue create --title $map[$file] --body $body --label "otimizacao"
}
```
