# [Estoque / Orçamentos] Detalhe inline (produto + movimentos)

**PRD:** §5.5 (Produtos, orçamentos)  
**Labels:** `otimizacao`, `fase-2`, `estoque`  
**Prioridade:** P2

## Contexto

| Arquivo | Problema |
|---------|----------|
| `produtos/page.tsx` | CRUD `Modal` + `HistoricoMovimentosModal` + `GerenciarEtiquetasCategoriaModal` (`z-[60]`) |
| `orcamentos/OrcamentoFormModal.tsx` | Formulário completo em modal |
| `orcamentos/OrcamentoRespostaModal.tsx` | Resposta em modal separado |
| `ProdutoCadastroModal.tsx` | Cadastro dedicado |

Issues 014/029 cobrem API async, não UX de modais.

## Objetivo

- Produtos: histórico de movimentos e etiquetas em **aba/painel** na página do produto selecionado
- Orçamentos: formulário em página dedicada ou painel largo único (criar + resposta no mesmo contexto)

## Escopo

- [ ] `produtos/page.tsx`: selecionar produto → painel inferior com abas Movimentos | Etiquetas
- [ ] Remover `HistoricoMovimentosModal` após migração
- [ ] `GerenciarEtiquetasCategoriaModal` → aba Etiquetas ou página `/app/produtos/etiquetas`
- [ ] Orçamentos: avaliar `OrcamentoFormModal` → rota `/app/orcamentos/novo` e `/app/orcamentos/[id]`
- [ ] Unificar `OrcamentoRespostaModal` na mesma página de edição

## Critérios de aceite

- Ver histórico de movimentos sem modal sobre modal
- Criar orçamento e registrar resposta sem 2 modais empilhados
- Issue 014 (`/api/produtos/contexto`) integrada no painel quando disponível

## Dependências

- Issue 014 — backend; UI pode começar com fetches atuais

## Referências

- `src/app/app/produtos/page.tsx`
- `src/app/app/orcamentos/page.tsx`
- `src/components/estoque/ProdutoCadastroModal.tsx`

## Fase

**Fase 2** — altera frontend.
