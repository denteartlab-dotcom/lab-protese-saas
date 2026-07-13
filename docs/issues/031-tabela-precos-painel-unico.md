# [Cadastros] Tabela de preços — painel único em vez de 10 modais

**PRD:** §5.6 (Tabela de preços)  
**Labels:** `otimizacao`, `fase-2`, `cadastros`  
**Prioridade:** P1

## Contexto

A página `src/app/app/cadastros/tabela-precos/page.tsx` concentra **10+ estados modais** independentes — maior empilhamento do sistema fora do Financeiro:

| Estado modal | Ação do usuário |
|--------------|-----------------|
| `modalCadastrarTabela` | Nova tabela de preços |
| `modalTabelas` | Listar / trocar tabela |
| `modalEditarTabela` | Renomear / editar tabela |
| `modalClientesTabela` | Clientes vinculados à tabela |
| `modalProdutosCategoriaId` | Produtos da categoria |
| `modalTransporte` | Transporte do serviço |
| `modalCustos` | Custos do serviço |
| `modalEditarValores` | Edição em lote de valores |
| `modalEtapasServico` | Etapas do serviço |
| `modalCadastroEtapasServico` | Cadastro de etapas |
| `ModalEditarValoresTabelaPrecos` | Componente dedicado de valores |

Referência: `BarraAcoesTabelaPrecos.tsx` dispara a maioria desses modais.

## Objetivo

Substituir modais empilhados por **um painel lateral ou seção expansível** na própria página, com navegação por abas internas (tabela → categoria → serviço → custos/etapas).

## Escopo

- [ ] Inventariar fluxos atuais e mapear para abas do painel único
- [ ] Painel lateral `TabelaPrecosPainel` com rotas internas: `tabela | clientes | produtos | custos | etapas | valores`
- [ ] Migrar cadastro/edição de tabela para o painel (sem `modalCadastrarTabela` / `modalEditarTabela`)
- [ ] Migrar clientes da tabela para aba do painel
- [ ] Migrar produtos, transporte e custos para sub-abas do serviço selecionado
- [ ] Manter `ModalEditarValoresTabelaPrecos` apenas se edição em lote exigir tela cheia; caso contrário, integrar na aba valores
- [ ] Remover overlays `fixed inset-0 z-[60]` customizados onde existirem
- [ ] Preservar drag-and-drop de categorias na página principal

## Fora do escopo

- Alterar regras de negócio de precificação ou APIs de persistência
- Unificar outros cadastros (issue 033)

## Critérios de aceite

- Usuário edita tabela + categoria + custos **sem abrir mais de 1 overlay** por vez
- Todas as ações da barra de ferramentas continuam acessíveis
- Nenhuma regressão em duplicar tabela, vincular clientes ou editar valores em lote
- `node scripts/inventario-modais.mjs` mostra redução de modais na página

## Dependências

- Issue 020 (inventário) — concluída
- Issue 013 (contexto API) — opcional; não bloqueia UI

## Referências

- `src/app/app/cadastros/tabela-precos/page.tsx`
- `src/components/tabela-precos/BarraAcoesTabelaPrecos.tsx`
- `src/components/tabela-precos/ModalEditarValoresTabelaPrecos.tsx`
- `docs/issues/inventario-modais.md`

## Fase

**Fase 2** — altera frontend. **Primeira prioridade** da auditoria de modais (jul/2026).
