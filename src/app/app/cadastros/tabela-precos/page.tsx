"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  Box,
  CheckSquare,
  ChevronDown,
  ChevronsDownUp,
  Copy,
  Edit3,
  Eye,
  Gem,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { ConfirmacaoExclusaoModal } from "@/components/ConfirmacaoExclusaoModal";
import { PainelCarregando } from "@/components/ListaCarregando";
import { BarraAcoesTabelaPrecos } from "@/components/tabela-precos/BarraAcoesTabelaPrecos";
import {
  AlcaArrastarCategoria,
  CategoriaPrecoArrastavel,
  ListaCategoriasPrecoDnd,
} from "@/components/tabela-precos/CategoriaPrecoArrastavel";
import {
  ModalEditarValoresTabelaPrecos,
  type CategoriaEdicaoValores,
} from "@/components/tabela-precos/ModalEditarValoresTabelaPrecos";
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
import {
  higienizarItensCustoCadastro,
  ITENS_CUSTO_CADASTRO_EVENT,
  removerItemCustoCadastro,
  salvarItemCustoCadastro,
} from "@/lib/itens-custo-cadastro";
import { readStorage, writeStorage } from "@/lib/persisted-storage";
import { cn } from "@/lib/utils";

type TipoItemPreco = "servico" | "produto" | "transporte";

type ServicoPreco = {
  id: string;
  nome: string;
  valor: number;
  etapa: string;
  tipo: TipoItemPreco;
  destaque: boolean;
  oculto: boolean;
  excluido?: boolean;
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
  qtd?: string;
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
    excluido: servico.excluido ?? false,
    opcoesEtapas: opcoesEtapasDoServico(servico),
  };
}

function servicoEstaExcluido(servico: ServicoPreco) {
  return servico.excluido ?? false;
}

function filtrarServicosPorModoLixeira(servicos: ServicoPreco[], mostrarExcluidos: boolean) {
  return servicos.filter((servico) =>
    mostrarExcluidos ? servicoEstaExcluido(servico) : !servicoEstaExcluido(servico)
  );
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

import { abrirPdfGerando } from "@/lib/pdf-viewer";
import { carregarConfigImpressaoTabelaPrecos } from "@/lib/tabela-precos-impressao-config";
import {
  baixarPdfTabelaPrecos,
  exportarTabelaPrecosExcel,
  gerarPdfTabelaPrecos,
  textoEmailTabelaPrecos,
  type CategoriaTabelaPrecoExport,
} from "@/lib/tabela-precos-lista-export";
import {
  notificarTabelasPrecoAtualizadas,
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
    qtd: "1",
    valorHora: "0,00",
  };
}

