"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckSquare,
  ChevronsDownUp,
  Copy,
  Edit3,
  Eye,
  FileDown,
  FileText,
  Plus,
  Printer,
  Trash2,
} from "lucide-react";
import { ConfirmacaoExclusaoModal } from "@/components/ConfirmacaoExclusaoModal";
import { PainelCarregando } from "@/components/ListaCarregando";
import { usePageReady } from "@/hooks/use-page-ready";
import {
  carregarColaboradoresListagem,
  type ColaboradorListagem,
} from "@/lib/colaboradores-listagem";
import { carregarEtapasCadastro } from "@/lib/etapas-os";
import {
  carregarProdutosListagem,
  PRODUTOS_ESTOQUE_EVENT,
  type ProdutoListagem,
} from "@/lib/produtos-listagem";
import { readStorage, writeStorage } from "@/lib/persisted-storage";

type TipoItemPreco = "servico" | "produto" | "transporte";

type ServicoPreco = {
  id: string;
  nome: string;
  valor: number;
  etapa: string;
  tipo: TipoItemPreco;
  destaque: boolean;
  oculto: boolean;
  descontoRepeticao?: number;
  prazo?: string;
  prazoDentista?: string;
  comissoesColaboradores?: ComissaoServico[];
  comissoesTerceirizados?: ComissaoServico[];
  etapas?: EtapaServico[];
  /** Nomes disponíveis no select de etapas deste serviço */
  opcoesEtapas?: string[];
  produtoId?: string;
  valorCusto?: number;
};

const ETAPAS_OPCOES_PADRAO = ["Entrada", "Produção", "Finalização"];

function nomesEtapasCadastro(): string[] {
  return carregarEtapasCadastro().map((etapa) => etapa.nome);
}

function opcoesEtapasDoServico(servico?: ServicoPreco | null): string[] {
  const cadastro = nomesEtapasCadastro();
  const base =
    cadastro.length > 0
      ? cadastro
      : servico?.opcoesEtapas && servico.opcoesEtapas.length > 0
        ? servico.opcoesEtapas
        : [...ETAPAS_OPCOES_PADRAO];
  const extrasServico = servico?.opcoesEtapas || [];
  const dasLinhas = (servico?.etapas || []).map((etapa) => etapa.nome).filter(Boolean);
  return [...new Set([...base, ...extrasServico, ...dasLinhas])];
}

type ComissaoServico = {
  id: string;
  nome: string;
  valor: string;
  valorRepeticao: string;
  padrao: string;
};

type EtapaServico = {
  id: string;
  nome: string;
  valorHora: string;
};

type CategoriaPreco = {
  id: string;
  nome: string;
  servicos: ServicoPreco[];
};

type ServicoEdicaoRapida = {
  id: string;
  nome: string;
  valor: string;
  oculto: boolean;
};

function normalizarServico(servico: ServicoPreco): ServicoPreco {
  return {
    ...servico,
    tipo: servico.tipo ?? "servico",
    destaque: servico.destaque ?? false,
    oculto: servico.oculto ?? false,
    opcoesEtapas: opcoesEtapasDoServico(servico),
  };
}

function normalizarCategorias(categorias: CategoriaPreco[]): CategoriaPreco[] {
  return categorias.map((categoria) => ({
    ...categoria,
    servicos: categoria.servicos.map(normalizarServico),
  }));
}

function tituloCadastroServico(editando: boolean) {
  return editando ? "Editar Serviço" : "Cadastrar Serviço";
}

function tipoDominanteCategoria(categoria: CategoriaPreco): TipoItemPreco | null {
  if (categoria.servicos.length === 0) return null;
  return normalizarServico(categoria.servicos[0]).tipo;
}

function botoesAdicaoVisiveis(tipo: TipoItemPreco | null) {
  if (!tipo) return { servico: true, produto: true, transporte: true };
  if (tipo === "servico") return { servico: true, produto: false, transporte: false };
  if (tipo === "produto") return { servico: false, produto: true, transporte: false };
  return { servico: false, produto: false, transporte: true };
}

const initialCategorias: CategoriaPreco[] = [
  {
    id: "removivel",
    nome: "REMOVÍVEL",
    servicos: [
      { id: "1", nome: "Acrilização superior", valor: 110, etapa: "Editar Etapas", tipo: "servico", destaque: false, oculto: false },
      { id: "2", nome: "Acrilização par comum", valor: 100, etapa: "Editar Etapas", tipo: "servico", destaque: false, oculto: false },
      { id: "3", nome: "Acrilização total sup", valor: 110, etapa: "Editar Etapas", tipo: "servico", destaque: false, oculto: false },
      { id: "4", nome: "Acrilização TOC FT", valor: 110, etapa: "Editar Etapas", tipo: "servico", destaque: false, oculto: false },
      { id: "5", nome: "Moldeira", valor: 150, etapa: "Editar Etapas", tipo: "servico", destaque: false, oculto: false },
      { id: "6", nome: "Montagem prótese total", valor: 100, etapa: "Editar Etapas", tipo: "servico", destaque: false, oculto: false },
      { id: "7", nome: "Placa de cera", valor: 50, etapa: "Editar Etapas", tipo: "servico", destaque: false, oculto: false },
      { id: "8", nome: "PPR Caracterização", valor: 400, etapa: "Editar Etapas", tipo: "servico", destaque: false, oculto: false },
      { id: "9", nome: "PPR montagem", valor: 100, etapa: "Editar Etapas", tipo: "servico", destaque: false, oculto: false },
      { id: "10", nome: "Prótese total", valor: 370, etapa: "Editar Etapas", tipo: "servico", destaque: false, oculto: false },
      { id: "11", nome: "Provisório total", valor: 270, etapa: "Editar Etapas", tipo: "servico", destaque: false, oculto: false },
      { id: "12", nome: "Reembasamento", valor: 100, etapa: "Editar Etapas", tipo: "servico", destaque: false, oculto: false },
    ],
  },
  {
    id: "protocolo",
    nome: "PROTOCOLO",
    servicos: [
      { id: "13", nome: "Acrilização Caracterizada", valor: 300, etapa: "Editar Etapas", tipo: "servico", destaque: false, oculto: false },
      { id: "14", nome: "Acrilização Imediata", valor: 400, etapa: "Editar Etapas", tipo: "servico", destaque: false, oculto: false },
      { id: "15", nome: "Barra Metálica", valor: 700, etapa: "Editar Etapas", tipo: "servico", destaque: false, oculto: false },
      { id: "16", nome: "Barra Metálica Imediata", valor: 700, etapa: "Editar Etapas", tipo: "servico", destaque: false, oculto: false },
      { id: "17", nome: "Protocolo", valor: 900, etapa: "Editar Etapas", tipo: "servico", destaque: false, oculto: false },
      { id: "18", nome: "Montagem Protocolo", valor: 400, etapa: "Editar Etapas", tipo: "servico", destaque: false, oculto: false },
    ],
  },
];

import {
  sincronizarTabelaPrecosServidor,
  TABELA_PRECOS_STORAGE_KEY,
} from "@/lib/tabela-precos-os";

const dadosPadraoTabelaPrecos = {
  tabela: "Tabela Principal",
  tabelas: ["Tabela Principal", "Metal safira", "tabela del"],
  categoriasPorTabela: {
    "Tabela Principal": initialCategorias,
    "Metal safira": [],
    "tabela del": [],
  } as Record<string, CategoriaPreco[]>,
};

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseMoney(value: string) {
  return Number(value.replace(/\D/g, "")) / 100;
}

