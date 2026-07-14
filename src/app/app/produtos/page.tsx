"use client";

import { Fragment, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Edit3, Eye, List, Plus, Printer, Search, Trash2 } from "lucide-react";
import { ConfirmacaoExclusaoModal } from "@/components/ConfirmacaoExclusaoModal";
import { ModuloCabecalho } from "@/components/ModuloCabecalho";
import { useI18n } from "@/components/i18n-provider";
import { GerenciarEtiquetasCategoriaModal } from "@/components/GerenciarEtiquetasCategoriaModal";
import { ListaCarregando } from "@/components/ListaCarregando";
import { ListagemPorNome } from "@/components/listagem/listagem-por-nome";
import { compararNumero } from "@/lib/listagem-config";
import { HistoricoMovimentosModal, parseDataBrParaComparacao } from "./HistoricoMovimentosModal";
import { Button, Input, Modal, Select } from "@/components/ui";
import {
  excluirMovimentoEstoque,
  getHistoricoMovimentosProduto,
  getProdutosEstoqueExtras,
  limparDadosEstoqueDoProduto,
  notificarProdutosEstoqueAtualizado,
  parseQuantidadeEstoque,
  PRODUTOS_ESTOQUE_EVENT,
  registrarMovimentoEstoque,
  type MovimentoEstoque,
} from "@/lib/estoque";
import { fetchProdutoContexto } from "@/lib/produto-contexto-cliente";
import {
  carregarEtiquetasCategoria,
  etiquetaCategoriaAtiva,
  ETIQUETAS_CATEGORIA_EVENT,
  type EtiquetaCategoria,
} from "@/lib/etiquetas-categoria";
import { usePageReady } from "@/hooks/use-page-ready";
import { readStorage, writeStorage } from "@/lib/persisted-storage";
import { formatCurrency } from "@/lib/utils";
import { ProdutoFotoCampo } from "@/components/estoque/ProdutoFotoCampo";

function EtiquetaCategoriaBadge({
  nome,
  etiquetas,
}: {
  nome?: string | null;
  etiquetas: EtiquetaCategoria[];
}) {
  const termo = (nome || "").trim();
  if (!termo) return null;
  const etiqueta = etiquetas.find((item) => item.nome === termo);
  if (!etiqueta) return null;
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-white"
      style={{ backgroundColor: etiqueta.cor }}
    >
      {termo}
    </span>
  );
}

function IndicadorVariacaoCusto({ delta }: { delta?: number }) {
  const { t } = useI18n();
  if (delta === undefined || delta === 0 || Math.abs(delta) < 0.005) return null;
  const valor = formatCurrency(Math.abs(delta));
  if (delta > 0) {
    return (
      <span
        className="ml-1.5 text-[9px] font-semibold text-red-600"
        title={t("estoque.produtos.aumentoCusto")}
      >
        ↑ {valor}
      </span>
    );
  }
  return (
    <span
      className="ml-1.5 text-[9px] font-semibold text-emerald-600"
      title={t("estoque.produtos.reducaoCusto")}
    >
      ↓ {valor}
    </span>
  );
}

type Produto = {
  id: string;
  nome: string;
  categoria?: string | null;
  valor: number;
  observacoes?: string | null;
  estoque?: number;
  marca?: string;
  etiqueta?: string;
  codigoBarras?: string;
  imagemUrl?: string;
  valorCusto?: number;
  valorCustoDelta?: number;
  estoqueMinimo?: number;
  estoqueMaximo?: number;
  unidadeMedida?: string;
};

const FORNECEDORES_STORAGE_KEY = "labProteseFornecedores";
const PRESTADORES_STORAGE_KEY = "labProtesePrestadores";
const COLABORADORES_STORAGE_KEY = "labProteseColaboradores";
const SETORES_STORAGE_KEY = "labProteseSetores";
const PRODUTOS_EXCLUIDOS_STORAGE_KEY = "labProteseProdutosExcluidos";
const PRODUTOS_EXCLUIDOS_SNAPSHOTS_KEY = "labProteseProdutosExcluidosSnapshots";
const PRODUTOS_REMOVIDOS_STORAGE_KEY = "labProteseProdutosRemovidosPermanentemente";

type ColaboradorCadastro = {
  nome: string;
  setorAtuacao?: string;
};

function parseCurrency(value: string) {
  return Number(value.replace(/\D/g, "")) / 100;
}

function formatCurrencyInput(value: string) {
  return parseCurrency(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function unidadeSuffix(unidade: string) {
  if (unidade.startsWith("kg")) return "kg";
  if (unidade.startsWith("l")) return "l";
  if (unidade.startsWith("m ")) return "m";
  if (unidade.startsWith("m (")) return "m";
  if (unidade.startsWith("cx")) return "cx";
  if (unidade.startsWith("g")) return "g";
  if (unidade.startsWith("ml")) return "ml";
  return "un";
}

function unidadeDecimal(unidade: string) {
  return ["kg", "l", "m", "g", "ml"].includes(unidadeSuffix(unidade));
}

function parseQuantidade(value: string) {
  const cleaned = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return Number(cleaned) || 0;
}

function formatQuantidade(value: number, unidade: string) {
  const suffix = unidadeSuffix(unidade);
  const quantidade = unidadeDecimal(unidade)
    ? value.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })
    : String(Math.round(value));
  return `${quantidade}${suffix === "m" ? "m" : ` ${suffix}`}`;
}

function formatQuantidadeInput(value: string, unidade: string) {
  const digits = value.replace(/\D/g, "");
  const numeric = unidadeDecimal(unidade) ? Number(digits || 0) / 1000 : Number(digits || 0);
  return formatQuantidade(numeric, unidade);
}

function novoProdutoForm() {
  return {
    codigoBarras: "",
    nome: "",
    categoria: "",
    marca: "",
    etiqueta: "",
    unidadeMedida: "un (Unitário)",
    estoque: formatQuantidade(0, "un (Unitário)"),
    estoqueMinimo: formatQuantidade(0, "un (Unitário)"),
    estoqueMaximo: formatQuantidade(0, "un (Unitário)"),
    valorCusto: "R$ 0,00",
    valor: "R$ 0,00",
    observacoes: "",
    imagemUrl: "",
  };
}

const UNIDADES_MEDIDA = [
  { value: "un (Unitário)", key: "estoque.produtos.unidade.un" },
  { value: "cx (Caixa)", key: "estoque.produtos.unidade.cx" },
  { value: "kg (Quilograma)", key: "estoque.produtos.unidade.kg" },
  { value: "g (Grama)", key: "estoque.produtos.unidade.g" },
  { value: "l (Litro)", key: "estoque.produtos.unidade.l" },
  { value: "m (Metro)", key: "estoque.produtos.unidade.m" },
  { value: "ml (Mililitro)", key: "estoque.produtos.unidade.ml" },
] as const;

function OpcoesUnidadeMedida({
  t,
}: {
  t: (key: (typeof UNIDADES_MEDIDA)[number]["key"], params?: Record<string, string | number>) => string;
}) {
  return UNIDADES_MEDIDA.map((unidade) => (
    <option key={unidade.value} value={unidade.value}>
      {t(unidade.key)}
    </option>
  ));
}

function ProdutosCarregandoFallback() {
  const { t } = useI18n();
  return <ListaCarregando colSpan={10} mensagem={t("estoque.produtos.carregando")} />;
}