export default function TabelaPrecosPage() {
  const router = useRouter();
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
  const [modalCustos, setModalCustos] = useState<{
    categoriaId: string;
    itemId: string;
    tipo: TipoItemPreco;
  } | null>(null);
  const [formCustoItem, setFormCustoItem] = useState({ custo: "0,00" });
  const [formCustoEtapa, setFormCustoEtapa] = useState({
    nome: "",
    qtd: "1",
    custo: "0,00",
  });
  const [modalNovoItemCusto, setModalNovoItemCusto] = useState(false);
  const [nomeNovoItemCusto, setNomeNovoItemCusto] = useState("");
  const [itensCustoCadastro, setItensCustoCadastro] = useState<string[]>([]);
  const [selectItemCustoAberto, setSelectItemCustoAberto] = useState(false);
  const [formTransporte, setFormTransporte] = useState({
    nome: "",
    valor: "0,00",
    oculto: false,
  });
  const [categoriaParaRemover, setCategoriaParaRemover] = useState<{
    id: string;
    nome: string;
  } | null>(null);
  const [tabelaParaExcluir, setTabelaParaExcluir] = useState<string | null>(null);
  const [processandoAcoes, setProcessandoAcoes] = useState(false);
  const [modoArrastarCategorias, setModoArrastarCategorias] = useState(false);
  const [mostrarServicosExcluidos, setMostrarServicosExcluidos] = useState(false);
  const [modalEditarValores, setModalEditarValores] = useState(false);
  const [modalEtapasServico, setModalEtapasServico] = useState<{
    categoriaId: string;
    servicoId: string;
    nomeServico: string;
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
    notificarTabelasPrecoAtualizadas();
    void sincronizarTabelaPrecosServidor(payload);
  }, [tabela, tabelas, categoriasPorTabela, persistenciaPronta]);

  useEffect(() => {
    if (!paginaPronta || typeof window === "undefined") return;
    function recarregarEtapas() {
      setEtapasCadastro(nomesEtapasCadastro());
    }
    function recarregarItensCusto() {
      setItensCustoCadastro(higienizarItensCustoCadastro());
    }
    recarregarEtapas();
    recarregarItensCusto();
    window.addEventListener("focus", recarregarEtapas);
    window.addEventListener("storage", recarregarEtapas);
    window.addEventListener(ITENS_CUSTO_CADASTRO_EVENT, recarregarItensCusto);
    window.addEventListener("focus", recarregarItensCusto);
    window.addEventListener("storage", recarregarItensCusto);
    return () => {
      window.removeEventListener("focus", recarregarEtapas);
      window.removeEventListener("storage", recarregarEtapas);
      window.removeEventListener(ITENS_CUSTO_CADASTRO_EVENT, recarregarItensCusto);
      window.removeEventListener("focus", recarregarItensCusto);
      window.removeEventListener("storage", recarregarItensCusto);
    };
  }, [paginaPronta]);

  function atualizarCategorias(updater: (atuais: CategoriaPreco[]) => CategoriaPreco[]) {
    setCategoriasPorTabela((atuais) => ({
      ...atuais,
      [tabela]: updater(atuais[tabela] || []),
    }));
  }

  const totalServicos = useMemo(
    () =>
      categorias.reduce(
        (sum, categoria) =>
          sum + categoria.servicos.filter((servico) => !servicoEstaExcluido(servico)).length,
        0
      ),
    [categorias]
  );

  const totalServicosExcluidos = useMemo(
    () =>
      categorias.reduce(
        (sum, categoria) =>
          sum + categoria.servicos.filter((servico) => servicoEstaExcluido(servico)).length,
        0
      ),
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

  function abrirConfigImpressao() {
    const params = new URLSearchParams({ tabela });
    router.push(`/app/cadastros/tabela-precos/impressao?${params.toString()}`);
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

  function adicionarEtapaNaTabelaPrecos(nome: string) {
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) return;
    setFormServico((current) => {
      const jaExiste = current.etapas.some(
        (etapa) => etapa.nome.trim().toLowerCase() === nomeLimpo.toLowerCase()
      );
      if (jaExiste) return current;
      return {
        ...current,
        etapas: [...current.etapas, { ...novaEtapaServico(), nome: nomeLimpo }],
      };
    });
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

  function abrirModalEtapas(categoria: CategoriaPreco, servico: ServicoPreco) {
    setFormServico((atual) => ({
      ...atual,
      etapas: servico.etapas || [],
      opcoesEtapas: opcoesEtapasDoServico(servico),
    }));
    setModalEtapasServico({
      categoriaId: categoria.id,
      servicoId: servico.id,
      nomeServico: servico.nome,
    });
  }

  function fecharModalEtapas() {
    setModalEtapasServico(null);
  }

  function salvarEtapasServicoModal() {
    if (!modalEtapasServico) return;
    const { categoriaId, servicoId } = modalEtapasServico;
    atualizarCategorias((atuais) =>
      atuais.map((categoria) =>
        categoria.id === categoriaId
          ? {
              ...categoria,
              servicos: categoria.servicos.map((servico) =>
                servico.id === servicoId
                  ? {
                      ...servico,
                      etapas: formServico.etapas,
                      opcoesEtapas: formServico.opcoesEtapas,
                      etapa: "Editar Etapas",
                    }
                  : servico
              ),
            }
          : categoria
      )
    );
    setModalEtapasServico(null);
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

  function totalCustosServico(servico: ServicoPreco) {
    const etapas = servico.etapas || [];
    return etapas.reduce((s, e) => {
      const raw = String(e.qtd ?? "1");
      const match = raw.match(/(\d+(?:[.,]\d+)?)/);
      const qtd = match ? Number(match[1].replace(",", ".")) : 1;
      const custo = parseMoney(e.valorHora || "0,00");
      return s + qtd * custo;
    }, 0);
  }

  function abrirModalCustos(categoriaId: string, item: ServicoPreco) {
    setModalCustos({ categoriaId, itemId: item.id, tipo: item.tipo });
    if (item.tipo === "servico") {
      setItensCustoCadastro(higienizarItensCustoCadastro());
      setFormCustoEtapa({ nome: "", qtd: "", custo: "0,00" });
      setModalNovoItemCusto(false);
      setNomeNovoItemCusto("");
      setSelectItemCustoAberto(false);
      return;
    }
    setFormCustoItem({ custo: money(item.valorCusto || 0) });
  }

  function fecharModalCustos() {
    setModalCustos(null);
    setFormCustoItem({ custo: "0,00" });
    setFormCustoEtapa({ nome: "", qtd: "", custo: "0,00" });
    setModalNovoItemCusto(false);
    setNomeNovoItemCusto("");
    setSelectItemCustoAberto(false);
  }

  function servicoNoModalCustos(): { categoria: CategoriaPreco; servico: ServicoPreco } | null {
    if (!modalCustos) return null;
    const categoria = categorias.find((c) => c.id === modalCustos.categoriaId);
    const servico = categoria?.servicos.find((s) => s.id === modalCustos.itemId);
    if (!categoria || !servico) return null;
    return { categoria, servico: normalizarServico(servico) };
  }

  function adicionarCustoEtapa() {
    const current = servicoNoModalCustos();
    if (!current) return;
    const nome = formCustoEtapa.nome.trim();
    if (!nome) return;
    const qtdTexto = formCustoEtapa.qtd.trim() || "1";
    const match = qtdTexto.match(/(\d+(?:[.,]\d+)?)/);
    const qtdNum = match ? Number(match[1].replace(",", ".")) : 1;
    if (qtdNum <= 0) return;
    const custo = formatMoneyInput(formCustoEtapa.custo);
    const proximoItens = salvarItemCustoCadastro(nome);
    setItensCustoCadastro(proximoItens);
    atualizarCategorias((atuais) =>
      atuais.map((categoria) => {
        if (categoria.id !== modalCustos?.categoriaId) return categoria;
        return {
          ...categoria,
          servicos: categoria.servicos.map((s) => {
            if (s.id !== modalCustos?.itemId) return s;
            const etapas = (s.etapas || []).map((e) => ({ ...e, qtd: e.qtd ?? "1" }));
            return {
              ...s,
              etapas: [
                ...etapas,
                {
                  id: `${Date.now()}-${Math.random()}`,
                  nome,
                  qtd: qtdTexto,
                  valorHora: custo,
                },
              ],
            };
          }),
        };
      })
    );
    setFormCustoEtapa({ nome: "", qtd: "", custo: "0,00" });
  }

  function adicionarOpcaoCustoServico(nome: string) {
    const valor = nome.trim();
    if (!valor || !modalCustos) return;
    atualizarCategorias((atuais) =>
      atuais.map((categoria) => {
        if (categoria.id !== modalCustos.categoriaId) return categoria;
        return {
          ...categoria,
          servicos: categoria.servicos.map((s) => {
            if (s.id !== modalCustos.itemId) return s;
            const atuaisOpcoes = s.opcoesEtapas || [];
            if (atuaisOpcoes.some((o) => o.toLowerCase() === valor.toLowerCase())) return s;
            return { ...s, opcoesEtapas: [...atuaisOpcoes, valor] };
          }),
        };
      })
    );
  }

  function cadastrarNovoItemCusto() {
    const nome = nomeNovoItemCusto.trim();
    if (!nome) return;
    const proximo = salvarItemCustoCadastro(nome);
    setItensCustoCadastro(proximo);
    adicionarOpcaoCustoServico(nome);
    setFormCustoEtapa((s) => ({ ...s, nome }));
    setNomeNovoItemCusto("");
    setModalNovoItemCusto(false);
    setSelectItemCustoAberto(false);
  }

  function excluirItemCustoCadastro(nome: string) {
    const proximo = removerItemCustoCadastro(nome);
    setItensCustoCadastro(proximo);
    if (formCustoEtapa.nome === nome) {
      setFormCustoEtapa((s) => ({ ...s, nome: "" }));
    }
    atualizarCategorias((atuais) =>
      atuais.map((categoria) => {
        if (categoria.id !== modalCustos?.categoriaId) return categoria;
        return {
          ...categoria,
          servicos: categoria.servicos.map((s) => {
            if (s.id !== modalCustos?.itemId) return s;
            const opcoes = (s.opcoesEtapas || []).filter((o) => o !== nome);
            return { ...s, opcoesEtapas: opcoes };
          }),
        };
      })
    );
  }

  function removerCustoEtapa(id: string) {
    atualizarCategorias((atuais) =>
      atuais.map((categoria) => {
        if (categoria.id !== modalCustos?.categoriaId) return categoria;
        return {
          ...categoria,
          servicos: categoria.servicos.map((s) => {
            if (s.id !== modalCustos?.itemId) return s;
            return { ...s, etapas: (s.etapas || []).filter((e) => e.id !== id) };
          }),
        };
      })
    );
  }

  function salvarCustoItem() {
    if (!modalCustos) return;
    const custo = parseMoney(formCustoItem.custo);
    atualizarCategorias((atuais) =>
      atuais.map((categoria) => {
        if (categoria.id !== modalCustos.categoriaId) return categoria;
        return {
          ...categoria,
          servicos: categoria.servicos.map((s) =>
            s.id === modalCustos.itemId ? { ...s, valorCusto: custo } : s
          ),
        };
      })
    );
    fecharModalCustos();
  }

  function salvarCustosServico() {
    // Custos do serviço são persistidos ao adicionar/remover etapas.
    fecharModalCustos();
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
          ? {
              ...categoria,
              servicos: categoria.servicos.map((servico) =>
                servico.id === servicoId ? { ...servico, excluido: true } : servico
              ),
            }
          : categoria
      )
    );
  }

  function restaurarServico(categoriaId: string, servicoId: string) {
    atualizarCategorias((atuais) =>
      atuais.map((categoria) =>
        categoria.id === categoriaId
          ? {
              ...categoria,
              servicos: categoria.servicos.map((servico) =>
                servico.id === servicoId ? { ...servico, excluido: false } : servico
              ),
            }
          : categoria
      )
    );
  }

  function alternarModoServicosExcluidos() {
    setMostrarServicosExcluidos((ativo) => {
      if (!ativo) {
        if (totalServicosExcluidos === 0) {
          alert("Não há serviços excluídos nesta tabela.");
          return false;
        }
        setModoArrastarCategorias(false);
        setCategoriaEdicaoRapida(null);
        setServicosEdicaoRapida([]);
      }
      return !ativo;
    });
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
      categoria.servicos.filter((servico) => !servicoEstaExcluido(servico)).map((servico) => ({
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

  function categoriasParaExportacao(): CategoriaTabelaPrecoExport[] {
    return categorias.map((categoria) => ({
      nome: categoria.nome,
      servicos: categoria.servicos
        .filter((servico) => !servicoEstaExcluido(servico))
        .map((servico) => ({
        nome: servico.nome,
        valor: servico.valor,
        tipo: servico.tipo,
        prazo: servico.prazo,
        prazoDentista: servico.prazoDentista,
        descontoRepeticao: servico.descontoRepeticao,
        oculto: servico.oculto,
      })),
    }));
  }

  function enviarTabelaPorEmail() {
    if (!totalServicos) {
      alert("Não há itens na tabela para enviar.");
      return;
    }
    const assunto = encodeURIComponent(`Tabela de Preços — ${tabela}`);
    const corpo = encodeURIComponent(textoEmailTabelaPrecos(tabela, categoriasParaExportacao()));
    window.location.href = `mailto:?subject=${assunto}&body=${corpo}`;
  }

  async function exportarTabelaExcel() {
    if (!totalServicos) {
      alert("Não há itens na tabela para exportar.");
      return;
    }
    setProcessandoAcoes(true);
    try {
      await exportarTabelaPrecosExcel(tabela, categoriasParaExportacao());
    } catch {
      alert("Não foi possível exportar a planilha.");
    } finally {
      setProcessandoAcoes(false);
    }
  }

  async function baixarTabelaPdf() {
    if (!totalServicos) {
      alert("Não há itens na tabela para exportar.");
      return;
    }
    setProcessandoAcoes(true);
    try {
      const config = await carregarConfigImpressaoTabelaPrecos(tabela);
      const blob = await gerarPdfTabelaPrecos(
        tabela,
        categoriasParaExportacao(),
        config
      );
      const data = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
      baixarPdfTabelaPrecos(blob, `tabela-precos-${data}.pdf`);
    } catch {
      alert("Não foi possível gerar o PDF.");
    } finally {
      setProcessandoAcoes(false);
    }
  }

  async function imprimirTabela() {
    if (!totalServicos) {
      alert("Não há itens na tabela para imprimir.");
      return;
    }
    setProcessandoAcoes(true);
    try {
      const config = await carregarConfigImpressaoTabelaPrecos(tabela);
      await abrirPdfGerando(
        () => gerarPdfTabelaPrecos(tabela, categoriasParaExportacao(), config),
        "tabela-precos.pdf",
        `Tabela de Preços — ${tabela}`
      );
    } catch {
      alert("Não foi possível gerar a impressão.");
    } finally {
      setProcessandoAcoes(false);
    }
  }

  function alternarExpandirCategorias() {
    if (categorias.length === 0) return;
    if (categoriasRecolhidas.size > 0) {
      setCategoriasRecolhidas(new Set());
      return;
    }
    setCategoriasRecolhidas(new Set(categorias.map((categoria) => categoria.id)));
  }

  function reordenarCategoriasPorIds(idsOrdenados: string[]) {
    atualizarCategorias((atuais) => {
      const mapa = new Map(atuais.map((categoria) => [categoria.id, categoria]));
      return idsOrdenados
        .map((id) => mapa.get(id))
        .filter((categoria): categoria is CategoriaPreco => Boolean(categoria));
    });
  }

  function abrirModalEditarValores() {
    if (!totalServicos) {
      alert("Não há itens na tabela para reajustar.");
      return;
    }
    setModalEditarValores(true);
  }

  function gravarValoresModal(categoriasAtualizadas: CategoriaEdicaoValores[]) {
    const valoresPorServico = new Map<string, number>();
    for (const categoria of categoriasAtualizadas) {
      for (const servico of categoria.servicos) {
        valoresPorServico.set(servico.id, servico.valor);
      }
    }
    atualizarCategorias((atuais) =>
      atuais.map((categoria) => ({
        ...categoria,
        servicos: categoria.servicos.map((servico) =>
          valoresPorServico.has(servico.id)
            ? { ...servico, valor: valoresPorServico.get(servico.id)! }
            : servico
        ),
      }))
    );
    setModalEditarValores(false);
  }

  function solicitarExcluirTabela() {
    if (tabelas.length <= 1) {
      alert("Não é possível excluir a única tabela cadastrada.");
      return;
    }
    setTabelaParaExcluir(tabela);
  }

  function confirmarExcluirTabela() {
    if (!tabelaParaExcluir) return;
    const nome = tabelaParaExcluir;
    const restantes = tabelas.filter((item) => item !== nome);
    setTabelas(restantes);
    setCategoriasPorTabela((atuais) => {
      const { [nome]: _removida, ...resto } = atuais;
      return resto;
    });
    if (tabela === nome) {
      setTabela(restantes[0] || "");
    }
    setTabelaParaExcluir(null);
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
                <button
                  type="button"
                  onClick={() => {
                    setDropdownTabelaAberto(false);
                    solicitarExcluirTabela();
                  }}
                  disabled={tabelas.length <= 1}
                  className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Excluir tabela atual
                </button>
              </div>
            )}
          </div>

          <BarraAcoesTabelaPrecos
            onEmail={enviarTabelaPorEmail}
            onExportarExcel={() => void exportarTabelaExcel()}
            onExportarPdf={() => void baixarTabelaPdf()}
            onConfiguracoes={abrirConfigImpressao}
            modoArrastar={modoArrastarCategorias}
            onAlternarModoArrastar={() => {
              setModoArrastarCategorias((ativo) => {
                if (!ativo) setMostrarServicosExcluidos(false);
                return !ativo;
              });
            }}
            onImprimir={() => void imprimirTabela()}
            onPercentual={abrirModalEditarValores}
            modoExcluidos={mostrarServicosExcluidos}
            onAlternarModoExcluidos={alternarModoServicosExcluidos}
            processando={processandoAcoes}
          />
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
          {modoArrastarCategorias && (
            <div className="mb-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-medium text-emerald-800">
              Modo arrastar ativo — use o ícone verde no cabeçalho de cada categoria (REF, REMOVÍVEL…) para mudar a ordem.
            </div>
          )}
          {mostrarServicosExcluidos && (
            <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-medium text-red-800">
              Lixeira ativa — exibindo serviços excluídos em vermelho. Clique na lixeira novamente para voltar à lista normal.
            </div>
          )}
          <ListaCategoriasPrecoDnd
            ids={categorias.map((categoria) => categoria.id)}
            ativo={modoArrastarCategorias}
            onReorder={reordenarCategoriasPorIds}
          >
            {categorias
              .filter(
                (categoria) =>
                  !mostrarServicosExcluidos ||
                  filtrarServicosPorModoLixeira(categoria.servicos, true).length > 0
              )
              .map((categoria) => {
              const editandoRapido = categoriaEdicaoRapida === categoria.id;
              const servicosRapidos = editandoRapido ? servicosEdicaoRapida : [];
              const servicosVisiveis = filtrarServicosPorModoLixeira(
                categoria.servicos,
                mostrarServicosExcluidos
              );
              const recolhida = categoriasRecolhidas.has(categoria.id);
              const tipoCategoria = tipoDominanteCategoria(categoria);
              const botoesAdicao = botoesAdicaoVisiveis(tipoCategoria);

              return (
              <CategoriaPrecoArrastavel
                key={categoria.id}
                id={categoria.id}
                ativo={modoArrastarCategorias}
              >
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex items-center gap-2">
                <AlcaArrastarCategoria />
                <h2 className="text-xs font-bold uppercase text-slate-600">{categoria.nome}</h2>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                {!modoArrastarCategorias && (
                <button type="button" title="Selecionar" className="hover:text-primary-700">
                  <CheckSquare className="h-3.5 w-3.5" />
                </button>
                )}
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
                            if (original) abrirModalEtapas(categoria, original);
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
                    <th className="w-28 px-3 py-2 text-center font-semibold uppercase">
                      Custos
                    </th>
                    <th className="w-28 px-3 py-2 text-center font-semibold uppercase">Ocultar</th>
                    <th className="w-24 px-3 py-2 text-center font-semibold">OPÇÕES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {servicosVisiveis.map((servico) => {
                    const item = normalizarServico(servico);
                    const excluido = servicoEstaExcluido(item);
                    return (
                    <tr key={servico.id} className="hover:bg-slate-50">
                      <td className={cn("px-3 py-1.5", excluido ? "text-red-600" : "text-slate-600")}>
                        {item.nome}
                      </td>
                      <td className={cn("px-3 py-1.5 text-right", excluido ? "text-red-600" : "text-slate-700")}>
                        {money(item.valor)}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        {item.tipo === "servico" ? (
                        <button
                          type="button"
                          onClick={() => abrirModalEtapas(categoria, item)}
                          className="text-primary-700 hover:underline"
                          disabled={excluido}
                        >
                          {item.etapa}
                        </button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        {excluido ? (
                          <span className="inline-flex rounded-sm p-1.5 text-red-500" title="Indisponível para serviço excluído">
                            <Ban className="h-3.5 w-3.5" strokeWidth={1.75} />
                          </span>
                        ) : (
                        <button
                          type="button"
                          onClick={() => abrirModalCustos(categoria.id, item)}
                          className="inline-flex rounded-sm p-1.5 text-red-500 hover:bg-red-50 hover:text-red-600"
                          title={item.tipo === "servico" ? "Gerenciar custos por etapa" : "Editar custo do item"}
                        >
                          <Gem className="h-3.5 w-3.5" strokeWidth={1.75} />
                        </button>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={servico.oculto}
                          onChange={() => toggleOculto(categoria.id, servico.id)}
                          className="h-3.5 w-3.5 accent-primary-600"
                          disabled={excluido}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        {excluido ? (
                          <div className="flex justify-center">
                            <button
                              type="button"
                              onClick={() => restaurarServico(categoria.id, servico.id)}
                              className="text-[11px] font-semibold text-red-600 hover:underline"
                            >
                              Restaurar
                            </button>
                          </div>
                        ) : (
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
                        )}
                      </td>
                    </tr>
                    );
                  })}
                  {servicosVisiveis.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                        {mostrarServicosExcluidos
                          ? "Nenhum serviço excluído nesta categoria."
                          : "Nenhum serviço cadastrado nesta categoria."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            ))}

            {modalCustos && (() => {
              const data = servicoNoModalCustos();
              if (!data) return null;
              const item = data.servico;
              const opcoesCustosSelecao = itensCustoCadastro;
              const listaEtapas = (item.etapas || []).map((e) => ({ ...e, qtd: e.qtd ?? "1" }));
              const total = item.tipo === "servico" ? totalCustosServico(item) : (item.valorCusto || 0);

              return (
                <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4">
                  <div className="w-full max-w-3xl rounded-md border border-slate-200 bg-white shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <h2 className="text-sm font-semibold text-slate-700">
                        {item.tipo === "servico" ? "Gerenciar Custos do Serviço" : "Custo do Item"}
                      </h2>
                      <button
                        type="button"
                        onClick={fecharModalCustos}
                        className="text-slate-400 hover:text-slate-700"
                        aria-label="Fechar"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="p-4">
                      {modalNovoItemCusto ? (
                        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4">
                          <div className="w-full max-w-sm rounded-md border border-slate-200 bg-white shadow-xl">
                            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                              <h3 className="text-sm font-semibold text-slate-700">Cadastrar Novo Item</h3>
                              <button
                                type="button"
                                onClick={() => {
                                  setModalNovoItemCusto(false);
                                  setNomeNovoItemCusto("");
                                }}
                                className="text-slate-400 hover:text-slate-700"
                                aria-label="Fechar"
                              >
                                <X className="h-5 w-5" />
                              </button>
                            </div>
                            <div className="space-y-3 p-4">
                              <div className="space-y-1">
                                <label className="block text-[11px] text-slate-600">Nome do custo</label>
                                <input
                                  value={nomeNovoItemCusto}
                                  onChange={(e) => setNomeNovoItemCusto(e.target.value)}
                                  className="h-9 w-full rounded-sm border border-slate-200 bg-white px-2 text-[12px] text-slate-700 outline-none focus:border-blue-400"
                                  autoFocus
                                />
                              </div>
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setModalNovoItemCusto(false);
                                    setNomeNovoItemCusto("");
                                  }}
                                  className="h-9 rounded-sm border border-slate-200 bg-white px-4 text-[12px] font-semibold text-slate-600 hover:bg-slate-50"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={cadastrarNovoItemCusto}
                                  className="h-9 rounded-sm bg-blue-600 px-4 text-[12px] font-semibold text-white hover:bg-blue-700"
                                >
                                  Cadastrar
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                      {item.tipo === "servico" ? (
                        <>
                          <div className="grid grid-cols-12 items-end gap-3">
                            <div className="col-span-6">
                              <label className="mb-1 block text-[11px] text-slate-600">
                                Item ou Serviço
                              </label>
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => setSelectItemCustoAberto((aberto) => !aberto)}
                                  className={cn(
                                    "flex h-9 w-full items-center justify-between rounded-sm border border-slate-200 bg-white px-2 text-left text-[12px] outline-none focus:border-blue-400",
                                    formCustoEtapa.nome ? "text-slate-700" : "text-slate-400"
                                  )}
                                >
                                  <span className="truncate">
                                    {formCustoEtapa.nome || "Selecione o item"}
                                  </span>
                                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                                </button>
                                {selectItemCustoAberto && (
                                  <>
                                    <button
                                      type="button"
                                      className="fixed inset-0 z-[100]"
                                      aria-label="Fechar lista"
                                      onClick={() => setSelectItemCustoAberto(false)}
                                    />
                                    <ul className="absolute left-0 right-0 top-full z-[101] mt-1 max-h-48 overflow-auto rounded-sm border border-slate-200 bg-white py-1 shadow-lg">
                                      <li>
                                        <button
                                          type="button"
                                          className="w-full px-3 py-2 text-left text-[12px] font-semibold text-emerald-600 hover:bg-slate-50"
                                          onClick={() => {
                                            setSelectItemCustoAberto(false);
                                            setModalNovoItemCusto(true);
                                            setNomeNovoItemCusto("");
                                          }}
                                        >
                                          + Cadastrar Novo Item
                                        </button>
                                      </li>
                                      {opcoesCustosSelecao.map((nome) => (
                                        <li
                                          key={nome}
                                          className={cn(
                                            "flex items-center gap-1 px-2 py-1 hover:bg-slate-50",
                                            formCustoEtapa.nome === nome && "bg-slate-50"
                                          )}
                                        >
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              excluirItemCustoCadastro(nome);
                                            }}
                                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-red-600 hover:bg-red-50"
                                            title={`Excluir ${nome}`}
                                            aria-label={`Excluir ${nome}`}
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            className={cn(
                                              "min-w-0 flex-1 py-1.5 text-left text-[12px] text-slate-700",
                                              formCustoEtapa.nome === nome && "font-medium"
                                            )}
                                            onClick={() => {
                                              setFormCustoEtapa((s) => ({ ...s, nome }));
                                              setSelectItemCustoAberto(false);
                                            }}
                                          >
                                            {nome}
                                          </button>
                                        </li>
                                      ))}
                                    </ul>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="col-span-2">
                              <label className="mb-1 block text-[11px] text-slate-600">Qtd (Unid)</label>
                              <input
                                value={formCustoEtapa.qtd}
                                onChange={(e) => setFormCustoEtapa((s) => ({ ...s, qtd: e.target.value }))}
                                className="h-9 w-full rounded-sm border border-slate-200 bg-white px-2 text-[12px] text-slate-700 outline-none focus:border-blue-400"
                                placeholder="Ex: 20g"
                              />
                            </div>
                            <div className="col-span-4">
                              <label className="mb-1 block text-[11px] text-slate-600">Custo</label>
                              <div className="flex gap-2">
                                <div className="flex h-9 min-w-0 flex-1 overflow-hidden rounded-sm border border-slate-200 bg-white">
                                  <span className="flex w-10 shrink-0 items-center justify-center border-r border-slate-200 text-[12px] text-slate-500">
                                    R$
                                  </span>
                                  <input
                                    value={formCustoEtapa.custo}
                                    onChange={(e) =>
                                      setFormCustoEtapa((s) => ({
                                        ...s,
                                        custo: formatMoneyInput(e.target.value),
                                      }))
                                    }
                                    className="w-full min-w-0 px-2 text-[12px] text-slate-700 outline-none"
                                    placeholder="0,00"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={adicionarCustoEtapa}
                                  disabled={!formCustoEtapa.nome.trim()}
                                  className="h-9 shrink-0 rounded-sm bg-blue-600 px-3 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  + Adicionar
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 min-h-[200px] rounded-md border border-slate-100 bg-white">
                            {listaEtapas.length === 0 ? (
                              <div className="flex h-[200px] flex-col items-center justify-center gap-2 text-slate-300">
                                <Box className="h-10 w-10" />
                                <p className="text-[12px]">Nada adicionado ainda...</p>
                              </div>
                            ) : (
                              <ul className="divide-y divide-slate-100 py-1">
                                {listaEtapas.map((e) => {
                                  const raw = String(e.qtd ?? "1");
                                  const match = raw.match(/(\d+(?:[.,]\d+)?)/);
                                  const qtd = match ? Number(match[1].replace(",", ".")) : 1;
                                  const custo = parseMoney(e.valorHora || "0,00");
                                  const tot = qtd * custo;
                                  return (
                                    <li
                                      key={e.id}
                                      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 hover:bg-slate-50"
                                    >
                                      <div className="flex min-w-[160px] items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => removerCustoEtapa(e.id)}
                                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-red-600 hover:bg-red-50"
                                          title="Remover"
                                          aria-label={`Remover ${e.nome}`}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                        <span className="text-[12px] font-medium text-slate-700">
                                          {e.nome || "—"}
                                        </span>
                                      </div>
                                      <span className="text-[11px] text-slate-500">
                                        Qtd:{" "}
                                        <span className="text-slate-700">{String(e.qtd ?? "1")}</span>
                                      </span>
                                      <span className="text-[11px] text-slate-500">
                                        Custo:{" "}
                                        <span className="text-slate-700">{money(custo)}</span>
                                      </span>
                                      <span className="text-[11px] text-slate-500">
                                        Total:{" "}
                                        <span className="font-semibold text-slate-700">{money(tot)}</span>
                                      </span>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="grid grid-cols-12 gap-3">
                          <div className="col-span-4">
                            <label className="mb-1 block text-[11px] text-slate-600">Custo</label>
                            <input
                              value={formCustoItem.custo}
                              onChange={(e) => setFormCustoItem({ custo: formatMoneyInput(e.target.value) })}
                              className="h-9 w-full rounded-sm border border-slate-200 bg-white px-2 text-[12px] text-slate-700 outline-none focus:border-blue-400"
                              placeholder="0,00"
                            />
                          </div>
                        </div>
                      )}

                      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                        <p className="text-[12px] text-slate-500">
                          Total: <span className="font-semibold text-slate-700">{money(total)}</span>
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={fecharModalCustos}
                            className="h-9 rounded-sm border border-slate-200 bg-white px-4 text-[12px] font-semibold text-slate-600 hover:bg-slate-50"
                          >
                            Fechar
                          </button>
                          <button
                            type="button"
                            onClick={item.tipo === "servico" ? salvarCustosServico : salvarCustoItem}
                            className="h-9 rounded-sm bg-emerald-500 px-4 text-[12px] font-semibold text-white hover:bg-emerald-600"
                          >
                            Salvar Custos
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {!recolhida && !editandoRapido && !mostrarServicosExcluidos && (
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-3 py-2">
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
              <button
                type="button"
                onClick={() => solicitarRemoverCategoria(categoria.id)}
                className="ml-auto text-[10px] font-semibold text-red-500 hover:underline"
              >
                Excluir categoria
              </button>
            </div>
            )}
              </CategoriaPrecoArrastavel>
              );
            })}
          </ListaCategoriasPrecoDnd>

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
          <div className="relative flex max-h-[calc(100vh-5rem)] w-full max-w-6xl flex-col rounded bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
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
            <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-6 py-6 text-xs text-slate-600">
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
                <div className="max-h-[min(320px,42vh)] space-y-3 overflow-y-auto overflow-x-hidden pr-1">
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

      {modalEtapasServico && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4">
          <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col rounded bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-700">
                Etapas — {modalEtapasServico.nomeServico}
              </h2>
              <button
                type="button"
                onClick={fecharModalEtapas}
                className="text-xl text-slate-400 hover:text-slate-700"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5 text-xs text-slate-600">
              {etapasCadastro.length > 0 && (
                <p className="mb-3 text-[10px] text-slate-500">
                  Opções sincronizadas com{" "}
                  <Link href="/app/cadastros/etapas" className="text-primary-700 underline">
                    Cadastros → Etapas
                  </Link>
                  .
                </p>
              )}
              <div className="max-h-[min(360px,50vh)] space-y-3 overflow-y-auto overflow-x-hidden pr-1">
                {formServico.etapas.map((etapa, index) => (
                  <div
                    key={etapa.id}
                    className="relative grid gap-3 rounded border border-blue-300 p-3 md:grid-cols-[1.2fr_0.8fr]"
                  >
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
                        <span className="flex w-9 items-center justify-center border-r border-slate-200 text-xs text-slate-500">
                          $
                        </span>
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
            <div className="flex shrink-0 justify-end gap-3 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={salvarEtapasServicoModal}
                className="rounded bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Salvar Etapas
              </button>
              <button
                type="button"
                onClick={fecharModalEtapas}
                className="rounded border border-slate-300 bg-white px-4 py-2 text-xs text-slate-600 hover:bg-slate-50"
              >
                Fechar
              </button>
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
                  const jaNaTabela = formServico.etapas.some(
                    (etapa) => etapa.nome.trim().toLowerCase() === opcao.trim().toLowerCase()
                  );
                  return (
                    <li
                      key={opcao}
                      className="flex items-center justify-between gap-2 border-b border-slate-50 px-3 py-2 last:border-0"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => adicionarEtapaNaTabelaPrecos(opcao)}
                          disabled={jaNaTabela}
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded border",
                            jaNaTabela
                              ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          )}
                          title={jaNaTabela ? "Etapa já adicionada ao serviço" : "Adicionar etapa ao serviço"}
                          aria-label={jaNaTabela ? `${opcao} já adicionada` : `Adicionar ${opcao}`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <span className="truncate text-slate-700">
                          {opcao}
                          {padrao && <span className="ml-1 text-[10px] text-slate-400">(padrão)</span>}
                        </span>
                      </div>
                      {!padrao && (
                        <button
                          type="button"
                          onClick={() => removerOpcaoEtapaServico(opcao)}
                          className="shrink-0 text-red-400 hover:text-red-600"
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

      <ConfirmacaoExclusaoModal
        open={!!tabelaParaExcluir}
        titulo="Excluir tabela"
        mensagem="Deseja realmente excluir esta tabela de preços?"
        aviso="Atenção!! Esta ação não pode ser desfeita."
        detalhe={tabelaParaExcluir ?? undefined}
        onClose={() => setTabelaParaExcluir(null)}
        onConfirm={confirmarExcluirTabela}
      />

      <ModalEditarValoresTabelaPrecos
        aberto={modalEditarValores}
        categorias={categorias.map((categoria) => ({
          id: categoria.id,
          nome: categoria.nome,
          servicos: categoria.servicos
            .filter((servico) => !servicoEstaExcluido(servico))
            .map((servico) => ({
            id: servico.id,
            nome: servico.nome,
            valor: servico.valor,
          })),
        }))}
        onFechar={() => setModalEditarValores(false)}
        onGravar={gravarValoresModal}
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
