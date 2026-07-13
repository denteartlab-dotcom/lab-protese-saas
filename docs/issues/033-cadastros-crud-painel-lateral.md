# [Cadastros] CRUD — formulário lateral único

**PRD:** §5.6 (Clientes, fornecedores, colaboradores, prestadores)  
**Labels:** `otimizacao`, `fase-2`, `cadastros`  
**Prioridade:** P2

## Contexto

Páginas de cadastro usam `Modal` do `ui.tsx` para criar/editar + modais auxiliares:

| Página | Modais |
|--------|--------|
| `clientes/page.tsx` | CRUD inline + `ImportarClientesExcelModal` + categorias |
| `fornecedores/page.tsx` | CRUD inline + `ImportarFornecedoresExcelModal` |
| `colaboradores/page.tsx` | CRUD + `CargaHorariaColaboradorModal` + comissão |
| `pacientes` | issue 028 (painel API) — UI ainda com modais |

Issues 012/013 reduziram requests, mas **não unificam UI** (013: "Não unificar UI ainda").

## Objetivo

Padrão único: **painel lateral direito** para criar/editar registro, sem fechar a listagem. Import Excel permanece modal (ação rara).

## Escopo

- [ ] Componente reutilizável `CadastroPainelLateral` (props: aberto, titulo, onFechar, children)
- [ ] Piloto: `fornecedores/page.tsx` — substituir `Modal` CRUD pelo painel
- [ ] Migrar `clientes/page.tsx` e `colaboradores/page.tsx`
- [ ] Sub-modais de categoria: dropdown inline ou painel secundário (não empilhar 3 overlays)
- [ ] Manter `Importar*ExcelModal` e `ConfirmacaoExclusaoModal` como estão

## Critérios de aceite

- Criar/editar fornecedor: listagem visível ao fundo; 1 painel lateral
- ≤ 2 overlays simultâneos em qualquer fluxo CRUD comum
- Permissões e validações inalteradas

## Dependências

- Issue 013 (contexto API) — concluída
- Issue 031 (tabela preços) — independente; pode rodar em paralelo após piloto fornecedores

## Referências

- `src/app/app/cadastros/fornecedores/page.tsx`
- `src/app/app/cadastros/clientes/page.tsx`
- `src/components/fornecedores/FornecedorCadastroModal.tsx` (referência de campos)

## Fase

**Fase 2** — altera frontend.