function ProdutosConteudo() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const notifProdutoFeito = useRef(false);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [extras, setExtras] = useState<Record<string, Partial<Produto>>>({});
  const [extrasCarregados, setExtrasCarregados] = useState(false);
  const [listaPronta, setListaPronta] = useState(false);
  const [busca, setBusca] = useState("");
  const estoqueUrl = searchParams.get("estoque");
  const filtroInicialUrl: "todos" | "minimo" | "maximo" | "zero" =
    estoqueUrl === "minimo" || estoqueUrl === "maximo" || estoqueUrl === "zero"
      ? estoqueUrl
      : "todos";
  const [filtroEstoque, setFiltroEstoque] = useState<"todos" | "minimo" | "maximo" | "zero">(
    filtroInicialUrl
  );
  const [lucroFormato, setLucroFormato] = useState<"percentual" | "valor">("percentual");
  const [modalExcluidosAberto, setModalExcluidosAberto] = useState(false);
  const [modalEtiquetasAberto, setModalEtiquetasAberto] = useState(false);
  const [etiquetasCategoria, setEtiquetasCategoria] = useState<EtiquetaCategoria[]>([]);
  const [buscaExcluidos, setBuscaExcluidos] = useState("");
  const [produtosExcluidos, setProdutosExcluidos] = useState<string[]>([]);
  const [snapshotsExcluidos, setSnapshotsExcluidos] = useState<Record<string, Produto>>({});
  const [produtosRemovidosPermanentemente, setProdutosRemovidosPermanentemente] = useState<string[]>([]);
  const persistenciaPronta = useRef(false);
  const cargaInicialConcluida = useRef(false);
  const salvandoProdutoRef = useRef(false);
  const [salvandoProduto, setSalvandoProduto] = useState(false);
  const [open, setOpen] = useState(false);
  const [editandoProduto, setEditandoProduto] = useState<Produto | null>(null);
  const [visualizandoProduto, setVisualizandoProduto] = useState<Produto | null>(null);
  const [produtoParaExcluir, setProdutoParaExcluir] = useState<Produto | null>(null);
  const [produtoParaExcluirPermanente, setProdutoParaExcluirPermanente] = useState<Produto | null>(null);
  const [movimentoParaExcluir, setMovimentoParaExcluir] = useState<MovimentoEstoque | null>(null);
  const [movimentoProduto, setMovimentoProduto] = useState<Produto | null>(null);
  const [historicoProduto, setHistoricoProduto] = useState<Produto | null>(null);
  const [historicoMovimentos, setHistoricoMovimentos] = useState<MovimentoEstoque[]>([]);
  const [setoresCadastrados, setSetoresCadastrados] = useState<string[]>([]);
  const [colaboradoresDetalhe, setColaboradoresDetalhe] = useState<ColaboradorCadastro[]>([]);
  const [historicoFiltros, setHistoricoFiltros] = useState({
    colaborador: "",
    tipoMovimento: "todos" as "todos" | "entrada" | "saida",
    setor: "",
    dataInicial: "",
    dataFinal: "",
  });
  const [fornecedoresMovimento, setFornecedoresMovimento] = useState<string[]>([]);
  const [prestadoresMovimento, setPrestadoresMovimento] = useState<string[]>([]);
  const [colaboradoresMovimento, setColaboradoresMovimento] = useState<string[]>([]);
  const [movimentoForm, setMovimentoForm] = useState({
    tipo: "entrada" as "entrada" | "saida",
    origem: "fornecedor" as "fornecedor" | "prestador" | "colaborador" | "os" | "manual",
    responsavel: "",
    unidadeMedida: "un (Unitário)",
    quantidade: "0 un",
    observacao: "",
  });
  const [form, setForm] = useState(novoProdutoForm);

  async function load() {
    const removidos = readStorage<string[]>(PRODUTOS_REMOVIDOS_STORAGE_KEY, []);
    let fromApi: Produto[] = [];
    try {
      const data = await fetch("/api/produtos").then((r) => r.json());
      if (Array.isArray(data)) fromApi = data as Produto[];
    } catch {
      // mantém lista local
    }

    const mapa = new Map<string, Produto>();
    for (const produto of fromApi) {
      if (!removidos.includes(produto.id)) mapa.set(produto.id, produto);
    }
    setProdutos(Array.from(mapa.values()));
  }

  function hidratarPersistenciaLocal() {
    setExtras(getProdutosEstoqueExtras());
    setProdutosExcluidos(readStorage<string[]>(PRODUTOS_EXCLUIDOS_STORAGE_KEY, []));
    setSnapshotsExcluidos(
      readStorage<Record<string, Produto>>(PRODUTOS_EXCLUIDOS_SNAPSHOTS_KEY, {})
    );
    setProdutosRemovidosPermanentemente(
      readStorage<string[]>(PRODUTOS_REMOVIDOS_STORAGE_KEY, [])
    );
    setExtrasCarregados(true);
    persistenciaPronta.current = true;
  }

  useEffect(() => {
    function atualizarEtiquetasCategoria() {
      setEtiquetasCategoria(carregarEtiquetasCategoria());
      setExtras(getProdutosEstoqueExtras());
    }
    atualizarEtiquetasCategoria();
    window.addEventListener(ETIQUETAS_CATEGORIA_EVENT, atualizarEtiquetasCategoria);
    return () => window.removeEventListener(ETIQUETAS_CATEGORIA_EVENT, atualizarEtiquetasCategoria);
  }, []);

  const paginaPronta = usePageReady(async () => {
    hidratarPersistenciaLocal();
    await load();
    setListaPronta(true);
    cargaInicialConcluida.current = true;
  });

  useEffect(() => {
    if (!paginaPronta) return;

    function atualizarPersistenciaSemOcultarLista() {
      if (!cargaInicialConcluida.current) return;
      hidratarPersistenciaLocal();
    }

    window.addEventListener("focus", atualizarPersistenciaSemOcultarLista);
    window.addEventListener(PRODUTOS_ESTOQUE_EVENT, atualizarPersistenciaSemOcultarLista);
    return () => {
      window.removeEventListener("focus", atualizarPersistenciaSemOcultarLista);
      window.removeEventListener(PRODUTOS_ESTOQUE_EVENT, atualizarPersistenciaSemOcultarLista);
    };
  }, [paginaPronta]);

  useEffect(() => {
    if (!historicoProduto) return;
    const produtoId = historicoProduto.id;
    let ativo = true;

    async function carregarHistoricoContexto() {
      const contexto = await fetchProdutoContexto(produtoId, 100);
      if (!ativo) return;
      if (contexto) {
        setHistoricoMovimentos(contexto.movimentos);
        return;
      }
      setHistoricoMovimentos(getHistoricoMovimentosProduto(produtoId));
    }

    function aoAtualizar() {
      void carregarHistoricoContexto();
    }

    void carregarHistoricoContexto();
    window.addEventListener(PRODUTOS_ESTOQUE_EVENT, aoAtualizar);
    window.addEventListener("focus", aoAtualizar);
    return () => {
      ativo = false;
      window.removeEventListener(PRODUTOS_ESTOQUE_EVENT, aoAtualizar);
      window.removeEventListener("focus", aoAtualizar);
    };
  }, [historicoProduto]);

  useEffect(() => {
    if (!extrasCarregados || !persistenciaPronta.current) return;
    writeStorage("labProteseProdutosEstoqueExtras", extras);
  }, [extras, extrasCarregados]);

  const produtosComEstoque = useMemo(() => {
    return produtos
      .filter((produto) => !produtosRemovidosPermanentemente.includes(produto.id))
      .map((produto) => ({
      ...produto,
      ...extras[produto.id],
      estoque: extras[produto.id]?.estoque ?? produto.estoque ?? 0,
      estoqueMinimo: extras[produto.id]?.estoqueMinimo ?? produto.estoqueMinimo ?? 0,
      estoqueMaximo: extras[produto.id]?.estoqueMaximo ?? produto.estoqueMaximo ?? 0,
      valorCusto: extras[produto.id]?.valorCusto ?? produto.valorCusto ?? 0,
      valorCustoDelta:
        typeof extras[produto.id]?.valorCustoDelta === "number"
          ? extras[produto.id]?.valorCustoDelta
          : undefined,
      marca: extras[produto.id]?.marca ?? produto.marca ?? "",
      etiqueta: etiquetaCategoriaAtiva(
        extras[produto.id]?.etiqueta ?? produto.etiqueta ?? "",
        etiquetasCategoria
      ),
      codigoBarras: extras[produto.id]?.codigoBarras ?? produto.codigoBarras ?? "",
      unidadeMedida: extras[produto.id]?.unidadeMedida ?? produto.unidadeMedida ?? "un (Unitário)",
      imagemUrl:
        typeof extras[produto.id]?.imagemUrl === "string"
          ? extras[produto.id]?.imagemUrl
          : produto.imagemUrl ?? "",
    }));
  }, [produtos, extras, produtosRemovidosPermanentemente, etiquetasCategoria]);

  useEffect(() => {
    setForm((atual) => {
      const etiquetaValida = etiquetaCategoriaAtiva(atual.etiqueta, etiquetasCategoria);
      if (etiquetaValida === (atual.etiqueta || "")) return atual;
      return { ...atual, etiqueta: etiquetaValida };
    });
  }, [etiquetasCategoria]);

  useEffect(() => {
    notifProdutoFeito.current = false;
  }, [searchParams.toString()]);

  useEffect(() => {
    if (estoqueUrl === "minimo" || estoqueUrl === "maximo" || estoqueUrl === "zero") {
      setFiltroEstoque(estoqueUrl);
    }
  }, [estoqueUrl]);

  useEffect(() => {
    if (!listaPronta || notifProdutoFeito.current) return;
    const produtoId = searchParams.get("produtoId");
    const acao = searchParams.get("acao");
    if (!produtoId || acao !== "editar") return;

    const produto = produtosComEstoque.find((p) => p.id === produtoId);
    if (!produto) return;

    notifProdutoFeito.current = true;
    abrirEdicaoProduto(produto);
    if (filtroEstoque !== "zero" && Number(produto.estoque) <= 0) {
      setFiltroEstoque("zero");
    }
  }, [listaPronta, searchParams, produtosComEstoque]);

  const produtosExcluidosLista = useMemo(() => {
    return produtosExcluidos
      .map((id) => {
        const daLista = produtosComEstoque.find((produto) => produto.id === id);
        if (daLista) return daLista;
        return snapshotsExcluidos[id];
      })
      .filter((produto): produto is Produto => Boolean(produto));
  }, [produtosComEstoque, produtosExcluidos, snapshotsExcluidos]);

  const produtosExcluidosFiltrados = useMemo(() => {
    const termo = buscaExcluidos.trim().toLowerCase();
    if (!termo) return produtosExcluidosLista;
    return produtosExcluidosLista.filter((produto) =>
      [produto.nome, produto.marca || "", produto.etiqueta || "", produto.codigoBarras || ""]
        .join(" ")
        .toLowerCase()
        .includes(termo)
    );
  }, [buscaExcluidos, produtosExcluidosLista]);

  const produtosAtivos = useMemo(
    () =>
      produtosComEstoque.filter((produto) => !produtosExcluidos.includes(produto.id)),
    [produtosComEstoque, produtosExcluidos]
  );

  const produtosFiltrados = useMemo(() => {
    const porEstoque = produtosAtivos.filter((produto) => {
      const estoque = produto.estoque || 0;
      const minimo = produto.estoqueMinimo || 0;
      const maximo = produto.estoqueMaximo || 0;
      if (filtroEstoque === "minimo") return minimo > 0 && estoque > 0 && estoque <= minimo;
      if (filtroEstoque === "maximo") return maximo > 0 && estoque > 0 && estoque >= maximo;
      if (filtroEstoque === "zero") return estoque === 0;
      return true;
    });
    const termo = busca.trim().toLowerCase();
    if (!termo) return porEstoque;
    return porEstoque.filter((produto) =>
      [
        produto.nome,
        produto.categoria || "",
        produto.marca || "",
        produto.etiqueta || "",
        produto.codigoBarras || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(termo)
    );
  }, [busca, produtosAtivos, filtroEstoque]);

  const estoqueBaixo = produtosAtivos.filter((produto) => {
    const estoque = produto.estoque || 0;
    const minimo = produto.estoqueMinimo || 0;
    return minimo > 0 && estoque > 0 && estoque <= minimo;
  }).length;
  const estoqueZerado = produtosAtivos.filter((produto) => (produto.estoque || 0) === 0).length;
  const estoqueMaximo = produtosAtivos.filter((produto) => {
    const estoque = produto.estoque || 0;
    const maximo = produto.estoqueMaximo || 0;
    return maximo > 0 && estoque > 0 && estoque >= maximo;
  }).length;

  function formFromProduto(produto: Produto) {
    const unidadeMedida = produto.unidadeMedida || "un (Unitário)";
    return {
      codigoBarras: produto.codigoBarras || "",
      nome: produto.nome || "",
      categoria: produto.categoria || "",
      marca: produto.marca || "",
      etiqueta: produto.etiqueta || "",
      unidadeMedida,
      estoque: formatQuantidade(produto.estoque || 0, unidadeMedida),
      estoqueMinimo: formatQuantidade(produto.estoqueMinimo || 0, unidadeMedida),
      estoqueMaximo: formatQuantidade(produto.estoqueMaximo || 0, unidadeMedida),
      valorCusto: (produto.valorCusto || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      valor: (produto.valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      observacoes: produto.observacoes || "",
      imagemUrl: produto.imagemUrl || "",
    };
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (salvandoProdutoRef.current) return;
    salvandoProdutoRef.current = true;
    setSalvandoProduto(true);

    try {
      if (editandoProduto) {
        const produtoAtualizado: Partial<Produto> = {
          nome: form.nome,
          categoria: form.categoria,
          observacoes: form.observacoes,
          valor: parseCurrency(form.valor),
          marca: form.marca,
          etiqueta: form.etiqueta,
          codigoBarras: form.codigoBarras,
          unidadeMedida: form.unidadeMedida,
          estoque: parseQuantidade(form.estoque),
          estoqueMinimo: parseQuantidade(form.estoqueMinimo),
          estoqueMaximo: parseQuantidade(form.estoqueMaximo),
          valorCusto: parseCurrency(form.valorCusto),
          imagemUrl: form.imagemUrl.trim() || undefined,
        };
        setProdutos((atuais) =>
          atuais.map((produto) =>
            produto.id === editandoProduto.id ? { ...produto, ...produtoAtualizado } : produto
          )
        );
        setExtras((atuais) => ({
          ...atuais,
          [editandoProduto.id]: {
            ...atuais[editandoProduto.id],
            ...produtoAtualizado,
            valorCustoDelta: undefined,
          },
        }));
        setOpen(false);
        setEditandoProduto(null);
        setForm(novoProdutoForm());
        return;
      }

      const response = await fetch("/api/produtos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: form.nome,
          categoria: form.categoria,
          observacoes: form.observacoes,
          valor: parseCurrency(form.valor),
        }),
      });
      if (!response.ok) return;

      const produto = await response.json();
      if (produto?.id) {
        setProdutos((atuais) => {
          if (atuais.some((item) => item.id === produto.id)) return atuais;
          return [...atuais, produto];
        });
        setExtras((atuais) => ({
          ...atuais,
          [produto.id]: {
            marca: form.marca,
            etiqueta: form.etiqueta,
            codigoBarras: form.codigoBarras,
            unidadeMedida: form.unidadeMedida,
            estoque: parseQuantidade(form.estoque),
            estoqueMinimo: parseQuantidade(form.estoqueMinimo),
            estoqueMaximo: parseQuantidade(form.estoqueMaximo),
            valorCusto: parseCurrency(form.valorCusto),
            imagemUrl: form.imagemUrl.trim() || undefined,
          },
        }));
      }
      setOpen(false);
      setForm(novoProdutoForm());
      await load();
    } finally {
      salvandoProdutoRef.current = false;
      setSalvandoProduto(false);
    }
  }

  function abrirNovoProduto() {
    setEditandoProduto(null);
    setForm(novoProdutoForm());
    setOpen(true);
  }

  function abrirEdicaoProduto(produto: Produto) {
    setEditandoProduto(produto);
    setForm(formFromProduto(produto));
    setOpen(true);
  }

  function abrirVisualizacaoProduto(produto: Produto) {
    setVisualizandoProduto((atual) => (atual?.id === produto.id ? null : produto));
  }

  function montarProdutoParaSnapshot(id: string): Produto | null {
    const base = produtos.find((item) => item.id === id);
    if (!base) return snapshotsExcluidos[id] ?? null;
    return {
      ...base,
      ...extras[id],
      estoque: extras[id]?.estoque ?? base.estoque ?? 0,
      estoqueMinimo: extras[id]?.estoqueMinimo ?? base.estoqueMinimo ?? 0,
      estoqueMaximo: extras[id]?.estoqueMaximo ?? base.estoqueMaximo ?? 0,
      valorCusto: extras[id]?.valorCusto ?? base.valorCusto ?? 0,
      marca: extras[id]?.marca ?? base.marca ?? "",
      etiqueta: extras[id]?.etiqueta ?? base.etiqueta ?? "",
      codigoBarras: extras[id]?.codigoBarras ?? base.codigoBarras ?? "",
      unidadeMedida: extras[id]?.unidadeMedida ?? base.unidadeMedida ?? "un (Unitário)",
      imagemUrl:
        typeof extras[id]?.imagemUrl === "string"
          ? extras[id]?.imagemUrl
          : base.imagemUrl ?? "",
    };
  }

  function confirmarExclusaoProduto() {
    if (!produtoParaExcluir) return;
    const id = produtoParaExcluir.id;
    const snapshot = montarProdutoParaSnapshot(id) || produtoParaExcluir;
    const idsAtualizados = produtosExcluidos.includes(id)
      ? produtosExcluidos
      : [...produtosExcluidos, id];
    const snapshotsAtualizados = { ...snapshotsExcluidos, [id]: snapshot };

    setProdutosExcluidos(idsAtualizados);
    setSnapshotsExcluidos(snapshotsAtualizados);
    writeStorage(PRODUTOS_EXCLUIDOS_STORAGE_KEY, idsAtualizados);
    writeStorage(PRODUTOS_EXCLUIDOS_SNAPSHOTS_KEY, snapshotsAtualizados);
    setProdutoParaExcluir(null);
    notificarProdutosEstoqueAtualizado();
  }

  function restaurarProduto(produto: Produto) {
    const idsAtualizados = produtosExcluidos.filter((id) => id !== produto.id);
    const snapshotsAtualizados = { ...snapshotsExcluidos };
    delete snapshotsAtualizados[produto.id];

    setProdutosExcluidos(idsAtualizados);
    setSnapshotsExcluidos(snapshotsAtualizados);
    writeStorage(PRODUTOS_EXCLUIDOS_STORAGE_KEY, idsAtualizados);
    writeStorage(PRODUTOS_EXCLUIDOS_SNAPSHOTS_KEY, snapshotsAtualizados);
    notificarProdutosEstoqueAtualizado();
  }

  function solicitarExclusaoPermanente(produto: Produto) {
    setProdutoParaExcluirPermanente(produto);
  }

  async function confirmarExclusaoPermanente() {
    const produto = produtoParaExcluirPermanente;
    if (!produto) return;
    const { id } = produto;
    setProdutoParaExcluirPermanente(null);

    const idsExcluidosAtualizados = produtosExcluidos.filter((itemId) => itemId !== id);
    const snapshotsAtualizados = { ...snapshotsExcluidos };
    delete snapshotsAtualizados[id];
    const removidosAtualizados = produtosRemovidosPermanentemente.includes(id)
      ? produtosRemovidosPermanentemente
      : [...produtosRemovidosPermanentemente, id];

    setProdutosExcluidos(idsExcluidosAtualizados);
    setSnapshotsExcluidos(snapshotsAtualizados);
    setProdutosRemovidosPermanentemente(removidosAtualizados);
    writeStorage(PRODUTOS_EXCLUIDOS_STORAGE_KEY, idsExcluidosAtualizados);
    writeStorage(PRODUTOS_EXCLUIDOS_SNAPSHOTS_KEY, snapshotsAtualizados);
    writeStorage(PRODUTOS_REMOVIDOS_STORAGE_KEY, removidosAtualizados);

    setProdutos((atuais) => atuais.filter((produto) => produto.id !== id));
    setExtras((atuais) => {
      if (!atuais[id]) return atuais;
      const { [id]: _, ...restantes } = atuais;
      writeStorage("labProteseProdutosEstoqueExtras", restantes);
      return restantes;
    });
    limparDadosEstoqueDoProduto(id);

    if (visualizandoProduto?.id === id) setVisualizandoProduto(null);
    if (historicoProduto?.id === id) setHistoricoProduto(null);
    if (movimentoProduto?.id === id) setMovimentoProduto(null);

    if (!id.startsWith("padrao-")) {
      void fetch(`/api/produtos?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(
        () => undefined
      );
    }
    notificarProdutosEstoqueAtualizado();
  }

  function alterarUnidadeMedida(unidadeMedida: string) {
    setForm((atual) => ({
      ...atual,
      unidadeMedida,
      estoque: formatQuantidade(parseQuantidade(atual.estoque), unidadeMedida),
      estoqueMinimo: formatQuantidade(parseQuantidade(atual.estoqueMinimo), unidadeMedida),
      estoqueMaximo: formatQuantidade(parseQuantidade(atual.estoqueMaximo), unidadeMedida),
    }));
  }

  function carregarResponsaveisMovimento() {
    if (typeof window === "undefined") return;
    try {
      const fornecedores = readStorage<Array<{ nome?: string }>>(FORNECEDORES_STORAGE_KEY, []);
      const prestadores = readStorage<Array<{ nome?: string }>>(PRESTADORES_STORAGE_KEY, []);
      const colaboradores = readStorage<Array<{ nome?: string; setorAtuacao?: string }>>(
        COLABORADORES_STORAGE_KEY,
        []
      );
      const setores = readStorage<Array<{ nome?: string }>>(SETORES_STORAGE_KEY, []);
      setFornecedoresMovimento(
        Array.isArray(fornecedores) ? fornecedores.map((item) => String(item?.nome || "")).filter(Boolean) : []
      );
      setPrestadoresMovimento(
        Array.isArray(prestadores) ? prestadores.map((item) => String(item?.nome || "")).filter(Boolean) : []
      );
      setColaboradoresMovimento(
        Array.isArray(colaboradores) ? colaboradores.map((item) => String(item?.nome || "")).filter(Boolean) : []
      );
      setColaboradoresDetalhe(
        Array.isArray(colaboradores)
          ? colaboradores
              .map((item) => ({
                nome: String(item?.nome || ""),
                setorAtuacao: String(item?.setorAtuacao || ""),
              }))
              .filter((item) => item.nome)
          : []
      );
      setSetoresCadastrados(
        Array.isArray(setores) ? setores.map((item) => String(item?.nome || "")).filter(Boolean) : []
      );
    } catch {
      setFornecedoresMovimento([]);
      setPrestadoresMovimento([]);
      setColaboradoresMovimento([]);
      setColaboradoresDetalhe([]);
      setSetoresCadastrados([]);
    }
  }

  function setorDoColaborador(nome: string) {
    return colaboradoresDetalhe.find((item) => item.nome === nome)?.setorAtuacao || "";
  }

  function setorPorOrigemMovimento(origem: typeof movimentoForm.origem, responsavel: string) {
    if (origem === "colaborador") return setorDoColaborador(responsavel) || "Colaborador";
    if (origem === "fornecedor") return "Fornecedor";
    if (origem === "prestador") return "Prestador";
    if (origem === "os") return "Produção";
    return "Manual";
  }

  function solicitarExclusaoMovimento(movimento: MovimentoEstoque) {
    setMovimentoParaExcluir(movimento);
  }

  function confirmarExclusaoMovimento() {
    if (!historicoProduto || !movimentoParaExcluir) return;
    if (!excluirMovimentoEstoque(movimentoParaExcluir)) return;
    setMovimentoParaExcluir(null);
    setExtras(getProdutosEstoqueExtras());
    setHistoricoMovimentos(getHistoricoMovimentosProduto(historicoProduto.id));
  }

  function abrirHistoricoProduto(produto: Produto) {
    carregarResponsaveisMovimento();
    setHistoricoProduto(produto);
    setHistoricoFiltros({
      colaborador: "",
      tipoMovimento: "todos",
      setor: "",
      dataInicial: "",
      dataFinal: "",
    });
    /** Fallback local imediato; o useEffect troca pelo payload de /contexto. */
    setHistoricoMovimentos(getHistoricoMovimentosProduto(produto.id));
  }

  function formatarDataHistorico(dataIso: string) {
    const data = new Date(dataIso);
    if (Number.isNaN(data.getTime())) return "-";
    return data.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function labelTipoMovimento(tipo: MovimentoEstoque["tipo"]) {
    return tipo === "entrada" ? t("estoque.produtos.movimentoEntrada") : t("estoque.produtos.movimentoSaida");
  }

  function textoMovimentoHistorico(movimento: MovimentoEstoque, unidade: string) {
    const quantidade = formatQuantidade(movimento.quantidade, unidade);
    const tipo = labelTipoMovimento(movimento.tipo);
    if (movimento.origem === "os") {
      const numero = movimento.numeroOs
        ? t("estoque.produtos.movimentoOs", { numero: movimento.numeroOs })
        : movimento.responsavel || t("estoque.produtos.movimentoOsAbrev");
      const paciente = movimento.pacienteNome
        ? t("estoque.produtos.movimentoPaciente", { nome: movimento.pacienteNome })
        : "";
      const cliente = movimento.clienteNome
        ? t("estoque.produtos.movimentoCliente", { nome: movimento.clienteNome })
        : "";
      const detalhes = [numero, paciente, cliente].filter(Boolean).join(" · ");
      return detalhes
        ? t("estoque.produtos.movimentoTextoOs", { tipo, quantidade, detalhes })
        : `${tipo} ${quantidade}`;
    }
    const origem =
      movimento.origem === "fornecedor"
        ? t("estoque.produtos.origemFornecedor")
        : movimento.origem === "prestador"
          ? t("estoque.produtos.origemPrestador")
          : movimento.origem === "colaborador"
            ? t("estoque.produtos.origemColaborador")
            : t("estoque.produtos.origemManual");
    const referencia = movimento.responsavel ? ` (${movimento.responsavel})` : "";
    const observacao = movimento.observacao ? ` — ${movimento.observacao}` : "";
    return t("estoque.produtos.movimentoTextoPadrao", {
      tipo,
      quantidade,
      origem,
      referencia,
      observacao,
    });
  }

  function colaboradorDoMovimento(movimento: MovimentoEstoque) {
    if (movimento.origem === "colaborador") return movimento.responsavel || "-";
    if (movimento.origem === "os") return "-";
    if (movimento.origem === "fornecedor" || movimento.origem === "prestador") {
      return movimento.responsavel || "-";
    }
    return movimento.responsavel || "-";
  }

  const historicoFiltrado = useMemo(() => {
    if (!historicoProduto) return [];
    return historicoMovimentos.filter((movimento) => {
      if (historicoFiltros.tipoMovimento !== "todos" && movimento.tipo !== historicoFiltros.tipoMovimento) {
        return false;
      }
      if (historicoFiltros.colaborador) {
        if (movimento.origem !== "colaborador" || movimento.responsavel !== historicoFiltros.colaborador) {
          return false;
        }
      }
      if (historicoFiltros.setor && (movimento.setor || "") !== historicoFiltros.setor) {
        return false;
      }
      if (historicoFiltros.dataInicial) {
        const inicio = new Date(`${historicoFiltros.dataInicial}T00:00:00`);
        if (new Date(movimento.data) < inicio) return false;
      }
      if (historicoFiltros.dataFinal) {
        const fim = new Date(`${historicoFiltros.dataFinal}T23:59:59.999`);
        if (new Date(movimento.data) > fim) return false;
      }
      return true;
    });
  }, [historicoMovimentos, historicoFiltros, historicoProduto]);

  const setoresHistorico = useMemo(() => {
    const dosMovimentos = historicoMovimentos.map((item) => item.setor || "").filter(Boolean);
    return Array.from(new Set([...setoresCadastrados, ...dosMovimentos])).sort();
  }, [historicoMovimentos, setoresCadastrados]);

  function abrirMovimentacao(produto: Produto) {
    carregarResponsaveisMovimento();
    setMovimentoProduto(produto);
    setMovimentoForm({
      tipo: "entrada",
      origem: "fornecedor",
      responsavel: "",
      unidadeMedida: produto.unidadeMedida || "un (Unitário)",
      quantidade: formatQuantidade(0, produto.unidadeMedida || "un (Unitário)"),
      observacao: "",
    });
  }

  function alterarTipoMovimento(tipo: "entrada" | "saida") {
    setMovimentoForm((atual) => ({
      ...atual,
      tipo,
      origem: tipo === "entrada" ? "fornecedor" : "colaborador",
      responsavel: "",
    }));
  }

  function responsaveisPorOrigem() {
    if (movimentoForm.origem === "fornecedor") return fornecedoresMovimento;
    if (movimentoForm.origem === "prestador") return prestadoresMovimento;
    if (movimentoForm.origem === "colaborador") return colaboradoresMovimento;
    return [];
  }

  function labelResponsavelMovimento() {
    if (movimentoForm.origem === "fornecedor") return t("estoque.produtos.origemFornecedor");
    if (movimentoForm.origem === "prestador") return t("estoque.produtos.origemPrestador");
    if (movimentoForm.origem === "colaborador") return t("estoque.produtos.origemColaborador");
    return t("estoque.produtos.referencia");
  }

  function alterarUnidadeMovimento(unidadeMedida: string) {
    setMovimentoForm((atual) => ({
      ...atual,
      unidadeMedida,
      quantidade: formatQuantidade(parseQuantidade(atual.quantidade), unidadeMedida),
    }));
  }

  function salvarMovimentoEstoque(event: React.FormEvent) {
    event.preventDefault();
    if (!movimentoProduto) return;
    const quantidade = parseQuantidadeEstoque(movimentoForm.quantidade);
    if (quantidade <= 0) return;

    registrarMovimentoEstoque({
      produtoId: movimentoProduto.id,
      quantidade,
      tipo: movimentoForm.tipo,
      origem: movimentoForm.origem,
      responsavel: movimentoForm.responsavel,
      observacao: movimentoForm.observacao,
      setor: setorPorOrigemMovimento(movimentoForm.origem, movimentoForm.responsavel),
      data: new Date().toISOString(),
    });
    setExtras(getProdutosEstoqueExtras());
    setMovimentoProduto(null);
  }

  function alternarFiltroEstoque(filtro: "minimo" | "maximo" | "zero") {
    setFiltroEstoque((atual) => (atual === filtro ? "todos" : filtro));
  }

  function montarUrlImprimirProdutos() {
    const params = new URLSearchParams();
    if (filtroEstoque !== "todos") params.set("estoque", filtroEstoque);
    if (busca.trim()) params.set("q", busca.trim());
    const query = params.toString();
    return query ? `/app/produtos/imprimir?${query}` : "/app/produtos/imprimir";
  }

  function lucroProduto(produto: Produto) {
    const custo = produto.valorCusto || 0;
    const venda = produto.valor || 0;
    const lucro = venda - custo;
    if (lucroFormato === "valor") return formatCurrency(lucro);
    if (custo <= 0) return venda > 0 ? "100,00%" : "0,00%";
    return `${((lucro / custo) * 100).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}%`;
  }

  return (
    <div className="space-y-4 text-xs text-slate-600">
      <ModuloCabecalho
        moduloKey="nav.estoque"
        tituloKey="nav.produtos"
        hrefModulo="/app/produtos"
      />

      {listaPronta && estoqueZerado > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-red-200 bg-red-50 px-4 py-2 text-[11px] text-red-700">
          <span>
            {estoqueZerado === 1
              ? t("estoque.produtos.alerta.estoqueZeradoUm")
              : t("estoque.produtos.alerta.estoqueZeradoVarios", { count: estoqueZerado })}
          </span>
          <Link
            href="/app/orcamentos?novo=1"
            className="rounded bg-emerald-500 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-emerald-600"
          >
            {t("estoque.orcamentos.solicitar")}
          </Link>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <ResumoCard label={t("estoque.produtos.estoqueMinimo")} value={estoqueBaixo} tone="emerald" active={filtroEstoque === "minimo"} onView={() => alternarFiltroEstoque("minimo")} />
        <ResumoCard label={t("estoque.produtos.estoqueMaximo")} value={estoqueMaximo} tone="amber" active={filtroEstoque === "maximo"} onView={() => alternarFiltroEstoque("maximo")} />
        <ResumoCard label={t("estoque.produtos.estoqueZero")} value={estoqueZerado} tone="rose" active={filtroEstoque === "zero"} onView={() => alternarFiltroEstoque("zero")} />
      </div>

      <div className="rounded border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={abrirNovoProduto}
              className="inline-flex h-7 items-center gap-1 rounded-sm bg-emerald-500 px-3 text-[10px] font-semibold text-white hover:bg-emerald-600"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("estoque.produtos.adicionar")}
            </button>
            <Link
              href={montarUrlImprimirProdutos()}
              target="_blank"
              rel="noopener noreferrer"
              title={t("cadastros.comum.imprimir")}
              className="inline-flex h-7 w-7 items-center justify-center rounded-sm bg-blue-500 text-white hover:bg-blue-600"
            >
              <Printer className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              onClick={() => {
                setBuscaExcluidos("");
                setModalExcluidosAberto(true);
              }}
              className="inline-flex h-7 items-center gap-1 rounded-sm bg-blue-500 px-3 text-[10px] font-semibold text-white hover:bg-blue-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("estoque.produtos.verExcluidos")}
            </button>
            <button
              type="button"
              onClick={() => setModalEtiquetasAberto(true)}
              className="inline-flex h-7 items-center gap-1 rounded-sm bg-emerald-500 px-3 text-[10px] font-semibold text-white hover:bg-emerald-600"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("estoque.produtos.etiquetaCategoria")}
            </button>
          </div>
          <div className="flex w-full max-w-xl items-center gap-1">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1.5 h-4 w-4 text-slate-300" />
              <input
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder={t("estoque.produtos.buscarPlaceholder")}
                className="h-7 w-full rounded-sm border border-slate-200 pl-7 pr-3 text-[10px] outline-none focus:border-blue-400"
              />
            </div>
            <button
              type="button"
              onClick={() => setBusca("")}
              className="h-7 rounded-sm bg-slate-500 px-3 text-[10px] font-semibold text-white hover:bg-slate-600"
            >
              {t("cadastros.comum.limpar")}
            </button>
          </div>
        </div>

        <ListagemPorNome
          storageKey="produtos"
          itens={listaPronta ? produtosFiltrados : []}
          opcoesExtras={[
            {
              valor: "valor",
              label: t("estoque.produtos.valorVenda"),
              comparar: (a, b) => compararNumero(a.valor, b.valor),
            },
            {
              valor: "estoque",
              label: t("estoque.produtos.estoque"),
              comparar: (a, b) => compararNumero(a.estoque || 0, b.estoque || 0),
            },
          ]}
        >
          {(itensPagina) => (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-[10px]">
            <thead>
              <tr className="border-y border-slate-100 bg-slate-50 text-slate-500">
                <th className="w-10 px-3 py-2 text-left font-semibold uppercase">{t("estoque.orcamentos.todos")}</th>
                <th className="px-3 py-2 text-left font-semibold uppercase">{t("estoque.produtos.codigoBarras")}</th>
                <th className="px-3 py-2 text-left font-semibold uppercase">{t("cadastros.comum.nome")}</th>
                <th className="px-3 py-2 text-left font-semibold uppercase">{t("estoque.produtos.etiqueta")}</th>
                <th className="px-3 py-2 text-left font-semibold uppercase">{t("estoque.produtos.marca")}</th>
                <th className="px-3 py-2 text-center font-semibold uppercase">{t("estoque.produtos.estoque")}</th>
                <th className="px-3 py-2 text-right font-semibold uppercase">{t("estoque.produtos.valorCusto")}</th>
                <th className="px-3 py-2 text-right font-semibold uppercase">{t("estoque.produtos.valorVenda")}</th>
                <th className="px-3 py-2 text-right font-semibold uppercase">
                  <button
                    type="button"
                    onClick={() => setLucroFormato((atual) => (atual === "percentual" ? "valor" : "percentual"))}
                    className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-slate-100"
                    title={t("estoque.produtos.lucroAlternarTitulo")}
                  >
                    {t("estoque.produtos.lucro")} ({lucroFormato === "percentual" ? "%" : "R$"}) <span className="text-[9px]">▾</span>
                  </button>
                </th>
                <th className="px-3 py-2 text-center font-semibold uppercase">{t("cadastros.comum.opcoes")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {!listaPronta ? (
                <ListaCarregando colSpan={10} mensagem={t("estoque.produtos.carregando")} />
              ) : (
                itensPagina.map((produto) => {
                const aberto = visualizandoProduto?.id === produto.id;
                return (
                  <Fragment key={produto.id}>
                    <tr className={aberto ? "bg-blue-50/40" : "hover:bg-slate-50"}>
                      <td className="px-3 py-2"><input type="checkbox" className="h-3 w-3" /></td>
                      <td className="px-3 py-2 text-slate-500">{produto.codigoBarras || ""}</td>
                      <td className="px-3 py-2 font-medium text-slate-700">{produto.nome}</td>
                      <td className="px-3 py-2">
                        <EtiquetaCategoriaBadge nome={produto.etiqueta} etiquetas={etiquetasCategoria} />
                      </td>
                      <td className="px-3 py-2">{produto.marca || ""}</td>
                      <td className="px-3 py-2 text-center">
                        {formatQuantidade(produto.estoque || 0, produto.unidadeMedida || "un (Unitário)")}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="inline-flex flex-wrap items-center justify-end gap-x-0.5">
                          {formatCurrency(produto.valorCusto || 0)}
                          <IndicadorVariacaoCusto delta={produto.valorCustoDelta} />
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">{formatCurrency(produto.valor || 0)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-emerald-600">{lucroProduto(produto)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1 text-slate-500">
                          <button
                            type="button"
                            onClick={() => abrirHistoricoProduto(produto)}
                            className="rounded p-1 hover:bg-slate-100 hover:text-slate-700"
                            title={t("estoque.produtos.historico")}
                          >
                            <List className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => abrirVisualizacaoProduto(produto)}
                            className={`rounded p-1 hover:bg-blue-50 hover:text-blue-600 ${
                              aberto ? "bg-blue-50 text-blue-500" : ""
                            }`}
                            title={t("cadastros.comum.visualizar")}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => abrirEdicaoProduto(produto)}
                            className="rounded p-1 hover:bg-slate-100 hover:text-blue-600"
                            title={t("cadastros.comum.editar")}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setProdutoParaExcluir(produto)}
                            className="rounded p-1 text-red-500 hover:bg-red-50"
                            title={t("cadastros.comum.excluir")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => abrirMovimentacao(produto)}
                            className="rounded bg-emerald-500 px-2 py-0.5 text-[9px] font-semibold text-white hover:bg-emerald-600"
                          >
                            {t("estoque.produtos.movimentar")}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {aberto && (
                      <tr className="bg-white">
                        <td colSpan={10} className="px-3 py-3">
                          <div className="rounded border border-slate-100 bg-white p-3 text-[10px] text-slate-600">
                            <div className="mb-3 flex items-center gap-2 font-semibold text-emerald-600">
                              <Eye className="h-3.5 w-3.5" />
                              {produto.nome}
                            </div>
                            <div className="grid gap-x-8 gap-y-3 border-b border-slate-100 pb-3 md:grid-cols-4">
                              <p><span className="font-semibold text-slate-700">{t("estoque.produtos.codigoBarras")}:</span> {produto.codigoBarras || ""}</p>
                              <p className="flex flex-wrap items-center gap-1.5">
                                <span className="font-semibold text-slate-700">{t("estoque.produtos.etiqueta")}:</span>
                                <EtiquetaCategoriaBadge nome={produto.etiqueta} etiquetas={etiquetasCategoria} />
                              </p>
                              <p><span className="font-semibold text-slate-700">{t("estoque.produtos.marca")}:</span> {produto.marca || ""}</p>
                              <p>
                                <span className="font-semibold text-slate-700">{t("estoque.produtos.estoque")}:</span>{" "}
                                {formatQuantidade(produto.estoque || 0, produto.unidadeMedida || "un (Unitário)")}
                              </p>
                              <p>
                                <span className="font-semibold text-slate-700">{t("estoque.produtos.estoqueMinimo")}:</span>{" "}
                                {formatQuantidade(produto.estoqueMinimo || 0, produto.unidadeMedida || "un (Unitário)")}
                              </p>
                              <p>
                                <span className="font-semibold text-slate-700">{t("estoque.produtos.estoqueMaximo")}:</span>{" "}
                                {formatQuantidade(produto.estoqueMaximo || 0, produto.unidadeMedida || "un (Unitário)")}
                              </p>
                              <p className="inline-flex flex-wrap items-center gap-1">
                                <span className="font-semibold text-slate-700">{t("estoque.produtos.valorCusto")}:</span>{" "}
                                {formatCurrency(produto.valorCusto || 0)}
                                <IndicadorVariacaoCusto delta={produto.valorCustoDelta} />
                              </p>
                              <p><span className="font-semibold text-slate-700">{t("estoque.produtos.valorVenda")}:</span> {formatCurrency(produto.valor || 0)}</p>
                            </div>
                            {(produto.estoque || 0) === 0 && (
                              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                                <span>{t("estoque.produtos.produtoEstoqueZerado")}</span>
                                <Link
                                  href="/app/orcamentos?novo=1"
                                  className="rounded bg-emerald-500 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-emerald-600"
                                >
                                  {t("estoque.orcamentos.solicitar")}
                                </Link>
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => setVisualizandoProduto(null)}
                              className="mt-3 rounded border border-slate-300 bg-white px-3 py-1 text-[10px] text-slate-600 hover:bg-slate-50"
                            >
                              {t("cadastros.comum.fecharDetalhes")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
              )}
              {listaPronta && produtosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-slate-400">
                    {t("estoque.produtos.nenhumEncontrado")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
          )}
        </ListagemPorNome>
      </div>

      <Modal
        open={open}
        onClose={() => {
          if (salvandoProduto) return;
          setOpen(false);
          setEditandoProduto(null);
        }}
        title={
          editandoProduto
            ? t("estoque.produtos.editarComNome", { nome: editandoProduto.nome })
            : t("estoque.produtos.cadastrarTitulo")
        }
        size="xl"
      >
        <form onSubmit={save} className="space-y-5 text-[11px] text-slate-600">
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <Plus className="h-3.5 w-3.5" />
              {t("estoque.produtos.dadosProduto")}
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                label={t("estoque.produtos.codigoBarras")}
                value={form.codigoBarras}
                onChange={(e) => setForm({ ...form, codigoBarras: e.target.value })}
              />
              <Input
                label={t("cadastros.comum.nome")}
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                required
              />
              <div className="md:col-span-2">
                <ProdutoFotoCampo
                  value={form.imagemUrl}
                  disabled={salvandoProduto}
                  onChange={(imagemUrl) => setForm({ ...form, imagemUrl })}
                />
              </div>
              <Input
                label={t("estoque.produtos.marca")}
                value={form.marca}
                onChange={(e) => setForm({ ...form, marca: e.target.value })}
              />
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Select
                    label={t("estoque.produtos.etiqueta")}
                    value={etiquetaCategoriaAtiva(form.etiqueta, etiquetasCategoria)}
                    onChange={(e) => setForm({ ...form, etiqueta: e.target.value })}
                  >
                    <option value="">{t("estoque.produtos.selecioneEllipsis")}</option>
                    {etiquetasCategoria.map((etiqueta) => (
                      <option key={etiqueta.id} value={etiqueta.nome}>
                        {etiqueta.nome}
                      </option>
                    ))}
                  </Select>
                  <button
                    type="button"
                    onClick={() => setModalEtiquetasAberto(true)}
                    className="text-[10px] font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
                  >
                    {t("estoque.produtos.adicionarEtiqueta")}
                  </button>
                </div>
                <Select
                  label={t("estoque.produtos.unidadeMedida")}
                  value={form.unidadeMedida}
                  onChange={(e) => alterarUnidadeMedida(e.target.value)}
                >
                  <OpcoesUnidadeMedida t={t} />
                </Select>
              </div>
              <Input
                label={t("estoque.produtos.estoqueMinimo")}
                selectOnFocus
                value={form.estoqueMinimo}
                onChange={(e) => setForm({ ...form, estoqueMinimo: formatQuantidadeInput(e.target.value, form.unidadeMedida) })}
              />
              <Input
                label={t("estoque.produtos.estoqueMaximo")}
                selectOnFocus
                value={form.estoqueMaximo}
                onChange={(e) => setForm({ ...form, estoqueMaximo: formatQuantidadeInput(e.target.value, form.unidadeMedida) })}
              />
              <Input
                label={t("estoque.produtos.precoCusto")}
                selectOnFocus
                value={form.valorCusto}
                onChange={(e) => setForm({ ...form, valorCusto: formatCurrencyInput(e.target.value) })}
              />
              <Input
                label={t("estoque.produtos.precoVenda")}
                selectOnFocus
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: formatCurrencyInput(e.target.value) })}
              />
            </div>
          </section>

          <div className="flex justify-start gap-2 border-t border-slate-100 pt-4">
            <Button type="submit" size="sm" disabled={salvandoProduto}>
              {salvandoProduto
                ? editandoProduto
                  ? t("estoque.produtos.salvando")
                  : t("estoque.produtos.cadastrando")
                : editandoProduto
                  ? t("cadastros.comum.salvar")
                  : t("cadastros.comum.cadastrar")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={salvandoProduto}
              onClick={() => {
                setOpen(false);
                setEditandoProduto(null);
              }}
            >
              {t("cadastros.comum.fechar")}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmacaoExclusaoModal
        open={Boolean(produtoParaExcluir)}
        titulo={t("estoque.produtos.excluirTitulo")}
        mensagem={t("estoque.produtos.excluirMensagem")}
        aviso={t("estoque.produtos.excluirAviso")}
        detalhe={produtoParaExcluir?.nome}
        onClose={() => setProdutoParaExcluir(null)}
        onConfirm={confirmarExclusaoProduto}
      />

      <ConfirmacaoExclusaoModal
        open={Boolean(movimentoParaExcluir)}
        titulo={t("estoque.produtos.excluirMovimentacaoTitulo")}
        mensagem={t("estoque.produtos.excluirMovimentacaoMensagem")}
        aviso={t("estoque.produtos.excluirMovimentacaoAviso")}
        onClose={() => setMovimentoParaExcluir(null)}
        onConfirm={confirmarExclusaoMovimento}
      />

      <ConfirmacaoExclusaoModal
        open={Boolean(produtoParaExcluirPermanente)}
        titulo={t("estoque.produtos.excluirPermanenteTitulo")}
        mensagem={t("estoque.produtos.excluirPermanenteMensagem")}
        aviso={t("estoque.produtos.excluirPermanenteAviso")}
        detalhe={produtoParaExcluirPermanente?.nome}
        onClose={() => setProdutoParaExcluirPermanente(null)}
        onConfirm={confirmarExclusaoPermanente}
      />

      <GerenciarEtiquetasCategoriaModal
        open={modalEtiquetasAberto}
        onClose={() => setModalEtiquetasAberto(false)}
        produtos={produtosComEstoque}
        onEtiquetaSalva={(nome) => setForm((atual) => ({ ...atual, etiqueta: nome }))}
        onEtiquetaExcluida={(nome) =>
          setForm((atual) => (atual.etiqueta === nome ? { ...atual, etiqueta: "" } : atual))
        }
        layerClassName="z-[60]"
      />

      <Modal
        open={modalExcluidosAberto}
        onClose={() => setModalExcluidosAberto(false)}
        title={t("estoque.produtos.excluidosTitulo")}
        size="lg"
      >
        <div className="space-y-4 text-[11px] text-slate-600">
          <div className="flex items-center gap-1">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1.5 h-4 w-4 text-slate-300" />
              <input
                value={buscaExcluidos}
                onChange={(event) => setBuscaExcluidos(event.target.value)}
                placeholder={t("estoque.produtos.buscarExcluidosPlaceholder")}
                className="h-7 w-full rounded-sm border border-slate-200 pl-7 pr-3 text-[10px] outline-none focus:border-blue-400"
              />
            </div>
            <button
              type="button"
              onClick={() => setBuscaExcluidos("")}
              className="h-7 rounded-sm bg-slate-500 px-3 text-[10px] font-semibold text-white hover:bg-slate-600"
            >
              {t("cadastros.comum.limpar")}
            </button>
          </div>

          <div className="overflow-x-auto rounded border border-slate-100">
            <table className="min-w-full text-left">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-400">
                <tr>
                  <th className="px-3 py-2">{t("estoque.produtos.codigoBarras")}</th>
                  <th className="px-3 py-2">{t("cadastros.comum.nome")}</th>
                  <th className="px-3 py-2">{t("estoque.produtos.marca")}</th>
                  <th className="px-3 py-2 text-center">{t("estoque.produtos.estoque")}</th>
                  <th className="px-3 py-2 text-center">{t("cadastros.comum.opcoes")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {produtosExcluidosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                      {t("estoque.produtos.nenhumExcluido")}
                    </td>
                  </tr>
                ) : (
                  produtosExcluidosFiltrados.map((produto) => (
                    <tr key={produto.id}>
                      <td className="px-3 py-2 text-slate-500">{produto.codigoBarras || ""}</td>
                      <td className="px-3 py-2 font-medium text-slate-700">{produto.nome}</td>
                      <td className="px-3 py-2">{produto.marca || ""}</td>
                      <td className="px-3 py-2 text-center">
                        {formatQuantidade(produto.estoque || 0, produto.unidadeMedida || "un (Unitário)")}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="inline-flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => restaurarProduto(produto)}
                            className="rounded bg-emerald-500 px-2 py-0.5 text-[9px] font-semibold text-white hover:bg-emerald-600"
                          >
                            {t("cadastros.comum.restaurar")}
                          </button>
                          <button
                            type="button"
                            onClick={() => solicitarExclusaoPermanente(produto)}
                            className="rounded p-1 text-red-500 hover:bg-red-50"
                            title={t("cadastros.comum.removerDefinitivo")}
                            aria-label={t("cadastros.comum.removerDefinitivo")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-center border-t border-slate-100 pt-4">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-w-[120px]"
              onClick={() => setModalExcluidosAberto(false)}
            >
              {t("cadastros.comum.fechar")}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(movimentoProduto)}
        onClose={() => setMovimentoProduto(null)}
        title={t("estoque.produtos.movimentarEstoque")}
        size="md"
      >
        <form onSubmit={salvarMovimentoEstoque} className="space-y-4 text-[11px] text-slate-600">
          <div className="rounded border border-slate-100 bg-slate-50 p-3">
            <p className="font-semibold text-slate-700">{movimentoProduto?.nome}</p>
            <p className="text-slate-500">
              {t("estoque.produtos.estoqueAtual")}{" "}
              {movimentoProduto
                ? formatQuantidade(movimentoProduto.estoque || 0, movimentoProduto.unidadeMedida || "un (Unitário)")
                : "-"}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Select
              label={t("estoque.produtos.tipo")}
              value={movimentoForm.tipo}
              onChange={(event) => alterarTipoMovimento(event.target.value as "entrada" | "saida")}
            >
              <option value="entrada">{t("estoque.produtos.tipoEntrada")}</option>
              <option value="saida">{t("estoque.produtos.tipoSaida")}</option>
            </Select>
            <Select
              label={t("estoque.produtos.origem")}
              value={movimentoForm.origem}
              onChange={(event) =>
                setMovimentoForm({ ...movimentoForm, origem: event.target.value as typeof movimentoForm.origem, responsavel: "" })
              }
            >
              {movimentoForm.tipo === "entrada" ? (
                <option value="fornecedor">{t("estoque.produtos.origemFornecedor")}</option>
              ) : (
                <>
                  <option value="colaborador">{t("estoque.produtos.origemColaborador")}</option>
                  <option value="prestador">{t("estoque.produtos.origemPrestador")}</option>
                  <option value="os">{t("estoque.produtos.origemOs")}</option>
                </>
              )}
              <option value="manual">{t("estoque.produtos.origemManual")}</option>
            </Select>
            <Select
              label={t("estoque.produtos.unidadeMedida")}
              value={movimentoForm.unidadeMedida}
              onChange={(event) => alterarUnidadeMovimento(event.target.value)}
            >
              <OpcoesUnidadeMedida t={t} />
            </Select>
            <Input
              label={t("estoque.produtos.quantidade")}
              selectOnFocus
              value={movimentoForm.quantidade}
              onChange={(event) =>
                setMovimentoForm({
                  ...movimentoForm,
                  quantidade: formatQuantidadeInput(
                    event.target.value,
                    movimentoForm.unidadeMedida
                  ),
                })
              }
            />
            {["fornecedor", "prestador", "colaborador"].includes(movimentoForm.origem) ? (
              <Select
                label={labelResponsavelMovimento()}
                value={movimentoForm.responsavel}
                onChange={(event) => setMovimentoForm({ ...movimentoForm, responsavel: event.target.value })}
              >
                <option value="">{t("cadastros.comum.selecione")}</option>
                {responsaveisPorOrigem().map((nome) => (
                  <option key={nome} value={nome}>
                    {nome}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                label={t("estoque.produtos.referencia")}
                value={movimentoForm.responsavel}
                onChange={(event) => setMovimentoForm({ ...movimentoForm, responsavel: event.target.value })}
                placeholder={t("estoque.produtos.referenciaPlaceholder")}
              />
            )}
          </div>

          <Input
            label={t("estoque.produtos.observacao")}
            value={movimentoForm.observacao}
            onChange={(event) => setMovimentoForm({ ...movimentoForm, observacao: event.target.value })}
            placeholder={t("estoque.produtos.observacaoPlaceholder")}
          />

          <div className="flex justify-start gap-2 border-t border-slate-100 pt-4">
            <Button type="submit" size="sm">{t("estoque.produtos.salvarMovimento")}</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setMovimentoProduto(null)}>
              {t("cadastros.comum.fechar")}
            </Button>
          </div>
        </form>
      </Modal>

      <HistoricoMovimentosModal
        open={Boolean(historicoProduto)}
        onClose={() => setHistoricoProduto(null)}
        filtros={historicoFiltros}
        onFiltrosChange={setHistoricoFiltros}
        colaboradores={colaboradoresMovimento}
        setores={setoresHistorico}
        movimentos={historicoFiltrado}
        formatarData={formatarDataHistorico}
        labelTipo={labelTipoMovimento}
        textoMovimento={(movimento) =>
          textoMovimentoHistorico(movimento, historicoProduto?.unidadeMedida || "un (Unitário)")
        }
        colaboradorMovimento={colaboradorDoMovimento}
        onExcluirMovimento={solicitarExclusaoMovimento}
      />
    </div>
  );
}

export default function ProdutosPage() {
  return (
    <Suspense fallback={<ProdutosCarregandoFallback />}>
      <ProdutosConteudo />
    </Suspense>
  );
}

function ResumoCard({
  label,
  value,
  tone,
  active,
  onView,
}: {
  label: string;
  value: number;
  tone: "emerald" | "amber" | "rose";
  active: boolean;
  onView: () => void;
}) {
  const { t } = useI18n();
  const toneClass = {
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
  }[tone];

  return (
    <div className={`rounded border bg-white p-4 shadow-sm ${active ? "border-primary-300 ring-1 ring-primary-100" : "border-slate-100"}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-semibold text-slate-800">{value}</p>
          <p className="text-[11px] text-slate-500">
            {label}{" "}
            <button
              type="button"
              onClick={onView}
              className="ml-1 rounded bg-blue-500 px-1.5 py-0.5 text-[9px] font-semibold text-white hover:bg-blue-600"
            >
              {t("estoque.produtos.ver")}
            </button>
          </p>
        </div>
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${toneClass}`}>
          {tone === "emerald" ? "P" : tone === "amber" ? "○" : "△"}
        </span>
      </div>
    </div>
  );
}