function formatMoneyInput(value: string) {
  return parseMoney(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function novaComissaoServico(): ComissaoServico {
  return {
    id: `${Date.now()}-${Math.random()}`,
    nome: "",
    valor: "0,00",
    valorRepeticao: "0,00",
    padrao: "Nao",
  };
}

function novaEtapaServico(): EtapaServico {
  return {
    id: `${Date.now()}-${Math.random()}`,
    nome: "",
    valorHora: "0,00",
  };
}

export default function TabelaPrecosPage() {
  const [tabela, setTabela] = useState("");
  const [tabelas, setTabelas] = useState<string[]>([]);
  const [categoriasPorTabela, setCategoriasPorTabela] = useState<Record<string, CategoriaPreco[]>>({});
  const [visualizacao, setVisualizacao] = useState<"precos" | "minhas">("precos");
  const [dropdownTabelaAberto, setDropdownTabelaAberto] = useState(false);
  const [modalCadastrarTabela, setModalCadastrarTabela] = useState(false);
  const [modalTabelas, setModalTabelas] = useState(false);
  const [modalEditarTabela, setModalEditarTabela] = useState(false);
  const [nomeTabelaEditando, setNomeTabelaEditando] = useState("Tabela Principal");
  const [nomeNovaTabela, setNomeNovaTabela] = useState("");
  const [categoriaServico, setCategoriaServico] = useState<CategoriaPreco | null>(null);
  const [servicoEditando, setServicoEditando] = useState<ServicoPreco | null>(null);
  const [categoriaEdicaoRapida, setCategoriaEdicaoRapida] = useState<string | null>(null);
  const [servicosEdicaoRapida, setServicosEdicaoRapida] = useState<ServicoEdicaoRapida[]>([]);
  const [tipoItemCadastro, setTipoItemCadastro] = useState<TipoItemPreco>("servico");
  const [categoriasRecolhidas, setCategoriasRecolhidas] = useState<Set<string>>(new Set());
  const [modalProdutosCategoriaId, setModalProdutosCategoriaId] = useState<string | null>(null);
  const [produtosEstoque, setProdutosEstoque] = useState<ProdutoListagem[]>([]);
  const [buscaProdutoEstoque, setBuscaProdutoEstoque] = useState("");
  const [produtosSelecionados, setProdutosSelecionados] = useState<Set<string>>(new Set());
  const [carregandoProdutosEstoque, setCarregandoProdutosEstoque] = useState(false);
  const [colaboradoresCadastro, setColaboradoresCadastro] = useState<ColaboradorListagem[]>([]);
  const [modalTransporte, setModalTransporte] = useState<{
    categoriaId: string;
    itemId: string | null;
  } | null>(null);
  const [formTransporte, setFormTransporte] = useState({
    nome: "",
    valor: "0,00",
    oculto: false,
  });
  const [categoriaParaRemover, setCategoriaParaRemover] = useState<{
    id: string;
    nome: string;
  } | null>(null);
  const [modalCadastroEtapasServico, setModalCadastroEtapasServico] = useState(false);
  const [nomeNovaEtapaOpcao, setNomeNovaEtapaOpcao] = useState("");
  const [etapasCadastro, setEtapasCadastro] = useState<string[]>([]);
  const [formServico, setFormServico] = useState({
    nome: "",
    valor: "0,00",
    descontoRepeticao: "0,00",
    prazo: "",
    prazoDentista: "",
    comissoesColaboradores: [] as ComissaoServico[],
    comissoesTerceirizados: [] as ComissaoServico[],
    etapas: [] as EtapaServico[],
    opcoesEtapas: [...ETAPAS_OPCOES_PADRAO] as string[],
  });
  const categorias = categoriasPorTabela[tabela] || [];
  const [persistenciaPronta, setPersistenciaPronta] = useState(false);

  const paginaPronta = usePageReady(() => {
    type DadosTabela = typeof dadosPadraoTabelaPrecos;
    const saved = readStorage<DadosTabela | null>(TABELA_PRECOS_STORAGE_KEY, null);
    if (saved) {
      setTabela(saved.tabela || dadosPadraoTabelaPrecos.tabela);
      setTabelas(saved.tabelas?.length ? saved.tabelas : dadosPadraoTabelaPrecos.tabelas);
      const categoriasSalvas = saved.categoriasPorTabela || dadosPadraoTabelaPrecos.categoriasPorTabela;
      const categoriasNormalizadas = Object.fromEntries(
        Object.entries(categoriasSalvas).map(([nomeTabela, cats]) => [nomeTabela, normalizarCategorias(cats)])
      );
      setCategoriasPorTabela(categoriasNormalizadas);
    } else {
      setTabela(dadosPadraoTabelaPrecos.tabela);
      setTabelas(dadosPadraoTabelaPrecos.tabelas);
      setCategoriasPorTabela(dadosPadraoTabelaPrecos.categoriasPorTabela);
    }
    setPersistenciaPronta(true);
  });

  useEffect(() => {
    if (!persistenciaPronta) return;
    const payload = { tabela, tabelas, categoriasPorTabela };
    writeStorage(TABELA_PRECOS_STORAGE_KEY, payload);
    void sincronizarTabelaPrecosServidor(payload);
  }, [tabela, tabelas, categoriasPorTabela, persistenciaPronta]);

  useEffect(() => {
    if (!paginaPronta || typeof window === "undefined") return;
    function recarregarEtapas() {
      setEtapasCadastro(nomesEtapasCadastro());
    }
    recarregarEtapas();
    window.addEventListener("focus", recarregarEtapas);
    window.addEventListener("storage", recarregarEtapas);
    return () => {
      window.removeEventListener("focus", recarregarEtapas);
      window.removeEventListener("storage", recarregarEtapas);
    };
  }, [paginaPronta]);

  function atualizarCategorias(updater: (atuais: CategoriaPreco[]) => CategoriaPreco[]) {
    setCategoriasPorTabela((atuais) => ({
      ...atuais,
      [tabela]: updater(atuais[tabela] || []),
    }));
  }

  const totalServicos = useMemo(
    () => categorias.reduce((sum, categoria) => sum + categoria.servicos.length, 0),
    [categorias]
  );

  const produtosFiltradosModal = useMemo(() => {
    const termo = buscaProdutoEstoque.trim().toLowerCase();
    return produtosEstoque.filter(
      (produto) =>
        !termo ||
        produto.nome.toLowerCase().includes(termo) ||
        (produto.marca || "").toLowerCase().includes(termo)
    );
  }, [produtosEstoque, buscaProdutoEstoque]);

  function adicionarCategoria() {
    const nome = window.prompt("Nome da categoria");
    if (!nome?.trim()) return;
    atualizarCategorias((atuais) => [
      ...atuais,
      { id: `${Date.now()}`, nome: nome.trim().toUpperCase(), servicos: [] },
    ]);
  }

  function adicionarTabela() {
    setNomeNovaTabela("");
    setModalCadastrarTabela(true);
    setDropdownTabelaAberto(false);
  }

  function cadastrarTabela() {
    const nome = nomeNovaTabela.trim();
    if (!nome) return;
    setTabelas((atuais) => [...atuais, nome]);
    setCategoriasPorTabela((atuais) => ({
      ...atuais,
      [nome]: [],
    }));
    setTabela(nome);
    setVisualizacao("precos");
    setNomeNovaTabela("");
    setModalCadastrarTabela(false);
  }

  function abrirEditarTabela() {
    setNomeTabelaEditando(tabela);
    setModalEditarTabela(true);
  }

  function salvarTabelaEditada() {
    if (!nomeTabelaEditando.trim()) return;
    const novoNome = nomeTabelaEditando.trim();
    setTabelas((atuais) => atuais.map((item) => (item === tabela ? novoNome : item)));
    setCategoriasPorTabela((atuais) => {
      const categoriasAtuais = atuais[tabela] || [];
      const { [tabela]: _removida, ...resto } = atuais;
      return {
        ...resto,
        [novoNome]: categoriasAtuais,
      };
    });
    setTabela(novoNome);
    setModalEditarTabela(false);
  }

  const recarregarColaboradores = useCallback(() => {
    setColaboradoresCadastro(carregarColaboradoresListagem());
  }, []);

  useEffect(() => {
    if (!categoriaServico) return;
    recarregarColaboradores();
    const atualizar = () => recarregarColaboradores();
    window.addEventListener("focus", atualizar);
    window.addEventListener("storage", atualizar);
    return () => {
      window.removeEventListener("focus", atualizar);
      window.removeEventListener("storage", atualizar);
    };
  }, [categoriaServico, recarregarColaboradores]);

  function selecionarColaboradorComissao(comissaoId: string, valor: string) {
    if (valor === "__adicionar_colaborador__") return;
    const colaborador = colaboradoresCadastro.find((item) => item.nome === valor);
    setFormServico((atual) => ({
      ...atual,
      comissoesColaboradores: atual.comissoesColaboradores.map((item) =>
        item.id === comissaoId
          ? {
              ...item,
              nome: valor,
              valor: colaborador?.comissaoPercentual ?? item.valor,
              valorRepeticao: colaborador?.comissaoRepeticao ?? item.valorRepeticao,
              padrao: colaborador?.padraoComissao ?? item.padrao,
            }
          : item
      ),
    }));
  }

  const recarregarProdutosEstoque = useCallback(async () => {
    setCarregandoProdutosEstoque(true);
    try {
      const lista = await carregarProdutosListagem();
      setProdutosEstoque(lista);
    } finally {
      setCarregandoProdutosEstoque(false);
    }
  }, []);

  useEffect(() => {
    if (!modalProdutosCategoriaId) return;
    void recarregarProdutosEstoque();
    const atualizar = () => void recarregarProdutosEstoque();
    window.addEventListener(PRODUTOS_ESTOQUE_EVENT, atualizar);
    window.addEventListener("focus", atualizar);
    return () => {
      window.removeEventListener(PRODUTOS_ESTOQUE_EVENT, atualizar);
      window.removeEventListener("focus", atualizar);
    };
  }, [modalProdutosCategoriaId, recarregarProdutosEstoque]);

  function abrirCadastroServico(categoriaId: string) {
    const categoria = categorias.find((item) => item.id === categoriaId) || null;
    setTipoItemCadastro("servico");
    setCategoriaServico(categoria);
    setFormServico({
      nome: "",
      valor: "0,00",
      descontoRepeticao: "0,00",
      prazo: "",
      prazoDentista: "",
      comissoesColaboradores: [],
      comissoesTerceirizados: [],
      etapas: [],
      opcoesEtapas: etapasCadastro.length > 0 ? [...etapasCadastro] : [...ETAPAS_OPCOES_PADRAO],
    });
    setServicoEditando(null);
  }

  function abrirModalCadastroEtapasServico() {
    setNomeNovaEtapaOpcao("");
    setModalCadastroEtapasServico(true);
  }

  function adicionarOpcaoEtapaServico() {
    const nome = nomeNovaEtapaOpcao.trim();
    if (!nome) return;
    setFormServico((atual) => {
      if (atual.opcoesEtapas.some((item) => item.toLowerCase() === nome.toLowerCase())) {
        return atual;
      }
      return { ...atual, opcoesEtapas: [...atual.opcoesEtapas, nome] };
    });
    setNomeNovaEtapaOpcao("");
  }

  function removerOpcaoEtapaServico(nome: string) {
    if (ETAPAS_OPCOES_PADRAO.includes(nome)) return;
    setFormServico((atual) => ({
      ...atual,
      opcoesEtapas: atual.opcoesEtapas.filter((item) => item !== nome),
      etapas: atual.etapas.map((etapa) => (etapa.nome === nome ? { ...etapa, nome: "" } : etapa)),
    }));
  }

  function abrirModalProdutos(categoriaId: string) {
    setModalProdutosCategoriaId(categoriaId);
    setBuscaProdutoEstoque("");
    setProdutosSelecionados(new Set());
  }

  function fecharModalProdutos() {
    setModalProdutosCategoriaId(null);
    setProdutosSelecionados(new Set());
    setBuscaProdutoEstoque("");
  }

  function abrirModalTransporte(categoriaId: string, item?: ServicoPreco) {
    setModalTransporte({ categoriaId, itemId: item?.id ?? null });
    setFormTransporte({
      nome: item?.nome ?? "",
      valor: item ? money(item.valor) : "0,00",
      oculto: item?.oculto ?? false,
    });
  }

  function fecharModalTransporte() {
    setModalTransporte(null);
    setFormTransporte({ nome: "", valor: "0,00", oculto: false });
  }

  function adicionarProdutosNaTabela() {
    if (!modalProdutosCategoriaId || produtosSelecionados.size === 0) return;
    const categoria = categorias.find((item) => item.id === modalProdutosCategoriaId);
    if (!categoria) return;

    const idsJaNaCategoria = new Set(
      categoria.servicos.filter((item) => item.produtoId).map((item) => item.produtoId as string)
    );
    const novos: ServicoPreco[] = [];

    produtosSelecionados.forEach((produtoId) => {
      if (idsJaNaCategoria.has(produtoId)) return;
      const produto = produtosEstoque.find((item) => item.id === produtoId);
      if (!produto) return;
      novos.push({
        id: `prod-${produtoId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nome: produto.nome,
        valor: Number(produto.valor) || 0,
        valorCusto: Number(produto.valorCusto) || 0,
        produtoId: produto.id,
        etapa: "",
        tipo: "produto",
        destaque: false,
        oculto: false,
      });
    });

    if (novos.length === 0) {
      fecharModalProdutos();
      return;
    }

    atualizarCategorias((atuais) =>
      atuais.map((cat) =>
        cat.id === modalProdutosCategoriaId ? { ...cat, servicos: [...cat.servicos, ...novos] } : cat
      )
    );
    fecharModalProdutos();
  }

  function gravarTransporte() {
    if (!modalTransporte || !formTransporte.nome.trim()) return;
    const valor = parseMoney(formTransporte.valor);
    const { categoriaId, itemId } = modalTransporte;

    atualizarCategorias((atuais) =>
      atuais.map((categoria) => {
        if (categoria.id !== categoriaId) return categoria;
        if (itemId) {
          return {
            ...categoria,
            servicos: categoria.servicos.map((item) =>
              item.id === itemId
                ? {
                    ...item,
                    nome: formTransporte.nome.trim(),
                    valor,
                    oculto: formTransporte.oculto,
                    tipo: "transporte",
                  }
                : item
            ),
          };
        }
        return {
          ...categoria,
          servicos: [
            ...categoria.servicos,
            {
              id: `${Date.now()}`,
              nome: formTransporte.nome.trim(),
              valor,
              etapa: "",
              tipo: "transporte",
              destaque: false,
              oculto: formTransporte.oculto,
            },
          ],
        };
      })
    );
    fecharModalTransporte();
  }

  function editarItemCategoria(categoria: CategoriaPreco, item: ServicoPreco) {
    const tipo = normalizarServico(item).tipo;
    if (tipo === "transporte") {
      abrirModalTransporte(categoria.id, item);
      return;
    }
    if (tipo === "produto") return;
    editarServico(categoria, item);
  }

  function editarNomeCategoria(categoria: CategoriaPreco) {
    const nome = window.prompt("Nome da categoria", categoria.nome);
    if (!nome?.trim()) return;
    atualizarCategorias((atuais) =>
      atuais.map((item) => (item.id === categoria.id ? { ...item, nome: nome.trim().toUpperCase() } : item))
    );
  }

  function solicitarRemoverCategoria(categoriaId: string) {
    const categoria = categorias.find((item) => item.id === categoriaId);
    if (!categoria) return;
    setCategoriaParaRemover({ id: categoriaId, nome: categoria.nome });
  }

  function confirmarRemoverCategoria() {
    if (!categoriaParaRemover) return;
    const categoriaId = categoriaParaRemover.id;
    atualizarCategorias((atuais) => atuais.filter((item) => item.id !== categoriaId));
    setCategoriasRecolhidas((atuais) => {
      const proximo = new Set(atuais);
      proximo.delete(categoriaId);
      return proximo;
    });
    setCategoriaParaRemover(null);
  }

  function toggleRecolherCategoria(categoriaId: string) {
    setCategoriasRecolhidas((atuais) => {
      const proximo = new Set(atuais);
      if (proximo.has(categoriaId)) proximo.delete(categoriaId);
      else proximo.add(categoriaId);
      return proximo;
    });
  }

  function cadastrarServico() {
    if (!categoriaServico || !formServico.nome.trim()) return;
    const valor = parseMoney(formServico.valor);
    atualizarCategorias((atuais) =>
      atuais.map((categoria) =>
        categoria.id === categoriaServico.id
          ? {
              ...categoria,
              servicos: servicoEditando
                ? categoria.servicos.map((servico) =>
                    servico.id === servicoEditando.id
                      ? {
                          ...servico,
                          tipo: tipoItemCadastro,
                          nome: formServico.nome.trim(),
                          valor,
                          descontoRepeticao: parseMoney(formServico.descontoRepeticao),
                          prazo: formServico.prazo,
                          prazoDentista: formServico.prazoDentista,
                          comissoesColaboradores: formServico.comissoesColaboradores,
                          comissoesTerceirizados: formServico.comissoesTerceirizados,
                          etapas: formServico.etapas,
                          opcoesEtapas: formServico.opcoesEtapas,
                        }
                      : servico
                  )
                : [
                    ...categoria.servicos,
                    {
                      id: `${Date.now()}`,
                      nome: formServico.nome.trim(),
                      valor,
                      descontoRepeticao: parseMoney(formServico.descontoRepeticao),
                      prazo: formServico.prazo,
                      prazoDentista: formServico.prazoDentista,
                      comissoesColaboradores: formServico.comissoesColaboradores,
                      comissoesTerceirizados: formServico.comissoesTerceirizados,
                      etapas: formServico.etapas,
                      opcoesEtapas: formServico.opcoesEtapas,
                      etapa: "Editar Etapas",
                      tipo: tipoItemCadastro,
                      destaque: false,
                      oculto: false,
                    },
                  ],
            }
          : categoria
      )
    );
    setCategoriaServico(null);
    setServicoEditando(null);
  }

  function editarServico(categoria: CategoriaPreco, servico: ServicoPreco) {
    setTipoItemCadastro("servico");
    setCategoriaServico(categoria);
    setServicoEditando(servico);
    setFormServico({
      nome: servico.nome,
      valor: money(servico.valor),
      descontoRepeticao: money(servico.descontoRepeticao || 0),
      prazo: servico.prazo || "",
      prazoDentista: servico.prazoDentista || "",
      comissoesColaboradores: servico.comissoesColaboradores || [],
      comissoesTerceirizados: servico.comissoesTerceirizados || [],
      etapas: servico.etapas || [],
      opcoesEtapas: opcoesEtapasDoServico(servico),
    });
  }

  function atualizarComissao(
    tipo: "comissoesColaboradores" | "comissoesTerceirizados",
    id: string,
    campo: keyof ComissaoServico,
    valor: string
  ) {
    setFormServico((current) => ({
      ...current,
      [tipo]: current[tipo].map((item) => (item.id === id ? { ...item, [campo]: valor } : item)),
    }));
  }

  function adicionarComissao(tipo: "comissoesColaboradores" | "comissoesTerceirizados") {
    setFormServico((current) => ({
      ...current,
      [tipo]: [...current[tipo], novaComissaoServico()],
    }));
  }

  function removerComissao(tipo: "comissoesColaboradores" | "comissoesTerceirizados", id: string) {
    setFormServico((current) => ({
      ...current,
      [tipo]: current[tipo].filter((item) => item.id !== id),
    }));
  }

  function atualizarEtapa(id: string, campo: keyof EtapaServico, valor: string) {
    setFormServico((current) => ({
      ...current,
      etapas: current.etapas.map((item) => (item.id === id ? { ...item, [campo]: valor } : item)),
    }));
  }

  function adicionarEtapa() {
    setFormServico((current) => ({
      ...current,
      etapas: [...current.etapas, novaEtapaServico()],
    }));
  }

  function removerEtapa(id: string) {
    setFormServico((current) => ({
      ...current,
      etapas: current.etapas.filter((item) => item.id !== id),
    }));
  }

  function removerServico(categoriaId: string, servicoId: string) {
    atualizarCategorias((atuais) =>
      atuais.map((categoria) =>
        categoria.id === categoriaId
          ? { ...categoria, servicos: categoria.servicos.filter((servico) => servico.id !== servicoId) }
          : categoria
      )
    );
  }

  function toggleOculto(categoriaId: string, servicoId: string) {
    atualizarCategorias((atuais) =>
      atuais.map((categoria) =>
        categoria.id === categoriaId
          ? {
              ...categoria,
              servicos: categoria.servicos.map((servico) =>
                servico.id === servicoId ? { ...servico, oculto: !servico.oculto } : servico
              ),
            }
          : categoria
      )
    );
  }

  function abrirEdicaoRapida(categoria: CategoriaPreco) {
    setCategoriaEdicaoRapida(categoria.id);
    setServicosEdicaoRapida(
      categoria.servicos.map((servico) => ({
        id: servico.id,
        nome: servico.nome,
        valor: money(servico.valor),
        oculto: servico.oculto ?? false,
      }))
    );
  }

  function atualizarServicoRapido(id: string, campo: keyof ServicoEdicaoRapida, valor: string | boolean) {
    setServicosEdicaoRapida((atuais) =>
      atuais.map((servico) => (servico.id === id ? { ...servico, [campo]: valor } : servico))
    );
  }

  function salvarEdicaoRapida() {
    if (!categoriaEdicaoRapida) return;
    atualizarCategorias((atuais) =>
      atuais.map((categoria) =>
        categoria.id === categoriaEdicaoRapida
          ? {
              ...categoria,
              servicos: categoria.servicos.map((servico) => {
                const editado = servicosEdicaoRapida.find((item) => item.id === servico.id);
                return editado
                  ? {
                      ...servico,
                      nome: editado.nome,
                      valor: parseMoney(editado.valor),
                      oculto: editado.oculto,
                    }
                  : servico;
              }),
            }
          : categoria
      )
    );
    setCategoriaEdicaoRapida(null);
    setServicosEdicaoRapida([]);
  }

  function cancelarEdicaoRapida() {
    setCategoriaEdicaoRapida(null);
    setServicosEdicaoRapida([]);
  }

  if (!paginaPronta) {
    return (
      <div className="space-y-4 text-xs text-slate-600">
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span>Cadastros</span>
          <span className="text-slate-300">/</span>
          <span className="text-slate-600">Tabela de Preços</span>
        </div>
        <PainelCarregando mensagem="Carregando tabela de preços..." />
      </div>
    );
  }

  return (
    <div className="space-y-4 text-xs text-slate-600">
      <div className="flex items-center gap-2 text-[11px] text-slate-500">
        <span>Cadastros</span>
        <span className="text-slate-300">/</span>
        <span className="text-slate-600">Tabela de Preços</span>
      </div>

      <div className="rounded border border-slate-200 bg-white px-3 py-4 shadow-sm">
        <div className="mb-4 flex justify-center gap-6 text-[11px] text-slate-500">
          <button type="button" onClick={() => setVisualizacao("minhas")} className={visualizacao === "minhas" ? "font-semibold text-primary-700" : "hover:text-primary-700"}>
            Minhas Tabelas
          </button>
          <button type="button" onClick={() => setVisualizacao("precos")} className={visualizacao === "precos" ? "border-b border-primary-600 font-semibold text-primary-700" : "hover:text-primary-700"}>
            Editar Tabela
          </button>
        </div>

        {visualizacao === "precos" && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="relative w-full max-w-[520px] space-y-1">
            <label className="block text-[11px] text-slate-600">Selecione uma Tabela</label>
            <button
              type="button"
              onClick={() => setDropdownTabelaAberto((aberto) => !aberto)}
              className="flex h-9 w-full items-center justify-between rounded border border-slate-300 bg-white px-2 text-left text-xs text-slate-600 outline-none hover:border-primary-400"
            >
              <span>{tabela}</span>
              <span className="text-slate-400">⌄</span>
            </button>
            {dropdownTabelaAberto && (
              <div className="absolute left-0 top-full z-50 mt-1 w-full overflow-hidden rounded border border-slate-300 bg-white text-xs shadow-xl">
                <button
                  type="button"
                  onClick={adicionarTabela}
                  className="flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2 text-left font-semibold text-emerald-600 hover:bg-emerald-50"
                >
                  + Adicionar Tabela
                </button>
                {tabelas.map((item) => {
                  const selected = item === tabela;
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setTabela(item);
                        setDropdownTabelaAberto(false);
                      }}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left ${
                        selected
                          ? "bg-blue-600 font-semibold text-white"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <span>{item}</span>
                      {selected && <span>✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 rounded bg-slate-500 px-2 py-1 text-white">
            {[Eye, FileText, FileDown, Printer, Copy, CheckSquare].map((Icon, index) => (
              <button key={index} type="button" className="rounded p-1 hover:bg-slate-600">
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={adicionarCategoria}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded bg-emerald-500 px-3 py-2 text-[11px] font-semibold text-white hover:bg-emerald-600"
        >
          <Plus className="h-4 w-4" />
          Adicionar Categoria
        </button>
        </>
        )}
      </div>

      {visualizacao === "minhas" && (
        <div className="rounded border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-3 py-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={adicionarTabela}
                className="rounded bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-600"
              >
                + Adicionar Tabela
              </button>
              <button
                type="button"
                className="rounded border border-blue-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-blue-600 hover:bg-blue-50"
              >
                Ver Excluídas
              </button>
            </div>
            <div className="flex min-w-[320px] max-w-lg flex-1 justify-end">
              <input
                className="h-8 w-full max-w-md rounded border border-slate-300 px-3 text-xs outline-none focus:border-primary-500"
                placeholder="Procurar"
              />
              <button type="button" className="h-8 rounded-r bg-slate-500 px-4 text-[11px] font-semibold text-white">
                Limpar
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-[11px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
                  <th className="px-3 py-2 text-left font-semibold">NOME DA TABELA</th>
                  <th className="px-3 py-2 text-left font-semibold">SELECIONAR CLIENTES</th>
                  <th className="px-3 py-2 text-left font-semibold">DUPLICAR</th>
                  <th className="px-3 py-2 text-center font-semibold">OPÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tabelas.map((item) => (
                  <tr key={item} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-600">{item}</td>
                    <td className="px-3 py-2">
                      <button type="button" className="text-primary-700 hover:underline">
                        Clientes
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <button type="button" className="text-primary-700 hover:underline">
                        Duplicar
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-center gap-3">
                        <button type="button" className="text-slate-500 hover:text-primary-700">
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTabela(item);
                            abrirEditarTabela();
                          }}
                          className="text-slate-500 hover:text-primary-700"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" className="text-red-400 hover:text-red-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" className="text-slate-500 hover:text-primary-700">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {visualizacao === "precos" && (
        <>
          <div className="space-y-4">
            {categorias.map((categoria) => {
              const editandoRapido = categoriaEdicaoRapida === categoria.id;
              const servicosRapidos = editandoRapido ? servicosEdicaoRapida : [];
              const recolhida = categoriasRecolhidas.has(categoria.id);
              const tipoCategoria = tipoDominanteCategoria(categoria);
              const botoesAdicao = botoesAdicaoVisiveis(tipoCategoria);

              return (
              <section key={categoria.id} className="rounded border border-primary-300 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
              <h2 className="text-xs font-bold uppercase text-slate-600">{categoria.nome}</h2>
              <div className="flex items-center gap-2 text-slate-400">
                <button type="button" title="Selecionar" className="hover:text-primary-700">
                  <CheckSquare className="h-3.5 w-3.5" />
                </button>
                <button type="button" title="Visualizar" className="hover:text-primary-700">
                  <Eye className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="Editar categoria"
                  onClick={() => editarNomeCategoria(categoria)}
                  className="hover:text-primary-700"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="Excluir categoria"
                  onClick={() => solicitarRemoverCategoria(categoria.id)}
                  className="text-red-400 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title={recolhida ? "Expandir" : "Recolher"}
                  onClick={() => toggleRecolherCategoria(categoria.id)}
                  className="hover:text-primary-700"
                >
                  <ChevronsDownUp className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {!recolhida && (editandoRapido ? (
            <div className="overflow-x-auto p-3">
              <table className="w-full min-w-[900px] text-[10px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-[#f4f3fb] text-slate-500">
                    <th className="px-3 py-2 text-center font-semibold uppercase">NOME SERVIÇO</th>
                    <th className="w-28 px-3 py-2 text-center font-semibold uppercase">VALOR</th>
                    <th className="w-40 px-3 py-2 text-center font-semibold uppercase">ETAPAS</th>
                    <th className="w-28 px-3 py-2 text-center font-semibold uppercase">OCULTAR</th>
                    <th className="w-24 px-3 py-2 text-center font-semibold uppercase">OPÇÕES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {servicosRapidos.map((servico) => (
                    <tr key={servico.id}>
                      <td className="px-3 py-1.5">
                        <input
                          value={servico.nome}
                          onChange={(event) => atualizarServicoRapido(servico.id, "nome", event.target.value)}
                          className="h-7 w-full rounded border border-slate-200 px-2 text-[10px] text-slate-600 outline-none focus:border-blue-400"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          value={servico.valor}
                          onChange={(event) => atualizarServicoRapido(servico.id, "valor", formatMoneyInput(event.target.value))}
                          className="h-7 w-full rounded border border-slate-200 px-2 text-right text-[10px] text-slate-600 outline-none focus:border-blue-400"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            const original = categoria.servicos.find((item) => item.id === servico.id);
                            if (original) editarItemCategoria(categoria, original);
                          }}
                          className="text-blue-600 hover:underline"
                        >
                          Editar Etapas
                        </button>
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={servico.oculto}
                          onChange={(event) => atualizarServicoRapido(servico.id, "oculto", event.target.checked)}
                          className="h-3.5 w-3.5 accent-primary-600"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const original = categoria.servicos.find((item) => item.id === servico.id);
                              if (original) editarItemCategoria(categoria, original);
                            }}
                            className="text-slate-500 hover:text-primary-700"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              removerServico(categoria.id, servico.id);
                              setServicosEdicaoRapida((atuais) => atuais.filter((item) => item.id !== servico.id));
                            }}
                            className="text-red-400 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={salvarEdicaoRapida}
                  className="rounded bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700"
                >
                  Salvar Alterações
                </button>
                <button
                  type="button"
                  onClick={cancelarEdicaoRapida}
                  className="rounded bg-red-400 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-red-500"
                >
                  Cancelar
                </button>
              </div>
            </div>
            ) : (
            <div className="overflow-x-auto p-3">
              <table className="w-full min-w-[900px] text-[11px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-[#f4f3fb] text-slate-500">
                    <th className="px-3 py-2 text-left font-semibold uppercase">Nome serviço</th>
                    <th className="w-28 px-3 py-2 text-right font-semibold uppercase">Valor</th>
                    <th className="w-40 px-3 py-2 text-center font-semibold uppercase">Etapas</th>
                    <th className="w-28 px-3 py-2 text-center font-semibold uppercase">Ocultar</th>
                    <th className="w-24 px-3 py-2 text-center font-semibold">OPÇÕES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {categoria.servicos.map((servico) => {
                    const item = normalizarServico(servico);
                    return (
                    <tr key={servico.id} className="hover:bg-slate-50">
                      <td className="px-3 py-1.5 text-slate-600">{item.nome}</td>
                      <td className="px-3 py-1.5 text-right text-slate-700">{money(item.valor)}</td>
                      <td className="px-3 py-1.5 text-center">
                        {item.tipo === "servico" ? (
                        <button
                          type="button"
                          onClick={() => editarServico(categoria, item)}
                          className="text-primary-700 hover:underline"
                        >
                          {item.etapa}
                        </button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={servico.oculto}
                          onChange={() => toggleOculto(categoria.id, servico.id)}
                          className="h-3.5 w-3.5 accent-primary-600"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => editarItemCategoria(categoria, item)}
                            className="text-slate-500 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={item.tipo === "produto"}
                            title={item.tipo === "produto" ? "Edite o produto no estoque" : "Editar"}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removerServico(categoria.id, servico.id)}
                            className="text-red-400 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                  {categoria.servicos.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-slate-400">
                        Nenhum serviço cadastrado nesta categoria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            ))}

            {!recolhida && !editandoRapido && (
            <div className="flex flex-wrap gap-2 border-t border-slate-100 px-3 py-2">
              {botoesAdicao.servico && (
              <button
                type="button"
                onClick={() => abrirCadastroServico(categoria.id)}
                className="inline-flex items-center gap-1 rounded bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-600"
              >
                <Plus className="h-3 w-3" />
                Serviço
              </button>
              )}
              {botoesAdicao.produto && (
              <button
                type="button"
                onClick={() => abrirModalProdutos(categoria.id)}
                className="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700"
              >
                <Plus className="h-3 w-3" />
                Produto
              </button>
              )}
              {botoesAdicao.transporte && (
              <button
                type="button"
                onClick={() => abrirModalTransporte(categoria.id)}
                className="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700"
              >
                <Plus className="h-3 w-3" />
                Transporte
              </button>
              )}
            </div>
            )}
              </section>
              );
            })}
          </div>

          <div className="text-right text-[11px] text-slate-400">
            Total de serviços: {totalServicos}
          </div>
        </>
      )}

      {modalTabelas && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-700">Minhas Tabelas</h2>
              <button type="button" onClick={() => setModalTabelas(false)} className="text-slate-400 hover:text-slate-700">
                ×
              </button>
            </div>
            <div className="p-5">
              <div className="space-y-2">
                {tabelas.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setTabela(item);
                      setModalTabelas(false);
                    }}
                    className={`flex w-full items-center justify-between rounded border px-3 py-2 text-left text-xs ${
                      item === tabela
                        ? "border-primary-300 bg-primary-50 text-primary-700"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <span>{item}</span>
                    {item === tabela && <span>Atual</span>}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={adicionarTabela}
                className="mt-4 w-full rounded bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
              >
                + Nova Tabela
              </button>
            </div>
          </div>
        </div>
      )}

      {modalCadastrarTabela && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/45 p-4 pt-16">
          <div className="relative w-full max-w-sm rounded bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-medium text-slate-700">Cadastrar Tabela</h2>
              <button
                type="button"
                onClick={() => setModalCadastrarTabela(false)}
                className="flex h-7 w-7 items-center justify-center rounded bg-white text-xl leading-none text-slate-500 hover:bg-slate-100"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            <div className="space-y-4 px-4 py-4">
              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-slate-600">Nome da Tabela</label>
                <input
                  value={nomeNovaTabela}
                  onChange={(event) => setNomeNovaTabela(event.target.value)}
                  placeholder="Digite o nome da Tabela"
                  className="h-9 w-full rounded border border-slate-300 px-3 text-xs outline-none focus:border-primary-500"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={cadastrarTabela}
                  className="rounded bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Cadastrar Tabela
                </button>
                <button
                  type="button"
                  onClick={() => setModalCadastrarTabela(false)}
                  className="rounded border border-slate-300 bg-white px-4 py-2 text-xs text-slate-600 hover:bg-slate-50"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {categoriaServico && tipoItemCadastro === "servico" && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/45 p-4 pt-16">
          <div className="relative w-full max-w-6xl rounded bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-medium text-slate-700">
                {tituloCadastroServico(Boolean(servicoEditando))} — Categoria: {categoriaServico.nome}
              </h2>
              <button
                type="button"
                onClick={() => setCategoriaServico(null)}
                className="flex h-7 w-7 items-center justify-center rounded bg-white text-xl leading-none text-slate-500 hover:bg-slate-100"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            <div className="space-y-8 px-6 py-6 text-xs text-slate-600">
              <div className="grid gap-4 md:grid-cols-[1.4fr_0.85fr_0.85fr_0.65fr_0.65fr]">
                <div className="space-y-1">
                  <label className="block text-[11px] text-slate-600">Nome do Serviço</label>
                  <input
                    value={formServico.nome}
                    onChange={(event) => setFormServico((current) => ({ ...current, nome: event.target.value }))}
                    className="h-9 w-full rounded border border-slate-300 px-3 text-xs outline-none focus:border-primary-500"
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] text-slate-600">Valor</label>
                  <div className="flex h-9 overflow-hidden rounded border border-slate-300 bg-white">
                    <span className="flex w-9 items-center justify-center border-r border-slate-200 text-xs text-slate-500">$</span>
                    <input
                      value={formServico.valor}
                      onChange={(event) =>
                        setFormServico((current) => ({ ...current, valor: formatMoneyInput(event.target.value) }))
                      }
                      className="w-full px-3 text-xs outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] text-slate-600">Desconto Repetição</label>
                  <div className="flex h-9 overflow-hidden rounded border border-slate-300 bg-white">
                    <span className="flex w-9 items-center justify-center border-r border-slate-200 text-xs text-slate-500">%</span>
                    <input
                      value={formServico.descontoRepeticao}
                      onChange={(event) =>
                        setFormServico((current) => ({ ...current, descontoRepeticao: formatMoneyInput(event.target.value) }))
                      }
                      className="w-full px-3 text-xs outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] text-slate-600">Prazo Lab</label>
                  <input
                    value={formServico.prazo}
                    onChange={(event) => setFormServico((current) => ({ ...current, prazo: event.target.value }))}
                    placeholder="Dias"
                    className="h-9 w-full rounded border border-slate-300 px-3 text-xs outline-none focus:border-primary-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] text-slate-600">Prazo Dentista</label>
                  <input
                    value={formServico.prazoDentista}
                    onChange={(event) =>
                      setFormServico((current) => ({ ...current, prazoDentista: event.target.value }))
                    }
                    placeholder="Dias antes"
                    title="Dias antes do prazo do laboratório para entrega ao dentista"
                    className="h-9 w-full rounded border border-slate-300 px-3 text-xs outline-none focus:border-primary-500"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-5">
                <p className="mb-4 flex items-center gap-2 text-sm text-slate-600">
                  <span>$</span> Comissão Colaboradores
                </p>
                <div className="space-y-3">
                  {formServico.comissoesColaboradores.map((comissao, index) => (
                    <div key={comissao.id} className="grid items-end gap-3 md:grid-cols-[1.3fr_0.8fr_0.8fr_0.35fr_0.1fr]">
                      <div className="space-y-1">
                        <label className="block text-[11px] text-slate-600">Colaborador {index + 1}</label>
                        <select
                          value={comissao.nome}
                          onChange={(event) => {
                            const valor = event.target.value;
                            if (valor === "__adicionar_colaborador__") return;
                            selecionarColaboradorComissao(comissao.id, valor);
                          }}
                          className="h-9 w-full rounded border border-slate-300 bg-white px-3 text-xs outline-none focus:border-primary-500"
                        >
                          <option value="">Selecione</option>
                          {colaboradoresCadastro.map((colaborador) => (
                            <option key={colaborador.id} value={colaborador.nome}>
                              {colaborador.nome}
                            </option>
                          ))}
                          {comissao.nome &&
                            !colaboradoresCadastro.some((item) => item.nome === comissao.nome) && (
                              <option value={comissao.nome}>{comissao.nome}</option>
                            )}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[11px] text-slate-600">Valor da Comissão</label>
                        <div className="flex h-9 overflow-hidden rounded border border-slate-300 bg-white">
                          <span className="flex w-9 items-center justify-center border-r border-slate-200 text-xs text-slate-500">%</span>
                          <input
                            value={comissao.valor}
                            onChange={(event) =>
                              atualizarComissao(
                                "comissoesColaboradores",
                                comissao.id,
                                "valor",
                                formatMoneyInput(event.target.value)
                              )
                            }
                            className="w-full px-3 text-xs outline-none"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[11px] text-slate-600">Valor da Comissão (Repetição)</label>
                        <div className="flex h-9 overflow-hidden rounded border border-slate-300 bg-white">
                          <span className="flex w-9 items-center justify-center border-r border-slate-200 text-xs text-slate-500">%</span>
                          <input
                            value={comissao.valorRepeticao}
                            onChange={(event) =>
                              atualizarComissao(
                                "comissoesColaboradores",
                                comissao.id,
                                "valorRepeticao",
                                formatMoneyInput(event.target.value)
                              )
                            }
                            className="w-full px-3 text-xs outline-none"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[11px] text-slate-600">Padrão</label>
                        <select
                          value={comissao.padrao}
                          onChange={(event) =>
                            atualizarComissao("comissoesColaboradores", comissao.id, "padrao", event.target.value)
                          }
                          className="h-9 w-full rounded border border-slate-300 bg-white px-2 text-xs outline-none focus:border-primary-500"
                        >
                          <option>Nao</option>
                          <option>Sim</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => removerComissao("comissoesColaboradores", comissao.id)}
                        className="mb-1 flex h-8 w-8 items-center justify-center rounded border border-red-200 text-red-500 hover:bg-red-50"
                        aria-label="Remover comissão colaborador"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => adicionarComissao("comissoesColaboradores")}
                    className="rounded bg-emerald-500 px-4 py-2 text-[11px] font-semibold text-white hover:bg-emerald-600"
                  >
                    + Comissão Colaborador
                  </button>
                  <Link
                    href="/app/cadastros/colaboradores"
                    className="rounded border border-blue-200 bg-blue-50 px-4 py-2 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    + Adicionar Colaborador
                  </Link>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-5">
                <p className="mb-4 flex items-center gap-2 text-sm text-slate-600">
                  <span>$</span> Comissão Serviços Terceirizados
                </p>
                <div className="space-y-3">
                  {formServico.comissoesTerceirizados.map((comissao, index) => (
                    <div key={comissao.id} className="grid items-end gap-3 md:grid-cols-[1.3fr_0.8fr_0.8fr_0.35fr_0.1fr]">
                      <div className="space-y-1">
                        <label className="block text-[11px] text-slate-600">Prestador-{index + 1}</label>
                        <select
                          value={comissao.nome}
                          onChange={(event) =>
                            atualizarComissao("comissoesTerceirizados", comissao.id, "nome", event.target.value)
                          }
                          className="h-9 w-full rounded border border-slate-300 bg-white px-3 text-xs outline-none focus:border-primary-500"
                        >
                          <option value="">Selecione</option>
                          <option value="Prestador 1">Prestador 1</option>
                          <option value="Prestador 2">Prestador 2</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[11px] text-slate-600">Valor da Comissão</label>
                        <div className="flex h-9 overflow-hidden rounded border border-slate-300 bg-white">
                          <span className="flex w-9 items-center justify-center border-r border-slate-200 text-xs text-slate-500">%</span>
                          <input
                            value={comissao.valor}
                            onChange={(event) =>
                              atualizarComissao(
                                "comissoesTerceirizados",
                                comissao.id,
                                "valor",
                                formatMoneyInput(event.target.value)
                              )
                            }
                            className="w-full px-3 text-xs outline-none"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[11px] text-slate-600">Valor da Comissão (Repetição)</label>
                        <div className="flex h-9 overflow-hidden rounded border border-slate-300 bg-white">
                          <span className="flex w-9 items-center justify-center border-r border-slate-200 text-xs text-slate-500">%</span>
                          <input
                            value={comissao.valorRepeticao}
                            onChange={(event) =>
                              atualizarComissao(
                                "comissoesTerceirizados",
                                comissao.id,
                                "valorRepeticao",
                                formatMoneyInput(event.target.value)
                              )
                            }
                            className="w-full px-3 text-xs outline-none"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[11px] text-slate-600">Padrão</label>
                        <select
                          value={comissao.padrao}
                          onChange={(event) =>
                            atualizarComissao("comissoesTerceirizados", comissao.id, "padrao", event.target.value)
                          }
                          className="h-9 w-full rounded border border-slate-300 bg-white px-2 text-xs outline-none focus:border-primary-500"
                        >
                          <option>Nao</option>
                          <option>Sim</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => removerComissao("comissoesTerceirizados", comissao.id)}
                        className="mb-1 flex h-8 w-8 items-center justify-center rounded border border-red-200 text-red-500 hover:bg-red-50"
                        aria-label="Remover comissão terceirizado"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => adicionarComissao("comissoesTerceirizados")}
                  className="mt-3 rounded bg-emerald-500 px-4 py-2 text-[11px] font-semibold text-white hover:bg-emerald-600"
                >
                  + Comissão Prestador de Serviço
                </button>
              </div>

              <div className="border-t border-slate-100 pt-5">
                <p className="mb-4 flex items-center gap-2 text-sm text-slate-600">☰ Etapas</p>
                {etapasCadastro.length > 0 && (
                  <p className="mb-3 text-[10px] text-slate-500">
                    Opções sincronizadas com{" "}
                    <Link href="/app/cadastros/etapas" className="text-primary-700 underline">
                      Cadastros → Etapas
                    </Link>
                    .
                  </p>
                )}
                <div className="space-y-3">
                  {formServico.etapas.map((etapa, index) => (
                    <div key={etapa.id} className="relative grid gap-3 rounded border border-blue-300 p-3 md:grid-cols-[1.2fr_0.8fr]">
                      <button
                        type="button"
                        onClick={() => removerEtapa(etapa.id)}
                        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded border border-red-200 text-red-500 hover:bg-red-50"
                        aria-label="Remover etapa"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <div className="space-y-1">
                        <label className="block text-[11px] text-slate-600">
                          {index === 0 ? "Entrada" : "Etapa"}
                        </label>
                        <select
                          value={etapa.nome}
                          onChange={(event) => atualizarEtapa(etapa.id, "nome", event.target.value)}
                          className="h-9 w-full rounded border border-slate-300 bg-white px-3 text-xs outline-none focus:border-primary-500"
                        >
                          <option value="">
                            {index === 0 ? "Selecione a etapa de entrada" : "Selecione uma etapa"}
                          </option>
                          {(etapasCadastro.length > 0 ? etapasCadastro : formServico.opcoesEtapas).map(
                            (opcao) => (
                              <option key={opcao} value={opcao}>
                                {opcao}
                              </option>
                            )
                          )}
                          {etapa.nome &&
                            !(etapasCadastro.length > 0 ? etapasCadastro : formServico.opcoesEtapas).includes(
                              etapa.nome
                            ) && <option value={etapa.nome}>{etapa.nome}</option>}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[11px] text-slate-600">Valor da Etapa</label>
                        <div className="flex h-9 overflow-hidden rounded border border-slate-300 bg-white">
                          <span className="flex w-9 items-center justify-center border-r border-slate-200 text-xs text-slate-500">$</span>
                          <input
                            value={etapa.valorHora}
                            onChange={(event) =>
                              atualizarEtapa(etapa.id, "valorHora", formatMoneyInput(event.target.value))
                            }
                            className="w-full px-3 text-xs outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={abrirModalCadastroEtapasServico}
                    className="rounded bg-emerald-100 px-4 py-2 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-200"
                  >
                    + adicionar etapas
                  </button>
                  <button
                    type="button"
                    onClick={adicionarEtapa}
                    className="rounded bg-emerald-500 px-4 py-2 text-[11px] font-semibold text-white hover:bg-emerald-600"
                  >
                    + Etapa
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={cadastrarServico}
                  className="rounded bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  {servicoEditando ? "Salvar Serviço" : "Cadastrar Serviço"}
                </button>
                <button
                  type="button"
                  onClick={() => setCategoriaServico(null)}
                  className="rounded border border-slate-300 bg-white px-4 py-2 text-xs text-slate-600 hover:bg-slate-50"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalCadastroEtapasServico && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-700">Cadastrar etapas do serviço</h2>
              <button
                type="button"
                onClick={() => setModalCadastroEtapasServico(false)}
                className="text-xl text-slate-400 hover:text-slate-700"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            <div className="space-y-4 p-5 text-xs">
              <p className="text-slate-500">
                Para opções oficiais, use{" "}
                <Link href="/app/cadastros/etapas" className="text-primary-700 underline">
                  Cadastros → Etapas
                </Link>
                . Aqui você pode incluir etapas extras só deste serviço.
              </p>
              <div className="flex gap-2">
                <input
                  value={nomeNovaEtapaOpcao}
                  onChange={(event) => setNomeNovaEtapaOpcao(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      adicionarOpcaoEtapaServico();
                    }
                  }}
                  placeholder="Nome da etapa"
                  className="h-9 flex-1 rounded border border-slate-300 px-3 outline-none focus:border-primary-500"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={adicionarOpcaoEtapaServico}
                  className="rounded bg-emerald-500 px-4 py-2 font-semibold text-white hover:bg-emerald-600"
                >
                  Adicionar
                </button>
              </div>
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded border border-slate-200">
                {formServico.opcoesEtapas.map((opcao) => {
                  const padrao = ETAPAS_OPCOES_PADRAO.includes(opcao);
                  return (
                    <li
                      key={opcao}
                      className="flex items-center justify-between gap-2 border-b border-slate-50 px-3 py-2 last:border-0"
                    >
                      <span className="text-slate-700">
                        {opcao}
                        {padrao && <span className="ml-1 text-[10px] text-slate-400">(padrão)</span>}
                      </span>
                      {!padrao && (
                        <button
                          type="button"
                          onClick={() => removerOpcaoEtapaServico(opcao)}
                          className="text-red-400 hover:text-red-600"
                          aria-label={`Remover ${opcao}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setModalCadastroEtapasServico(false)}
                  className="rounded bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
                >
                  Concluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalEditarTabela && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-700">Editar Tabela</h2>
              <button type="button" onClick={() => setModalEditarTabela(false)} className="text-slate-400 hover:text-slate-700">
                ×
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-600">Nome da Tabela</label>
                <input
                  value={nomeTabelaEditando}
                  onChange={(event) => setNomeTabelaEditando(event.target.value)}
                  className="h-9 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-primary-500"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalEditarTabela(false)}
                  className="rounded border border-slate-300 px-4 py-2 text-xs text-slate-600 hover:bg-slate-50"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={salvarTabelaEditada}
                  className="rounded bg-primary-600 px-4 py-2 text-xs font-semibold text-white hover:bg-primary-700"
                >
                  Salvar Tabela
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalProdutosCategoriaId && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/45 p-4 pt-10">
          <div className="relative w-full max-w-4xl rounded bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-700">Adicionar Produtos — Tabela de Preços</h2>
              <button
                type="button"
                onClick={fecharModalProdutos}
                className="flex h-7 w-7 items-center justify-center rounded text-xl text-slate-500 hover:bg-slate-100"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            <div className="space-y-4 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex min-w-[240px] flex-1">
                  <input
                    value={buscaProdutoEstoque}
                    onChange={(event) => setBuscaProdutoEstoque(event.target.value)}
                    placeholder="Nome do Produto"
                    className="h-9 flex-1 rounded-l border border-slate-300 px-3 text-xs outline-none focus:border-primary-500"
                  />
                  <button
                    type="button"
                    onClick={() => setBuscaProdutoEstoque("")}
                    className="h-9 rounded-r bg-slate-500 px-4 text-[11px] font-semibold text-white hover:bg-slate-600"
                  >
                    Limpar
                  </button>
                </div>
                <Link
                  href="/app/produtos"
                  className="rounded bg-blue-600 px-3 py-2 text-[11px] font-semibold text-white hover:bg-blue-700"
                >
                  Cadastrar Produto Estoque
                </Link>
              </div>

              <div className="max-h-[50vh] overflow-auto rounded border border-slate-200">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-[#f4f3fb] text-slate-500">
                    <tr>
                      <th className="w-10 px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={
                            produtosFiltradosModal.length > 0 &&
                            produtosFiltradosModal.every((p) => produtosSelecionados.has(p.id))
                          }
                          onChange={(event) => {
                            if (event.target.checked) {
                              setProdutosSelecionados(new Set(produtosFiltradosModal.map((p) => p.id)));
                            } else {
                              setProdutosSelecionados(new Set());
                            }
                          }}
                          className="h-3.5 w-3.5 accent-primary-600"
                          title="Selecionar todos"
                        />
                      </th>
                      <th className="px-3 py-2 text-left font-semibold uppercase">Nome</th>
                      <th className="w-32 px-3 py-2 text-left font-semibold uppercase">Marca</th>
                      <th className="w-28 px-3 py-2 text-right font-semibold uppercase">Valor de custo</th>
                      <th className="w-28 px-3 py-2 text-right font-semibold uppercase">Valor de venda</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {carregandoProdutosEstoque && (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                          Carregando produtos do estoque...
                        </td>
                      </tr>
                    )}
                    {!carregandoProdutosEstoque &&
                      produtosFiltradosModal.map((produto) => (
                        <tr key={produto.id} className="hover:bg-slate-50">
                          <td className="px-2 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={produtosSelecionados.has(produto.id)}
                              onChange={(event) => {
                                setProdutosSelecionados((atual) => {
                                  const proximo = new Set(atual);
                                  if (event.target.checked) proximo.add(produto.id);
                                  else proximo.delete(produto.id);
                                  return proximo;
                                });
                              }}
                              className="h-3.5 w-3.5 accent-primary-600"
                            />
                          </td>
                          <td className="px-3 py-2 text-slate-700">{produto.nome}</td>
                          <td className="px-3 py-2 text-slate-500">{produto.marca || ""}</td>
                          <td className="px-3 py-2 text-right text-slate-700">
                            {money(Number(produto.valorCusto) || 0)}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-700">{money(Number(produto.valor) || 0)}</td>
                        </tr>
                      ))}
                    {!carregandoProdutosEstoque && produtosFiltradosModal.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                          Nenhum produto encontrado no estoque.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={adicionarProdutosNaTabela}
                  disabled={produtosSelecionados.size === 0}
                  className="flex-1 rounded bg-emerald-500 py-2.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Adicionar Produtos na Tabela
                </button>
                <button
                  type="button"
                  onClick={fecharModalProdutos}
                  className="rounded border border-slate-300 bg-white px-6 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:w-32"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmacaoExclusaoModal
        open={!!categoriaParaRemover}
        titulo="Excluir categoria"
        mensagem="Deseja realmente remover esta categoria e todos os itens?"
        aviso="Atenção!! Esta ação não pode ser desfeita."
        detalhe={categoriaParaRemover?.nome}
        onClose={() => setCategoriaParaRemover(null)}
        onConfirm={confirmarRemoverCategoria}
      />

      {modalTransporte && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded bg-white shadow-2xl">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-700">
                {modalTransporte.itemId ? "Editar Transporte" : "Cadastrar Transportes"}
              </h2>
            </div>
            <div className="space-y-4 p-5 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-slate-600">
                  Nome<span className="text-red-500">*</span>
                </label>
                <input
                  value={formTransporte.nome}
                  onChange={(event) => setFormTransporte((c) => ({ ...c, nome: event.target.value }))}
                  className="h-9 w-full rounded border border-slate-300 px-3 outline-none focus:border-primary-500"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <label className="font-medium text-slate-600">Valor</label>
                <div className="flex h-9 overflow-hidden rounded border border-slate-300">
                  <span className="flex w-9 items-center justify-center border-r border-slate-200 text-slate-500">$</span>
                  <input
                    value={formTransporte.valor}
                    onChange={(event) =>
                      setFormTransporte((c) => ({ ...c, valor: formatMoneyInput(event.target.value) }))
                    }
                    className="w-full px-3 outline-none"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-slate-600">
                <input
                  type="checkbox"
                  checked={formTransporte.oculto}
                  onChange={(event) => setFormTransporte((c) => ({ ...c, oculto: event.target.checked }))}
                  className="h-3.5 w-3.5 accent-primary-600"
                />
                Ocultar ao Imprimir/Exportar
              </label>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={gravarTransporte}
                  className="flex-1 rounded bg-blue-600 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Gravar Alterações
                </button>
                <button
                  type="button"
                  onClick={fecharModalTransporte}
                  className="rounded border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
