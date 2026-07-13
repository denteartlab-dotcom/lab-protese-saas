# [Configurações] Unificar backup e horário (menos modais aninhados)

**PRD:** §5.8 (Configurações do laboratório)  
**Labels:** `otimizacao`, `fase-2`, `config`  
**Prioridade:** P3

## Contexto

Configurações usam modais aninhados:

| Arquivo | Uso |
|---------|-----|
| `ModalAbrirPastaBackup.tsx` | Explorar arquivos de backup |
| `RestaurarPadraoModal.tsx` | Restaurar módulos / segurança |
| `HorarioFuncionamentoEditor.tsx` | `ModalIntervalos` + modal feriados (`layerClassName`) |

Issue 026 tornou backup/restore **assíncrono** (jobs), mas a UI ainda abre vários modais.

## Objetivo

- Backup: seção na página com lista de jobs/arquivos inline; confirmações críticas só com `ConfirmacaoExclusaoModal`
- Horário: intervalos e feriados em **accordion** na mesma página, sem `ModalIntervalos`

## Escopo

- [ ] `configuracoes/backup`: unificar explorar + restaurar em abas na página
- [ ] Remover ou reduzir `ModalAbrirPastaBackup` a drawer de preview de arquivo
- [ ] `HorarioFuncionamentoEditor`: editar intervalos inline; feriados em tabela expansível
- [ ] Preservar jobs `backup_export`, `backup_import` (issue 026)

## Critérios de aceite

- Configurar horário de funcionamento sem abrir modal sobre modal
- Iniciar backup e acompanhar job na mesma tela
- Fluxos destrutivos (restaurar padrão) mantêm confirmação explícita

## Dependências

- Issue 026 — concluída
- Issue 017 (bootstrap) — concluída

## Referências

- `src/components/configuracoes/ModalAbrirPastaBackup.tsx`
- `src/components/configuracoes/RestaurarPadraoModal.tsx`
- `src/components/configuracoes/HorarioFuncionamentoEditor.tsx`

## Fase

**Fase 2** — altera frontend.
