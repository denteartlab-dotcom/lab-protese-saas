"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ImageUp, Info, Plus, Save, Tag, Trash2 } from "lucide-react";
import { PainelCarregando } from "@/components/ListaCarregando";
import {
  ImprimirOsModal,
  type TrabalhoImpressaoOs,
} from "@/components/ImprimirOsModal";
import { Button, CampoDataBr, CampoHoraBr, Input, Modal, Select, Textarea } from "@/components/ui";
import { notificarUploadsAtualizados } from "@/lib/uploads-armazenamento";
import { formatDateBr, parseBrDate } from "@/lib/datas-br";
import { propsInputComSelecaoAoFocar } from "@/lib/input-selecao";
import { usePageReady } from "@/hooks/use-page-ready";
import {
  getProdutosEstoqueExtras,
  parseQuantidadeEstoque,
  PRODUTOS_ESTOQUE_EVENT,
  sincronizarMovimentosOs,
  type MovimentoEstoque,
} from "@/lib/estoque";
import {
  buscarRegistroParaBlocoSalvar,
  classificarItemOs,
  deveDividirOs,
  grupoOsTemMultiplosSegmentos,
  editIdPreferidoGrupo,
  formatarDescontoItemOs,
  itemExibeBadgeProduto,
  itemExibeBadgeTransporte,
  itemSomenteFrete,
  itemUsaCamposOdontologicos,
  nomeExibicaoItemOs,
  planejarBlocosSalvarOs,
  tituloSegmentoOs,
  tituloTrabalhoServicoItem,
  type SegmentoFaturamento,
} from "@/lib/trabalho-os-segmento";
import { calcularDatasPrazoServico } from "@/lib/prazos-servico";
import {
  buscarServicoNaTabela,
  carregarCategoriasPorTabelaPreco,
  categoriaDoServicoNaTabela,
  etapasFormParaItemServico,
  etapasIniciaisFormParaOsServico,
  modelosEtapasParaOsServico,
  montarPrazoEtapaOs,
  valorMonetarioEtapaServico,
  servicoTemEtapasNaTabela,
  servicoTemComissoesColaboradoresNaTabela,
  servicoTemComissoesTerceirizadosNaTabela,
  colaboradoresIniciaisFormParaOsServico,
  terceirizadosIniciaisFormParaOsServico,
  comissaoColaboradorNaTabelaServico,
  comissoesColaboradoresDoServico,
  comissoesTerceirizadosDoServico,
  produtosOpcoesNaOs,
  servicosDaCategoriaTabela,
  categoriasSelecionaveisNaOs,
  servicosSelecionaveisNaOs,
  TABELA_PRECOS_STORAGE_KEY,
  type ServicoTabelaPrecoOs,
} from "@/lib/tabela-precos-os";
import {
  carregarColaboradoresListagem,
  type ColaboradorListagem,
} from "@/lib/colaboradores-listagem";
import {
  carregarEtapasCadastro,
  deduplicarColaboradores,
  deduplicarEtapas,
  exibirComissaoPercentual,
  formatarComissaoPercentInput,
  formatarLinhaColaborador,
  formatarLinhaEtapaComTempo,
  nomeEtapaSemSetor,
  instrucoesTextoLivre,
  parseComplementosInstrucoesGrupo,
  removerComplementosOsDoCorpo,
  prazoVencimentoEtapaOs,
  type EtapaCadastro,
} from "@/lib/etapas-os";
import { carregarSetoresCadastro, type SetorCadastro } from "@/lib/setores-cadastro";
import { readStorage, writeStorage } from "@/lib/persisted-storage";
import { exibirTexto, STATUS_TRABALHO } from "@/lib/utils";
import { bodyTrabalhoSemNull } from "@/lib/trabalho-api-body";
import { notificarTrabalhosAtualizados } from "@/lib/trabalhos-events";
import {
  DENTES_DECIDUOS_INFERIORES,
  DENTES_DECIDUOS_SUPERIORES,
  tipoDenticaoFromNumerosDentes,
  urlImagemDente,
} from "@/lib/dentes-imagens";

type Cliente = { id: string; nome: string; observacoes?: string | null };
type Produto = { id: string; nome: string; categoria?: string | null; valor: number; estoque?: number; unidadeMedida?: string };
type TerceirizadoOpcao = {
  id: string;
  nome: string;
  origem: "fornecedor" | "prestador";
  valorComissao?: string;
  valorComissaoRepeticao?: string;
  tipoServico?: string;
};
type TerceirizadoStorage = {
  id?: string;
  nome?: string;
  valorComissao?: string;
  valorComissaoRepeticao?: string;
  tipoServico?: string;
};
type ServicoTabelaPreco = {
  id: string;
  nome: string;
  valor: number;
  prazo?: string;
  prazoDentista?: string;
  tipo?: "servico" | "produto" | "transporte";
  produtoId?: string;
};
type CategoriaTabelaPreco = { id: string; nome: string; servicos: ServicoTabelaPreco[] };
type LancamentoFinanceiro = {
  tipo: string;
  status: string;
  valor: number;
  cliente?: { id?: string | null } | null;
};
type ArquivoOs = { name: string; type: string; url: string };
type TrabalhoEdicao = {
  id: string;
  numeroOs: number;
  segmentoFaturamento?: string;
  grupoOsId?: string | null;
  grupo?: TrabalhoEdicao[];
  clienteId: string;
  pacienteId?: string;
  tipoProtese: string;
  dentes?: string | null;
  cor?: string | null;
  material?: string | null;
  escala?: string | null;
  dataEntrada: string;
  dataPrevista?: string | null;
  valor: number;
  status: string;
  observacoes?: string | null;
  instrucoes?: string | null;
  cliente?: { observacoes?: string | null };
  paciente?: { nome?: string | null };
};
type EtapaOsForm = {
  nome: string;
  setor: string;
  responsavel: string;
  prazo: string;
  observacao: string;
  comissaoReais?: string;
};

type EtapaOsItemServico = EtapaOsForm;

type ItemAdicionado = {
  id: string;
  servico: string;
  categoria?: string;
  numeroDente: string;
  corDente: string;
  quantidade: string;
  valor: number;
  descontoTipo?: string;
  desconto?: string;
  situacao?: string;
  produtoId?: string;
  observacao?: string;
  urgente?: boolean;
  repeticao?: boolean;
  /** Etapas preenchidas para este serviço (uma OS com vários serviços). */
  etapasServico?: EtapaOsItemServico[];
};
type CampoData = "dataLancamento" | "dataLaboratorio" | "dataDentista";
type TipoDenticao = "permanente" | "deciduos";

const produtosPadrao: Produto[] = [
  { id: "padrao-zirconia", nome: "Coroa em zircônia", categoria: "Fixa", valor: 450 },
  { id: "padrao-total", nome: "Prótese total superior", categoria: "Removível", valor: 1200 },
  { id: "padrao-protocolo", nome: "Protocolo sobre implante", categoria: "Implante", valor: 2500 },
];

const FORNECEDORES_STORAGE_KEY = "labProteseFornecedores";
const PRESTADORES_STORAGE_KEY = "labProtesePrestadores";
const MATERIAIS_DENTISTA_STORAGE_KEY = "labProteseMateriaisDentista";
const ETAPAS_STORAGE_KEY = "labProteseEtapas";
const SETORES_STORAGE_KEY = "labProteseSetores";
const COLABORADORES_STORAGE_KEY = "labProteseColaboradores";
const LIMITE_ARQUIVOS_OS = 5;

const categoriasTabelaPrecoPadrao: CategoriaTabelaPreco[] = [
  {
    id: "removivel",
    nome: "REMOVÍVEL",
    servicos: [
      { id: "1", nome: "Acrilização superior", valor: 110 },
      { id: "2", nome: "Acrilização par comum", valor: 100 },
      { id: "3", nome: "Prótese total", valor: 370 },
    ],
  },
  {
    id: "protocolo",
    nome: "PROTOCOLO",
    servicos: [
      { id: "13", nome: "Acrilização Caracterizada", valor: 300 },
      { id: "15", nome: "Barra Metálica", valor: 700 },
      { id: "17", nome: "Protocolo", valor: 900 },
    ],
  },
];

const materiaisPadrao = [
  "Antagonista",
  "Análogo",
  "Barra Protocolo",
  "Componente Protético",
  "Dente",
  "Estrutura Metálica (PPR)",
  "Modelo de Trabalho",
  "Modelo de Gesso",
  "Moldeira Inf",
  "Moldeira Sup",
  "Mordida em cera",
  "Muralha de silicone",
  "Parafuso",
  "Transferente",
  "Cicatrizador",
];

const dentesSuperiores = ["18", "17", "16", "15", "14", "13", "12", "11", "21", "22", "23", "24", "25", "26", "27", "28"];
const dentesInferiores = ["48", "47", "46", "45", "44", "43", "42", "41", "31", "32", "33", "34", "35", "36", "37", "38"];
const dentesDeciduosSuperiores = [...DENTES_DECIDUOS_SUPERIORES];
const dentesDeciduosInferiores = [...DENTES_DECIDUOS_INFERIORES];

function requiredLabel(label: string, show = false) {
  return (
    <span>
      {label} {show && <span className="text-red-600">(*) Campo Obrigatório</span>}
    </span>
  );
}

function parseMoney(value: string) {
  const normalized = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return Number(normalized) || 0;
}

function itensFromTrabalho(trabalho: TrabalhoEdicao): ItemAdicionado[] {
  const itens = (trabalho.instrucoes || "")
    .split("\n")
    .map((line, index) => {
      const match = line.match(
        /^Item adicionado:\s*(.*?)\s*-\s*dentes\s*(.*?)\s*-\s*cor\s*(.*?)\s*-\s*qtd\s*(.*?)\s*-\s*valor\s*(.*)$/i
      );
      if (!match) return null;
      return {
        id: `${trabalho.id}-${index}`,
        servico: match[1]?.trim() || trabalho.tipoProtese,
        categoria:
          line.match(/ - categoria (.*?)(?: - desc| - situação| - produtoId| - urgente| - repetição| - repeticao| - obs|$)/i)?.[1]?.trim() ||
          trabalho.escala ||
          "",
        numeroDente: match[2]?.trim() || trabalho.dentes || "-",
        corDente: match[3]?.trim() || trabalho.cor || "-",
        quantidade: match[4]?.trim() || "1",
        valor: parseMoney(line.match(/ - valor (.*?)(?: - categoria| - desc| - situação| - produtoId| - urgente| - repetição| - repeticao| - obs|$)/i)?.[1] || match[5] || ""),
        desconto:
          line.match(
            / - desc (.*?)(?: - categoria| - situação| - produtoId| - urgente| - repetição| - repeticao| - obs|$)/i
          )?.[1]?.trim() || "0,00",
        situacao: line.match(/ - situação (.*?)(?: - produtoId| - urgente| - repetição| - repeticao| - obs|$)/i)?.[1]?.trim() || trabalho.status,
        produtoId: line.match(/ - produtoId (.*?)(?: - urgente| - repetição| - repeticao| - obs|$)/i)?.[1]?.trim() || "",
        observacao: line.match(/ - obs (.*)$/i)?.[1]?.trim() || "",
        urgente: / - urgente(?: -|$)/i.test(line),
        repeticao: / - repetição(?: -|$)| - repeticao(?: -|$)/i.test(line),
      };
    })
    .filter(Boolean) as ItemAdicionado[];

  if (itens.length > 0) return itens;

  return [
    {
      id: `${trabalho.id}-principal`,
      servico: trabalho.tipoProtese,
      categoria: trabalho.escala || "",
      numeroDente: trabalho.dentes || "-",
      corDente: trabalho.cor || "-",
      quantidade: "1",
      valor: trabalho.valor || 0,
      desconto: "0,00",
      situacao: trabalho.status,
      urgente: false,
      repeticao: false,
    },
  ];
}

export default function OrdemServicoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const osNumeroParam = searchParams.get("os");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [lancamentosFinanceiros, setLancamentosFinanceiros] = useState<LancamentoFinanceiro[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [opcoesTerceirizados, setOpcoesTerceirizados] = useState<TerceirizadoOpcao[]>([]);
  const [tabelaPrecoAtual, setTabelaPrecoAtual] = useState("Tabela Principal");
  const [categoriasPorTabelaPreco, setCategoriasPorTabelaPreco] = useState<Record<string, CategoriaTabelaPreco[]>>({});
  const [materiais, setMateriais] = useState<string[]>([]);
  const [materiaisCarregados, setMateriaisCarregados] = useState(false);
  const [materiaisSelecionados, setMateriaisSelecionados] = useState<string[]>([]);
  const [materialQuantidades, setMaterialQuantidades] = useState<Record<string, number>>({});
  const [materialAberto, setMaterialAberto] = useState(false);
  const [buscaMaterial, setBuscaMaterial] = useState("");
  const [novoMaterial, setNovoMaterial] = useState("");
  const [modalMaterialAberto, setModalMaterialAberto] = useState(false);
  const [tipoDenticao, setTipoDenticao] = useState<TipoDenticao>("permanente");
  const [dentes, setDentes] = useState<string[]>([]);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [abaServico, setAbaServico] = useState<
    "etapas" | "produtos" | "colaboradores" | "terceirizados"
  >("etapas");
  const [modelosEtapas, setModelosEtapas] = useState<EtapaCadastro[]>([]);
  const [setoresCadastrados, setSetoresCadastrados] = useState<SetorCadastro[]>([]);
  const [colaboradoresOpcoes, setColaboradoresOpcoes] = useState<ColaboradorListagem[]>([]);
  const [etapas, setEtapas] = useState<EtapaOsForm[]>([]);
  const [calendarioEtapaAberto, setCalendarioEtapaAberto] = useState<number | null>(null);
  const [produtosOs, setProdutosOs] = useState<
    Array<{ produtoId: string; quantidade: string; valor: string; observacao: string }>
  >([]);
  const [colaboradores, setColaboradores] = useState<
    Array<{ nome: string; comissao: string; etapa: string }>
  >([]);
  const [terceirizados, setTerceirizados] = useState<
    Array<{ nome: string; servico: string; custo: string }>
  >([]);
  const [itensAdicionados, setItensAdicionados] = useState<ItemAdicionado[]>([]);
  const [itemSelecionadoId, setItemSelecionadoId] = useState<string | null>(null);
  const [grupoOsRegistros, setGrupoOsRegistros] = useState<
    Array<{
      id: string;
      segmentoFaturamento: SegmentoFaturamento;
      instrucoes?: string | null;
    }>
  >([]);
  const [salvando, setSalvando] = useState(false);
  const [metaGrupoOsEdicao, setMetaGrupoOsEdicao] = useState<{
    clienteId: string;
    pacienteId: string;
    numeroOs: number;
    grupoOsId: string;
    dataEntrada: string;
  } | null>(null);
  const [imprimirOsAposSalvar, setImprimirOsAposSalvar] = useState<{
    trabalho: TrabalhoImpressaoOs;
    multiplosSegmentos: boolean;
  } | null>(null);
  const [avisoAdicionarServico, setAvisoAdicionarServico] = useState("");
  const [form, setForm] = useState({
    numeroOs: "",
    clienteId: "",
    pacienteNome: "",
    casoUrgente: "",
    caixa: "",
    dentista: "",
    materialEnviado: "",
    produtoId: "",
    tipoProtese: "",
    categoria: "",
    quantidade: "1",
    valor: "R$ 0,00",
    descontoTipo: "percentual",
    desconto: "0,00",
    dataLancamento: new Date().toLocaleDateString("pt-BR"),
    dataLaboratorio: "",
    horaLaboratorio: "",
    dataDentista: "",
    horaDentista: "",
    escalaCor: "",
    situacao: "producao",
    urgente: false,
    repeticao: false,
    instrucoes: "",
    observacoes: "",
  });

  const paginaPronta = usePageReady(async () => {
    if (typeof window === "undefined") return;

    try {
      const parsed = readStorage<{
        tabela?: string;
        categoriasPorTabela?: Record<string, CategoriaTabelaPreco[]>;
      } | null>(TABELA_PRECOS_STORAGE_KEY, null);
      if (parsed) {
        if (parsed.tabela) setTabelaPrecoAtual(parsed.tabela);
        if (parsed.categoriasPorTabela) {
          setCategoriasPorTabelaPreco(parsed.categoriasPorTabela);
        } else {
          setCategoriasPorTabelaPreco({ "Tabela Principal": categoriasTabelaPrecoPadrao });
        }
      } else {
        setCategoriasPorTabelaPreco({ "Tabela Principal": categoriasTabelaPrecoPadrao });
      }
    } catch {
      setCategoriasPorTabelaPreco({ "Tabela Principal": categoriasTabelaPrecoPadrao });
    }

    try {
      const fornecedores = readStorage<TerceirizadoStorage[]>(FORNECEDORES_STORAGE_KEY, []);
      const prestadores = readStorage<TerceirizadoStorage[]>(PRESTADORES_STORAGE_KEY, []);
      const fornecedoresAtivos: TerceirizadoOpcao[] = Array.isArray(fornecedores)
        ? fornecedores
            .filter((fornecedor) => fornecedor?.nome)
            .map((fornecedor) => ({
              id: `fornecedor-${fornecedor.id || fornecedor.nome}`,
              nome: String(fornecedor.nome),
              origem: "fornecedor" as const,
            }))
        : [];
      const prestadoresAtivos: TerceirizadoOpcao[] = Array.isArray(prestadores)
        ? prestadores
            .filter((prestador) => prestador?.nome)
            .map((prestador) => ({
              id: `prestador-${prestador.id || prestador.nome}`,
              nome: String(prestador.nome),
              origem: "prestador" as const,
              valorComissao: String(prestador.valorComissao || "0,00%"),
              valorComissaoRepeticao: String(prestador.valorComissaoRepeticao || "0,00%"),
              tipoServico: String(prestador.tipoServico || ""),
            }))
        : [];
      setOpcoesTerceirizados([...prestadoresAtivos, ...fornecedoresAtivos]);
    } catch {
      setOpcoesTerceirizados([]);
    }

    try {
      const parsed = readStorage<string[] | null>(MATERIAIS_DENTISTA_STORAGE_KEY, null);
      const lista = Array.isArray(parsed) && parsed.length > 0 ? parsed : materiaisPadrao;
      setMateriais(lista);
    } catch {
      setMateriais(materiaisPadrao);
    }
    setMateriaisCarregados(true);

    try {
      const parsed = readStorage<EtapaCadastro[]>(ETAPAS_STORAGE_KEY, []);
      const setoresParsed = readStorage<SetorCadastro[]>(SETORES_STORAGE_KEY, []);
      setModelosEtapas(Array.isArray(parsed) ? parsed : []);
      setSetoresCadastrados(Array.isArray(setoresParsed) ? setoresParsed : []);
      setColaboradoresOpcoes(carregarColaboradoresListagem());
    } catch {
      setModelosEtapas([]);
      setSetoresCadastrados([]);
      setColaboradoresOpcoes(carregarColaboradoresListagem());
    }

    function aplicarExtrasEstoque(lista: Produto[]) {
      const extras = getProdutosEstoqueExtras();
      return lista.map((produto) => ({
        ...produto,
        ...extras[produto.id],
        estoque: Number(extras[produto.id]?.estoque ?? produto.estoque ?? 0),
        unidadeMedida: String(extras[produto.id]?.unidadeMedida ?? produto.unidadeMedida ?? "un (Unitário)"),
      }));
    }

    async function fetchJson(url: string, fallback: unknown) {
      try {
        const response = await fetch(url);
        if (!response.ok) return fallback;
        return await response.json();
      } catch {
        return fallback;
      }
    }

    const [clientesData, produtosData, nextOsData, financeiroData] = await Promise.all([
      fetchJson("/api/clientes", []),
      fetchJson("/api/produtos", []),
      fetchJson("/api/trabalhos/next-os", null),
      fetchJson("/api/financeiro?tipo=receita", null),
    ]);

    if (Array.isArray(clientesData)) setClientes(clientesData);
    if (Array.isArray(produtosData) && produtosData.length > 0) {
      setProdutos(aplicarExtrasEstoque(produtosData));
    }
    if (
      financeiroData &&
      typeof financeiroData === "object" &&
      "lancamentos" in financeiroData &&
      Array.isArray((financeiroData as { lancamentos: LancamentoFinanceiro[] }).lancamentos)
    ) {
      setLancamentosFinanceiros((financeiroData as { lancamentos: LancamentoFinanceiro[] }).lancamentos);
    }
    if (nextOsData && typeof nextOsData === "object" && "numeroOs" in nextOsData) {
      setForm((current) => ({ ...current, numeroOs: String(nextOsData.numeroOs) }));
    }
  });

  useEffect(() => {
    if (!paginaPronta || typeof window === "undefined") return;

    function carregarOpcoesTerceirizados() {
      try {
        const fornecedores = readStorage<TerceirizadoStorage[]>(FORNECEDORES_STORAGE_KEY, []);
        const prestadores = readStorage<TerceirizadoStorage[]>(PRESTADORES_STORAGE_KEY, []);

        const fornecedoresAtivos: TerceirizadoOpcao[] = Array.isArray(fornecedores)
          ? fornecedores
              .filter((fornecedor) => fornecedor?.nome)
              .map((fornecedor) => ({
                id: `fornecedor-${fornecedor.id || fornecedor.nome}`,
                nome: String(fornecedor.nome),
                origem: "fornecedor",
              }))
          : [];
        const prestadoresAtivos: TerceirizadoOpcao[] = Array.isArray(prestadores)
          ? prestadores
              .filter((prestador) => prestador?.nome)
              .map((prestador) => ({
                id: `prestador-${prestador.id || prestador.nome}`,
                nome: String(prestador.nome),
                origem: "prestador",
                valorComissao: String(prestador.valorComissao || "0,00%"),
                valorComissaoRepeticao: String(prestador.valorComissaoRepeticao || "0,00%"),
                tipoServico: String(prestador.tipoServico || ""),
              }))
          : [];

        setOpcoesTerceirizados([...prestadoresAtivos, ...fornecedoresAtivos]);
      } catch {
        setOpcoesTerceirizados([]);
      }
    }

    carregarOpcoesTerceirizados();
  }, [paginaPronta]);

  useEffect(() => {
    if (!paginaPronta || typeof window === "undefined") return;

    function carregarMateriaisDentista() {
      try {
        const parsed = readStorage<string[] | null>(MATERIAIS_DENTISTA_STORAGE_KEY, null);
        const lista = Array.isArray(parsed) && parsed.length > 0 ? parsed : materiaisPadrao;
        setMateriais(lista);
        setMateriaisSelecionados((selecionados) => {
          const atualizados = selecionados.filter((material) => lista.includes(material));
          if (atualizados.length !== selecionados.length) {
            const quantidades = Object.fromEntries(
              Object.entries(materialQuantidades).filter(([material]) => lista.includes(material))
            ) as Record<string, number>;
            setMaterialQuantidades(quantidades);
            updateMaterialEnviado(atualizados, quantidades);
          }
          return atualizados;
        });
      } catch {
        setMateriais(materiaisPadrao);
      } finally {
        setMateriaisCarregados(true);
      }
    }

    carregarMateriaisDentista();
  }, [paginaPronta]);

  useEffect(() => {
    if (!paginaPronta || typeof window === "undefined") return;

    function sincronizarTabelaPrecos() {
      const salvo = carregarCategoriasPorTabelaPreco();
      if (Object.keys(salvo).length > 0) {
        setCategoriasPorTabelaPreco((atual) => ({ ...atual, ...salvo }));
      }
      try {
        const parsed = readStorage<{ tabela?: string } | null>(TABELA_PRECOS_STORAGE_KEY, null);
        if (parsed?.tabela) setTabelaPrecoAtual(parsed.tabela);
      } catch {
        // ignora JSON inválido
      }
    }

    sincronizarTabelaPrecos();
    window.addEventListener("storage", sincronizarTabelaPrecos);
    return () => {
      window.removeEventListener("storage", sincronizarTabelaPrecos);
    };
  }, [paginaPronta]);

  useEffect(() => {
    if (!paginaPronta || typeof window === "undefined") return;

    function carregarModelosEtapasESetores() {
      try {
        setModelosEtapas(carregarEtapasCadastro());
        setSetoresCadastrados(carregarSetoresCadastro());
        setColaboradoresOpcoes(carregarColaboradoresListagem());
      } catch {
        setModelosEtapas([]);
        setSetoresCadastrados([]);
        setColaboradoresOpcoes(carregarColaboradoresListagem());
      }
    }

    carregarModelosEtapasESetores();
    window.addEventListener("storage", carregarModelosEtapasESetores);
    return () => {
      window.removeEventListener("storage", carregarModelosEtapasESetores);
    };
  }, [paginaPronta]);

  useEffect(() => {
    if (!editId || modelosEtapas.length === 0) return;
    setEtapas((prev) =>
      prev.map((etapa) => ({
        ...etapa,
        setor: etapa.setor || modeloEtapa(etapa.nome)?.setor || "",
      }))
    );
  }, [editId, modelosEtapas]);

  useEffect(() => {
    if (!materiaisCarregados || typeof window === "undefined") return;
    writeStorage(MATERIAIS_DENTISTA_STORAGE_KEY, materiais);
  }, [materiais, materiaisCarregados]);

  useEffect(() => {
    if (!paginaPronta) return;

    function aplicarExtrasEstoque(lista: Produto[]) {
      const extras = getProdutosEstoqueExtras();
      return lista.map((produto) => ({
        ...produto,
        ...extras[produto.id],
        estoque: Number(extras[produto.id]?.estoque ?? produto.estoque ?? 0),
        unidadeMedida: String(extras[produto.id]?.unidadeMedida ?? produto.unidadeMedida ?? "un (Unitário)"),
      }));
    }

    function recarregarEstoqueProdutos() {
      setProdutos((atuais) => aplicarExtrasEstoque(atuais));
    }

    window.addEventListener(PRODUTOS_ESTOQUE_EVENT, recarregarEstoqueProdutos);
    return () => {
      window.removeEventListener(PRODUTOS_ESTOQUE_EVENT, recarregarEstoqueProdutos);
    };
  }, [paginaPronta]);

  useEffect(() => {
    if (!editId) return;
    let mounted = true;

    async function carregarEdicao() {
      const res = await fetch(`/api/trabalhos/${editId}`);
      if (!res.ok) return;
      const payload = (await res.json()) as TrabalhoEdicao;
      if (!mounted) return;

      const grupo =
        Array.isArray(payload.grupo) && payload.grupo.length > 0 ? payload.grupo : [payload];
      const trabalho =
        grupo.find((item) => item.id === editId) ||
        grupo.find((item) => (item.segmentoFaturamento || "servico") === "servico") ||
        grupo[0];
      if (!trabalho) return;

      setGrupoOsRegistros(
        grupo.map((item) => ({
          id: item.id,
          segmentoFaturamento: (item.segmentoFaturamento || "servico") as SegmentoFaturamento,
          instrucoes: item.instrucoes,
          tipoProtese: item.tipoProtese,
        }))
      );

      const dentesTexto = trabalho.dentes || "";
      const itensCarregados = grupo.flatMap((item) => itensFromTrabalho(item));
      const primeiroItem = itensCarregados[0];
      const instrucoesGrupo = grupo
        .map((item) => item.instrucoes || "")
        .find((texto) => texto.trim().length > 0) || trabalho.instrucoes || "";
      const linhasInstrucoes = instrucoesGrupo.split("\n");
      const valorLinha = (prefixo: string) =>
        linhasInstrucoes
          .find((line) => line.startsWith(prefixo))
          ?.replace(prefixo, "")
          .trim() || "";
      const dentesBase = primeiroItem?.numeroDente || dentesTexto;
      const dentesExplicitos = dentesBase
        .split(",")
        .map((dente) => dente.trim())
        .filter((dente) => /^\d+$/.test(dente));
      const denticaoCarregada = tipoDenticaoFromDentes(dentesExplicitos);
      const dentesCarregados = dentesFromResumo(dentesBase, denticaoCarregada);

      const descontoCliente = clienteConfigFromObservacoes(trabalho.cliente?.observacoes).descontoGeral;
      const descontoItem = primeiroItem?.desconto || "0,00";
      const descontoEdicao =
        descontoItem.replace(/[^\d]/g, "") === "000" || descontoItem.replace(/[^\d]/g, "") === ""
          ? descontoCliente || descontoItem
          : descontoItem;

      setTipoDenticao(denticaoCarregada);
      setDentes(Array.from(new Set(dentesCarregados)));
      setItensAdicionados(itensCarregados);
      setItemSelecionadoId(null);
      setProdutosOs([]);

      const complementos = parseComplementosInstrucoesGrupo(
        grupo.map((item) => item.instrucoes || "")
      );
      setEtapas(
        complementos.etapas.map((etapa) =>
          sincronizarComissaoEtapa({
            nome: etapa.nome,
            setor: "",
            responsavel: etapa.responsavel,
            prazo: etapa.prazo,
            observacao: etapa.observacao,
          })
        )
      );
      setColaboradores(
        complementos.colaboradores.map((item) => ({
          nome: item.nome,
          comissao: exibirComissaoPercentual(item.comissao),
          etapa: item.etapa,
        }))
      );
      setTerceirizados(
        complementos.terceirizados.map((item) => ({
          nome: item.nome,
          servico: item.servico,
          custo: item.custo,
        }))
      );

      setMetaGrupoOsEdicao({
        clienteId: trabalho.clienteId,
        pacienteId: trabalho.pacienteId || "",
        numeroOs: trabalho.numeroOs,
        grupoOsId: trabalho.grupoOsId || trabalho.id,
        dataEntrada: trabalho.dataEntrada,
      });

      setForm((current) => ({
        ...current,
        numeroOs: String(trabalho.numeroOs),
        clienteId: trabalho.clienteId,
        pacienteNome: trabalho.paciente?.nome || "",
        caixa: valorLinha("Caixa:"),
        dentista: valorLinha("Dentista:") || valorLinha("Dentista convidado:"),
        tipoProtese: "",
        categoria: "",
        quantidade: "1",
        valor: "R$ 0,00",
        descontoTipo: "percentual",
        desconto: descontoEdicao,
        dataLancamento: new Date(trabalho.dataEntrada).toLocaleDateString("pt-BR"),
        dataLaboratorio: trabalho.dataPrevista ? new Date(trabalho.dataPrevista).toLocaleDateString("pt-BR") : "",
        dataDentista: trabalho.dataPrevista ? new Date(trabalho.dataPrevista).toLocaleDateString("pt-BR") : "",
        escalaCor: trabalho.cor || "",
        materialEnviado: trabalho.material || "",
        situacao: trabalho.status,
        urgente: Boolean(primeiroItem?.urgente),
        repeticao: Boolean(primeiroItem?.repeticao),
        observacoes: trabalho.observacoes || "",
        instrucoes: complementos.textoLivre,
      }));
    }

    carregarEdicao();
    return () => {
      setGrupoOsRegistros([]);
      setMetaGrupoOsEdicao(null);
      mounted = false;
    };
  }, [editId]);

  useEffect(() => {
    if (editId || !osNumeroParam) return;
    const numero = Number(osNumeroParam);
    if (!Number.isFinite(numero)) return;

    void (async () => {
      try {
        const lista = await fetch("/api/trabalhos").then((r) => r.json());
        if (!Array.isArray(lista)) return;
        const trabalho = lista.find(
          (t: { numeroOs?: number }) => Number(t.numeroOs) === numero
        );
        if (trabalho?.id) {
          router.replace(`/app/producao/os?edit=${trabalho.id}`);
        }
      } catch {
        // ignora
      }
    })();
  }, [editId, osNumeroParam, router]);

  function parseCurrency(value: string) {
    return Number(value.replace(/\D/g, "")) / 100;
  }

  function clienteConfigFromObservacoes(observacoes?: string | null) {
    const texto = observacoes || "";
    const value = (prefix: string) =>
      texto
        .split("\n")
        .find((line) => line.startsWith(prefix))
        ?.replace(prefix, "")
        .trim() || "";

    return {
      tabelaPreco: value("Tabela de Preço:"),
      descontoGeral: value("Desconto Geral:"),
      limiteSaldoDevedor: value("Limite Saldo Devedor:"),
    };
  }

  function clienteConfig(clienteId: string) {
    const cliente = clientes.find((item) => item.id === clienteId);
    return clienteConfigFromObservacoes(cliente?.observacoes || "");
  }

  const tabelaPrecoSelecionada = useMemo(() => {
    const tabelaDoCliente = form.clienteId ? clienteConfig(form.clienteId).tabelaPreco : "";
    if (tabelaDoCliente && categoriasPorTabelaPreco[tabelaDoCliente]) return tabelaDoCliente;
    if (tabelaPrecoAtual && categoriasPorTabelaPreco[tabelaPrecoAtual]) return tabelaPrecoAtual;
    return Object.keys(categoriasPorTabelaPreco)[0] || "Tabela Principal";
  }, [clientes, form.clienteId, categoriasPorTabelaPreco, tabelaPrecoAtual]);

  const categoriasTabelaCompleta = categoriasPorTabelaPreco[tabelaPrecoSelecionada] || [];
  const categoriasTabelaPreco = categoriasSelecionaveisNaOs(categoriasTabelaCompleta);
  const servicosDaCategoria = servicosSelecionaveisNaOs(
    servicosDaCategoriaTabela(categoriasTabelaPreco, form.categoria)
  );
  const produtosTabelaPrecoOs = useMemo(
    () => produtosOpcoesNaOs(categoriasTabelaCompleta),
    [categoriasTabelaCompleta]
  );
  const exibeAbaProdutos = produtosTabelaPrecoOs.length > 0;

  const servicoOsAtual = useMemo(() => {
    const nome = form.tipoProtese.trim();
    if (!nome || /^Transporte:/i.test(nome) || /^Produto:/i.test(nome)) return undefined;
    return buscarServicoNaTabela(categoriasTabelaPreco, nome);
  }, [form.tipoProtese, categoriasTabelaPreco]);

  const modelosEtapasOs = useMemo(() => {
    if (!servicoOsAtual) return [];
    return modelosEtapasParaOsServico(servicoOsAtual, modelosEtapas);
  }, [servicoOsAtual, modelosEtapas]);

  const exibeAbaColaboradores = servicoTemComissoesColaboradoresNaTabela(servicoOsAtual);
  const exibeAbaTerceirizados = servicoTemComissoesTerceirizadosNaTabela(servicoOsAtual);
  const colaboradoresComissaoServico = useMemo(
    () => comissoesColaboradoresDoServico(servicoOsAtual),
    [servicoOsAtual]
  );
  const terceirizadosComissaoServico = useMemo(
    () => comissoesTerceirizadosDoServico(servicoOsAtual),
    [servicoOsAtual]
  );

  function valorBaseComissaoTerceirizadoOs() {
    if (servicoOsAtual) {
      return servicoOsAtual.valor * Number(form.quantidade || 1);
    }
    return parseCurrency(form.valor) * Number(form.quantidade || 1);
  }

  function aplicarComissoesServicoNaOs(servico: ServicoTabelaPrecoOs) {
    if (servicoTemComissoesColaboradoresNaTabela(servico)) {
      setColaboradores(colaboradoresIniciaisFormParaOsServico(servico, form.repeticao));
    } else {
      setColaboradores([]);
    }

    if (servicoTemComissoesTerceirizadosNaTabela(servico)) {
      setTerceirizados(
        terceirizadosIniciaisFormParaOsServico(
          servico,
          servico.valor * Number(form.quantidade || 1),
          form.repeticao
        )
      );
    } else {
      setTerceirizados([]);
    }
  }

  useEffect(() => {
    if (abaServico === "produtos" && !exibeAbaProdutos) setAbaServico("etapas");
    if (abaServico === "colaboradores" && !exibeAbaColaboradores) setAbaServico("etapas");
    if (abaServico === "terceirizados" && !exibeAbaTerceirizados) setAbaServico("etapas");
  }, [abaServico, exibeAbaProdutos, exibeAbaColaboradores, exibeAbaTerceirizados]);

  useEffect(() => {
    if (!servicoOsAtual || !servicoTemComissoesColaboradoresNaTabela(servicoOsAtual)) return;
    setColaboradores((atuais) => {
      if (atuais.length === 0) return atuais;
      let mudou = false;
      const proximos = atuais.map((item) => {
        const comissao = comissaoColaboradorNaTabelaServico(
          servicoOsAtual,
          item.nome,
          form.repeticao
        );
        if (!comissao || item.comissao === comissao) return item;
        mudou = true;
        return { ...item, comissao };
      });
      return mudou ? proximos : atuais;
    });
  }, [form.repeticao, servicoOsAtual]);

  useEffect(() => {
    if (!servicoOsAtual || !servicoTemComissoesTerceirizadosNaTabela(servicoOsAtual)) return;
    setTerceirizados((atuais) => {
      if (atuais.length === 0) return atuais;
      const base = valorBaseComissaoTerceirizadoOs();
      let mudou = false;
      const proximos = atuais.map((item) => {
        const linha = terceirizadosComissaoServico.find(
          (terceiro) => terceiro.nome.trim() === item.nome.trim()
        );
        if (!linha) return item;
        const percentual = parseMoney(
          form.repeticao ? linha.valorRepeticao || "0" : linha.valor || "0"
        );
        const custo = (base * percentual) / 100;
        const custoFmt = custo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        if (item.custo === custoFmt) return item;
        mudou = true;
        return { ...item, custo: custoFmt };
      });
      return mudou ? proximos : atuais;
    });
  }, [form.repeticao, form.quantidade, form.valor, servicoOsAtual, terceirizadosComissaoServico]);

  useEffect(() => {
    if (!form.categoria) return;
    const categoriaValida = categoriasTabelaPreco.some(
      (categoria) => categoria.nome === form.categoria || categoria.id === form.categoria
    );
    if (!categoriaValida) {
      setForm((atual) => ({
        ...atual,
        categoria: "",
        tipoProtese: "",
        valor: "R$ 0,00",
        dataLaboratorio: "",
        dataDentista: "",
      }));
    }
  }, [categoriasTabelaPreco, tabelaPrecoSelecionada, form.categoria]);

  function categoriaDoServico(nomeServico: string) {
    const naTabelaAtual = categoriaDoServicoNaTabela(categoriasTabelaPreco, nomeServico);
    if (naTabelaAtual) return naTabelaAtual;

    return categoriaDoServicoNaTabela(Object.values(categoriasPorTabelaPreco).flat(), nomeServico);
  }

  function saldoDevedorCliente(clienteId: string) {
    return lancamentosFinanceiros
      .filter((lancamento) => lancamento.tipo === "receita" && lancamento.status !== "pago" && lancamento.cliente?.id === clienteId)
      .reduce((sum, lancamento) => sum + lancamento.valor, 0);
  }

  function aplicarConfiguracaoCliente(clienteId: string) {
    const config = clienteConfig(clienteId);
    setForm((current) => ({
      ...current,
      clienteId,
      descontoTipo: "percentual",
      desconto: config.descontoGeral || "0,00",
    }));
  }

  function formatCurrencyInput(value: string) {
    return parseCurrency(value).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function prazosDoServicoSelecionado(tipoProtese: string, dataLancamento: string) {
    const servico = buscarServicoNaTabela(categoriasTabelaPreco, tipoProtese);
    const basePrazo = parseBrDate(dataLancamento) || new Date();
    return servico ? calcularDatasPrazoServico(servico, basePrazo) : { dataLaboratorio: "", dataDentista: "" };
  }

  /** Valor do select Serviço (opções usam só o nome; transporte grava com prefixo). */
  function valorSelectServico() {
    const texto = form.tipoProtese.trim();
    if (/^(transporte|frete)\s*:/i.test(texto)) {
      return texto.replace(/^(transporte|frete)\s*:/i, "").trim();
    }
    return texto;
  }

  function selecionarCategoriaServico(categoriaNome: string) {
    setForm((current) => ({
      ...current,
      categoria: categoriaNome,
      tipoProtese: "",
      valor: "R$ 0,00",
      dataLaboratorio: "",
      dataDentista: "",
    }));
    setEtapas([]);
    setColaboradores([]);
    setTerceirizados([]);
    setAvisoAdicionarServico("");
  }

  function selecionarServicoTabela(servicoRef: string) {
    if (!servicoRef) {
      setForm((current) => ({
        ...current,
        tipoProtese: "",
        valor: "R$ 0,00",
        dataLaboratorio: "",
        dataDentista: "",
      }));
      setEtapas([]);
      setColaboradores([]);
      setTerceirizados([]);
      return;
    }

    const servico = buscarServicoNaTabela(categoriasTabelaPreco, servicoRef);
    if (!servico) return;

    const tipo = servico.tipo || "servico";
    const valorFmt =
      servico.valor !== undefined
        ? servico.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
        : "R$ 0,00";

    if (tipo === "transporte") {
      setProdutosOs([]);
      setEtapas([]);
      setColaboradores([]);
      setTerceirizados([]);
      setForm((current) => ({
        ...current,
        tipoProtese: `Transporte: ${servico.nome}`,
        valor: valorFmt,
        quantidade: "1",
        dataLaboratorio: "",
        dataDentista: "",
      }));
      setAvisoAdicionarServico("");
      return;
    }

    const prazos = prazosDoServicoSelecionado(servico.nome, form.dataLancamento);
    setProdutosOs([]);
    setForm((current) => ({
      ...current,
      tipoProtese: servico.nome,
      valor: valorFmt,
      dataLaboratorio: prazos.dataLaboratorio,
      dataDentista: prazos.dataDentista,
    }));
    if (servicoTemEtapasNaTabela(servico)) {
      setEtapas(
        etapasIniciaisFormParaOsServico(
          servico,
          modelosEtapas,
          form.dataLancamento,
          form.horaLaboratorio
        ).map((etapa) => sincronizarComissaoEtapa(etapa))
      );
      setAbaServico("etapas");
    } else {
      setEtapas([]);
    }
    setAvisoAdicionarServico("");
  }

  function formatPercentInput(value: string) {
    const amount = Number(value.replace(/\D/g, "")) / 100;
    return amount.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function brDateToIso(value: string) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const [day, month, year] = value.split("/");
    if (!day || !month || !year) return "";
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  function isoDateToBr(value: string) {
    const [year, month, day] = value.split("-");
    if (!day || !month || !year) return "";
    return `${day}/${month}/${year}`;
  }

  function atualizarCampoData(campo: CampoData, valorData: string) {
    setForm((current) => {
      const next = { ...current, [campo]: valorData };
      if (campo === "dataLancamento" && current.tipoProtese) {
        const prazos = prazosDoServicoSelecionado(current.tipoProtese, valorData);
        return { ...next, dataLaboratorio: prazos.dataLaboratorio, dataDentista: prazos.dataDentista };
      }
      return next;
    });
  }

  function dateField(label: string, campo: CampoData) {
    return (
      <CampoDataBr
        label={label}
        value={form[campo]}
        onChange={(valorData) => atualizarCampoData(campo, valorData)}
      />
    );
  }

  function formatMateriaisSelecionados(
    selecionados: string[],
    quantidades = materialQuantidades
  ) {
    return selecionados
      .map((material) => `${material} (${quantidades[material] || 1})`)
      .join(", ");
  }

  function updateMaterialEnviado(
    selecionados: string[],
    quantidades = materialQuantidades
  ) {
    setForm((current) => ({
      ...current,
      materialEnviado: formatMateriaisSelecionados(selecionados, quantidades),
    }));
  }

  function toggleMaterial(material: string) {
    const selecionados = materiaisSelecionados.includes(material)
      ? materiaisSelecionados.filter((item) => item !== material)
      : [...materiaisSelecionados, material];

    const quantidades = { ...materialQuantidades };
    if (selecionados.includes(material)) quantidades[material] = quantidades[material] || 1;
    else delete quantidades[material];

    setMaterialQuantidades(quantidades);
    setMateriaisSelecionados(selecionados);
    updateMaterialEnviado(selecionados, quantidades);
  }

  function alterarQuantidadeMaterial(material: string, delta: number) {
    if (!materiaisSelecionados.includes(material)) return;
    const quantidades = {
      ...materialQuantidades,
      [material]: Math.max((materialQuantidades[material] || 1) + delta, 1),
    };
    setMaterialQuantidades(quantidades);
    updateMaterialEnviado(materiaisSelecionados, quantidades);
  }

  function adicionarMaterial() {
    const material = (novoMaterial || buscaMaterial).trim();
    if (!material) return;
    setMateriais((atuais) => {
      if (atuais.some((item) => item.toLowerCase() === material.toLowerCase())) return atuais;
      const atualizados = [...atuais, material];
      return atualizados;
    });
    setNovoMaterial("");
    setBuscaMaterial("");
    setModalMaterialAberto(false);
    if (!materiaisSelecionados.includes(material)) toggleMaterial(material);
  }

  const materiaisFiltrados = materiais.filter((material) =>
    material.toLowerCase().includes(buscaMaterial.toLowerCase())
  );

  function valorComDesconto(valor: number, descontoTipo?: string, desconto?: string) {
    const descontoTexto = desconto || "0,00";
    const descontoValor =
      descontoTipo === "valor" || descontoTexto.trim().startsWith("R$")
        ? parseCurrency(descontoTexto)
        : valor * (Math.min(Math.max(Number(descontoTexto.replace(",", ".") || 0), 0), 100) / 100);

    return Math.max(valor - descontoValor, 0);
  }

  function parsePercentual(value = "") {
    return Number(value.replace("%", "").replace(/\./g, "").replace(",", ".")) || 0;
  }

  function itensParaCalculo() {
    if (!itemSelecionadoId) return itensAdicionados;
    const novosItens = itensDoFormulario();
    const indexSelecionado = itensAdicionados.findIndex((item) => item.id === itemSelecionadoId);
    if (indexSelecionado < 0) return itensAdicionados;
    return [
      ...itensAdicionados.slice(0, indexSelecionado),
      ...novosItens,
      ...itensAdicionados.slice(indexSelecionado + 1),
    ];
  }

  const total = useMemo(() => {
    const itensCalculados = itensParaCalculo();
    const subtotalItens = itensCalculados.reduce((sum, item) => {
      const linha = valorComDesconto(item.valor, item.descontoTipo, item.desconto);
      return sum + (Number.isFinite(linha) ? linha : 0);
    }, 0);
    const subtotalProdutos = produtosOs.reduce((sum, produto) => {
      return sum + parseCurrency(produto.valor) * Number(produto.quantidade || 1);
    }, 0);
    const subtotalServico = parseCurrency(form.valor) * Number(form.quantidade || 1);
    const subtotal = subtotalItens || subtotalServico + subtotalProdutos;
    const desconto =
      form.descontoTipo === "valor"
        ? parseCurrency(form.desconto)
        : subtotal * (Math.min(Math.max(Number(form.desconto.replace(",", ".") || 0), 0), 100) / 100);
    return subtotalItens ? subtotal : Math.max(subtotal - desconto, 0);
  }, [form.valor, form.quantidade, form.descontoTipo, form.desconto, form.tipoProtese, form.escalaCor, form.situacao, produtosOs, itensAdicionados, itemSelecionadoId, dentes]);

  function valorComissaoTerceirizado(opcao: TerceirizadoOpcao) {
    const percentual = parsePercentual(
      form.repeticao ? opcao.valorComissaoRepeticao : opcao.valorComissao
    );
    return total * (percentual / 100);
  }

  function selecionarTerceirizado(index: number, nome: string) {
    const linhaTabela = terceirizadosComissaoServico.find(
      (item) => item.nome.trim() === nome.trim()
    );
    if (linhaTabela && servicoOsAtual) {
      const percentual = parseMoney(
        form.repeticao ? linhaTabela.valorRepeticao || "0" : linhaTabela.valor || "0"
      );
      const custoNum = (valorBaseComissaoTerceirizadoOs() * percentual) / 100;
      setTerceirizados((atuais) =>
        atuais.map((item, i) =>
          i === index
            ? {
                ...item,
                nome,
                servico: servicoOsAtual.nome,
                custo: custoNum.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }),
              }
            : item
        )
      );
      return;
    }

    const opcao = opcoesTerceirizados.find((item) => item.nome === nome);
    setTerceirizados((atuais) =>
      atuais.map((item, i) =>
        i === index
          ? {
              ...item,
              nome,
              servico: opcao?.tipoServico || item.servico,
              custo:
                opcao?.origem === "prestador"
                  ? valorComissaoTerceirizado(opcao).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })
                  : item.custo,
            }
          : item
      )
    );
  }

  useEffect(() => {
    setTerceirizados((atuais) => {
      let changed = false;
      const atualizados = atuais.map((item) => {
        const opcao = opcoesTerceirizados.find(
          (terceirizado) => terceirizado.nome === item.nome && terceirizado.origem === "prestador"
        );
        if (!opcao) return item;

        const custo = valorComissaoTerceirizado(opcao).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });
        if (item.custo === custo) return item;
        changed = true;
        return { ...item, custo };
      });

      return changed ? atualizados : atuais;
    });
  }, [total, form.repeticao, opcoesTerceirizados]);

  const previews = useMemo(
    () =>
      arquivos.map((arquivo) => ({
        file: arquivo,
        url: URL.createObjectURL(arquivo),
        isImage: arquivo.type.startsWith("image/"),
        isVideo: arquivo.type.startsWith("video/"),
      })),
    [arquivos]
  );

  useEffect(() => {
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [previews]);

  function toggleDente(dente: string) {
    setDentes((current) =>
      current.includes(dente)
        ? current.filter((item) => item !== dente)
        : [...current, dente]
    );
  }

  function dentesPorDenticao(tipo: TipoDenticao = tipoDenticao) {
    return tipo === "deciduos"
      ? { superiores: dentesDeciduosSuperiores, inferiores: dentesDeciduosInferiores }
      : { superiores: dentesSuperiores, inferiores: dentesInferiores };
  }

  function tipoDenticaoFromDentes(valores: string[]) {
    return tipoDenticaoFromNumerosDentes(valores);
  }

  function trocarTipoDenticao(tipo: TipoDenticao) {
    setTipoDenticao(tipo);
    setDentes([]);
  }

  function selecionarArcada(arcada: "sup" | "inf") {
    const { superiores, inferiores } = dentesPorDenticao();
    const linha = arcada === "sup" ? superiores : inferiores;
    setDentes((current) => {
      const todosSelecionados = linha.every((dente) => current.includes(dente));
      if (todosSelecionados) return current.filter((dente) => !linha.includes(dente));
      return Array.from(new Set([...current, ...linha]));
    });
  }

  function dentesFromResumo(resumo: string, tipo: TipoDenticao = tipoDenticao) {
    const { superiores, inferiores } = dentesPorDenticao(tipo);
    const partes = resumo.split(",").map((parte) => parte.trim()).filter(Boolean);
    return Array.from(
      new Set(
        partes.flatMap((parte) => {
          if (parte === "SUP") return superiores;
          if (parte === "INF") return inferiores;
          return /^\d+$/.test(parte) ? [parte] : [];
        })
      )
    );
  }

  function numeroDenteServico() {
    const { superiores, inferiores } = dentesPorDenticao();
    const todosSuperiores = superiores.every((dente) => dentes.includes(dente));
    const todosInferiores = inferiores.every((dente) => dentes.includes(dente));
    const superioresExtras = dentes.filter((dente) => !superiores.includes(dente));
    const inferioresExtras = dentes.filter((dente) => !inferiores.includes(dente));
    const partes = [
      todosSuperiores ? "SUP" : "",
      todosInferiores ? "INF" : "",
      ...(!todosSuperiores ? dentes.filter((dente) => superiores.includes(dente)) : []),
      ...(!todosInferiores ? dentes.filter((dente) => inferiores.includes(dente)) : []),
    ].filter(Boolean);

    if (todosSuperiores && todosInferiores) return "SUP, INF";
    if (todosSuperiores && superioresExtras.length === inferiores.length) return "SUP, INF";
    if (todosInferiores && inferioresExtras.length === superiores.length) return "SUP, INF";
    return partes.length ? partes.join(", ") : "-";
  }

  function quantidadeDentesSelecionados() {
    return dentes.length || 1;
  }

  function modeloEtapa(nome: string) {
    return modelosEtapas.find((etapa) => etapa.nome === nome);
  }

  function setorDaEtapa(nome: string) {
    const modelo = modeloEtapa(nome);
    if (!modelo?.setor) return null;
    const setor = setoresCadastrados.find((item) => item.nome === modelo.setor);
    return { nome: modelo.setor, cor: setor?.cor || "#ef4444" };
  }

  function prazoCalculadoEtapa(nome: string) {
    const modelo = modeloEtapa(nome);
    if (!modelo?.prazoDias?.trim()) return "";
    return prazoVencimentoEtapaOs(form.dataLancamento, modelo.prazoDias);
  }

  function selecionarEtapaOs(index: number, nomeEtapa: string) {
    if (nomeEtapa) {
      const duplicata = etapas.findIndex((item, i) => i !== index && item.nome === nomeEtapa);
      if (duplicata >= 0) {
        setEtapas((atuais) => atuais.filter((_, i) => i !== index));
        return;
      }
    }
    const modelo = modeloEtapa(nomeEtapa);
    const prazoAuto = nomeEtapa ? prazoCalculadoEtapa(nomeEtapa) : "";
    setEtapas((atuais) =>
      atuais.map((item, i) => {
        if (i !== index) return item;
        const proxima: EtapaOsForm = {
          ...item,
          nome: nomeEtapa,
          setor: modelo?.setor || item.setor || "",
          prazo: prazoAuto || (nomeEtapa ? item.prazo : ""),
        };
        return item.responsavel.trim() ? sincronizarComissaoEtapa(proxima) : proxima;
      })
    );
  }

  useEffect(() => {
    if (modelosEtapas.length === 0) return;
    setEtapas((atuais) => {
      if (atuais.length === 0) return atuais;
      let mudou = false;
      const proximas = atuais.map((etapa, index) => {
        if (!etapa.nome.trim()) return etapa;
        const isEntrada = index === 0 || /^entrada$/i.test(nomeEtapaSemSetor(etapa.nome));
        if (isEntrada && form.dataLancamento.trim()) {
          const hora = form.horaLaboratorio.trim();
          const prazoAuto = hora
            ? `${form.dataLancamento.trim()} ${hora}`
            : form.dataLancamento.trim();
          if (etapa.prazo === prazoAuto) return etapa;
          mudou = true;
          return { ...etapa, prazo: prazoAuto };
        }
        const prazoAuto = prazoCalculadoEtapa(etapa.nome);
        if (!prazoAuto || etapa.prazo === prazoAuto) return etapa;
        mudou = true;
        return { ...etapa, prazo: prazoAuto };
      });
      return mudou ? proximas : atuais;
    });
  }, [form.dataLancamento, form.horaLaboratorio, modelosEtapas]);


  function tempoCalculadoEtapa(nome: string) {
    const modelo = modeloEtapa(nome);
    const tempoMedio = Number(modelo?.tempoMedio || 0);
    if (!tempoMedio) return "";

    const porElemento = modelo?.calculoPorElemento?.toLowerCase() === "sim";
    const tempo = porElemento ? tempoMedio * quantidadeDentesSelecionados() : tempoMedio;
    return `${tempo} min`;
  }

  function partesPrazoEtapaOs(prazo: string) {
    const partes = prazo.trim().split(/\s+/).filter(Boolean);
    const data =
      partes.find((parte) => /^\d{2}\/\d{2}\/\d{4}$/.test(parte)) ||
      (partes[0] && /^\d{2}\/\d{2}\/\d{4}$/.test(partes[0]) ? partes[0] : "");
    const horaBruta = partes.find((parte) => /^\d{1,2}:\d{2}$/.test(parte));
    return { data, hora: horaBruta || "00:00" };
  }

  function atualizarPrazoEtapaOs(index: number, data: string, hora: string) {
    const prazo = montarPrazoEtapaOs(data, hora || "00:00");
    setEtapas((atuais) =>
      atuais.map((item, i) => (i === index ? { ...item, prazo } : item))
    );
  }

  function percentualComissaoEtapaOs(
    servico: ServicoTabelaPrecoOs | undefined,
    nomeResponsavel: string
  ) {
    if (!nomeResponsavel.trim()) return 0;
    const linhaServico = servico?.comissoesColaboradores?.find(
      (item) => item.nome.trim() === nomeResponsavel.trim()
    );
    if (linhaServico) {
      const bruto = form.repeticao ? linhaServico.valorRepeticao : linhaServico.valor;
      return parseMoney(bruto || "0");
    }
    const cadastro = colaboradoresOpcoes.find((item) => item.nome === nomeResponsavel);
    if (!cadastro) return 0;
    return parseMoney(comissaoColaboradorCadastro(cadastro));
  }

  function formatComissaoReaisInput(value: string) {
    const centavos = Number(String(value).replace(/\D/g, "")) || 0;
    const amount = centavos / 100;
    return amount.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function valorBaseComissaoEtapaOs(
    etapa: Pick<EtapaOsForm, "nome">,
    servico = servicoOsAtual
  ) {
    return valorMonetarioEtapaServico(servico, etapa.nome);
  }

  function valoresComissaoPadraoEtapa(
    etapa: Pick<EtapaOsForm, "nome" | "responsavel">,
    servico = servicoOsAtual
  ) {
    const pctNumero = percentualComissaoEtapaOs(servico, etapa.responsavel);
    const base = valorBaseComissaoEtapaOs(etapa, servico);
    const reaisNum = (base * pctNumero) / 100;
    return {
      comissaoReais: formatComissaoReaisInput(String(Math.round(reaisNum * 100))),
    };
  }

  function sincronizarComissaoEtapa(etapa: EtapaOsForm, servico = servicoOsAtual): EtapaOsForm {
    const padrao = valoresComissaoPadraoEtapa(etapa, servico);
    return {
      ...etapa,
      comissaoReais: padrao.comissaoReais,
    };
  }

  function atualizarComissaoReaisEtapa(index: number, valorDigitado: string) {
    const comissaoReais = formatComissaoReaisInput(valorDigitado);
    setEtapas((atuais) =>
      atuais.map((item, i) => (i === index ? { ...item, comissaoReais } : item))
    );
  }

  useEffect(() => {
    setEtapas((atuais) => {
      if (atuais.length === 0) return atuais;
      let mudou = false;
      const proximas = atuais.map((etapa) => {
        if (!etapa.responsavel.trim() || !etapa.nome.trim()) return etapa;
        const padrao = valoresComissaoPadraoEtapa(etapa);
        if (etapa.comissaoReais === padrao.comissaoReais) return etapa;
        mudou = true;
        return { ...etapa, comissaoReais: padrao.comissaoReais };
      });
      return mudou ? proximas : atuais;
    });
  }, [form.repeticao, servicoOsAtual]);

  function rotuloSetorEtapa(etapa: { nome: string; setor: string }) {
    return etapa.setor.trim() || setorDaEtapa(etapa.nome)?.nome || "Setor não informado";
  }

  function dentesSelecionadosResumo() {
    const resumo = numeroDenteServico();
    return resumo === "-" ? "" : resumo;
  }

  function renderDentesSelecionados() {
    const resumo = dentesSelecionadosResumo();
    if (!resumo) return <span className="font-normal text-slate-600">Nenhum dente selecionado</span>;

    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        {resumo.split(", ").map((parte) =>
          parte === "SUP" || parte === "INF" ? (
            <span key={parte} className="rounded bg-emerald-500 px-2 py-1 text-[11px] font-bold text-white">
              {parte}
            </span>
          ) : (
            <span key={parte} className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-emerald-500 px-1.5 text-[10px] font-bold text-white">
              {parte}
            </span>
          )
        )}
      </span>
    );
  }

  function toothButton(dente: string, arcada: "sup" | "inf") {
    const selected = dentes.includes(dente);
    const imagemDente = urlImagemDente(dente, tipoDenticao);

    return (
      <button
        key={dente}
        type="button"
        onClick={() => toggleDente(dente)}
        className={`group flex w-7 flex-col items-center gap-0.5 rounded px-0.5 py-1 transition ${
          selected ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-50"
        }`}
        title={`Dente ${dente}`}
      >
        <img
          src={imagemDente}
          alt={`Dente ${dente}`}
          className={`h-8 w-5 object-contain transition ${arcada === "inf" ? "order-2" : ""} ${
            selected
              ? "opacity-100 drop-shadow-[0_0_7px_rgba(16,185,129,0.85)] sepia saturate-200 hue-rotate-75"
              : "opacity-45 grayscale group-hover:opacity-80"
          }`}
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
        <span
          className={`text-[11px] leading-none ${
            selected ? "font-bold text-emerald-600" : "text-slate-500"
          }`}
        >
          {dente}
        </span>
      </button>
    );
  }

  function produtoFromItem(item: ItemAdicionado) {
    const nome = item.servico.replace(/^Produto:\s*/i, "").trim();
    return (
      produtosTabelaPrecoOs.find(
        (produto) => produto.id === item.produtoId || produto.nome === nome
      ) || produtos.find((produto) => produto.id === item.produtoId || produto.nome === nome)
    );
  }

  function selecionarItem(item: ItemAdicionado) {
    if (!editId) return;

    const quantidade = Number(item.quantidade || 1) || 1;
    const unitario = item.valor / quantidade;
    const produto = produtoFromItem(item);
    const categoriaItem =
      item.categoria || (item.servico.startsWith("Produto:") ? "" : categoriaDoServico(item.servico));
    const dentesItemExplicitos = item.numeroDente
      .split(",")
      .map((dente) => dente.trim())
      .filter((dente) => /^\d+$/.test(dente));
    const denticaoItem = tipoDenticaoFromDentes(dentesItemExplicitos);

    setItemSelecionadoId(item.id);
    setTipoDenticao(denticaoItem);
    setDentes(dentesFromResumo(item.numeroDente, denticaoItem));
    setForm((current) => ({
      ...current,
      categoria: categoriaItem || current.categoria,
      tipoProtese: item.servico.startsWith("Produto:") ? current.tipoProtese : item.servico,
      quantidade: item.quantidade || "1",
      valor: unitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      desconto: item.desconto || "0,00",
      descontoTipo: item.descontoTipo || (item.desconto?.startsWith("R$") ? "valor" : "percentual"),
      escalaCor: item.corDente === "-" ? "" : item.corDente,
      situacao: item.situacao || current.situacao,
      urgente: Boolean(item.urgente),
      repeticao: Boolean(item.repeticao),
    }));

    if (itemExibeBadgeTransporte(item)) {
      setProdutosOs([]);
      setForm((current) => ({
        ...current,
        categoria: categoriaItem || current.categoria,
        tipoProtese: item.servico,
        quantidade: item.quantidade || "1",
        valor: unitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
        desconto: item.desconto || "0,00",
        descontoTipo: item.descontoTipo || "percentual",
      }));
      return;
    }

    if (item.servico.startsWith("Produto:") || item.produtoId) {
      setAbaServico("produtos");
      setForm((current) => ({ ...current, categoria: "" }));
      setProdutosOs([
        {
          produtoId: produto?.id || item.produtoId || "",
          quantidade: item.quantidade || "1",
          valor: unitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
          observacao: item.observacao || nomeExibicaoItemOs(item),
        },
      ]);
      return;
    }

    setProdutosOs([]);
    const servicoItem = buscarServicoNaTabela(categoriasTabelaPreco, item.servico);
    const etapasDoItem = item.etapasServico?.length
      ? item.etapasServico
      : servicoItem && servicoTemEtapasNaTabela(servicoItem)
        ? etapasIniciaisFormParaOsServico(
            servicoItem,
            modelosEtapas,
            form.dataLancamento,
            form.horaLaboratorio
          )
        : [];
    setEtapas(
      etapasDoItem.map((etapa) => {
        const base: EtapaOsForm = {
          ...etapa,
          setor: etapa.setor || modeloEtapa(etapa.nome)?.setor || "",
        };
        if (etapa.comissaoReais) return base;
        return sincronizarComissaoEtapa(base);
      })
    );

    if (servicoItem) {
      setColaboradores((atuais) =>
        atuais.length > 0
          ? atuais
          : servicoTemComissoesColaboradoresNaTabela(servicoItem)
            ? colaboradoresIniciaisFormParaOsServico(servicoItem, form.repeticao)
            : atuais
      );
      setTerceirizados((atuais) =>
        atuais.length > 0
          ? atuais
          : servicoTemComissoesTerceirizadosNaTabela(servicoItem)
            ? terceirizadosIniciaisFormParaOsServico(
                servicoItem,
                servicoItem.valor * Number(item.quantidade || 1),
                form.repeticao
              )
            : atuais
      );
    }

    if (etapasDoItem.length > 0) {
      setAbaServico("etapas");
    } else if (servicoItem && servicoTemComissoesColaboradoresNaTabela(servicoItem)) {
      setAbaServico("colaboradores");
    } else if (servicoItem && servicoTemComissoesTerceirizadosNaTabela(servicoItem)) {
      setAbaServico("terceirizados");
    }
  }

  function tipoItemAdicionado(item: ItemAdicionado) {
    if (item.servico.startsWith("Produto:") || item.produtoId) return "produto" as const;
    if (itemExibeBadgeTransporte(item)) return "transporte" as const;
    return "servico" as const;
  }

  function itemSelecionadoAtual() {
    if (!itemSelecionadoId) return null;
    return itensAdicionados.find((item) => item.id === itemSelecionadoId) || null;
  }

  function itemUnicoDoFormulario(itemBase: ItemAdicionado): ItemAdicionado | null {
    const numeroDente = numeroDenteServico();
    const descontoCampos = { descontoTipo: form.descontoTipo, desconto: form.desconto };
    const flagsUrgencia = { urgente: form.urgente, repeticao: form.repeticao };
    const tipo = tipoItemAdicionado(itemBase);

    if (tipo === "produto") {
      const produtoOs = produtosOs.filter(
        (produto) =>
          produto.produtoId || produto.observacao?.trim() || parseCurrency(produto.valor) > 0
      )[0];
      if (!produtoOs) return null;
      const produto =
        produtosTabelaPrecoOs.find((p) => p.id === produtoOs.produtoId) ||
        produtos.find((p) => p.id === produtoOs.produtoId);
      const nomeProduto = produto?.nome || produtoOs.observacao?.trim() || "Produto";
      const quantidade = produtoOs.quantidade || "1";
      return {
        id: itemBase.id,
        servico: `Produto: ${nomeProduto}`,
        categoria: "",
        numeroDente: "-",
        corDente: "-",
        quantidade,
        valor: parseCurrency(produtoOs.valor) * Number(quantidade || 1),
        ...descontoCampos,
        produtoId: produtoOs.produtoId || undefined,
        observacao: produtoOs.observacao,
        ...flagsUrgencia,
      };
    }

    if (tipo === "transporte") {
      const nomeCampo = form.tipoProtese.trim();
      const nome = /^(transporte|frete)\s*:/i.test(nomeCampo)
        ? nomeCampo.replace(/^(transporte|frete)\s*:/i, "").trim()
        : nomeExibicaoItemOs(itemBase);
      if (!nome) return null;
      const quantidade = form.quantidade || "1";
      return {
        id: itemBase.id,
        servico: /^(transporte|frete)\s*:/i.test(nomeCampo) ? nomeCampo : `Transporte: ${nome}`,
        categoria: form.categoria,
        numeroDente: "-",
        corDente: "-",
        quantidade,
        valor: parseCurrency(form.valor) * Number(quantidade || 1),
        ...descontoCampos,
        ...flagsUrgencia,
      };
    }

    const nomeServico = form.tipoProtese.trim();
    if (!nomeServico || /^(transporte|frete)\s*:/i.test(nomeServico)) return null;
    return {
      id: itemBase.id,
      servico: nomeServico,
      categoria: form.categoria,
      numeroDente,
      corDente: form.escalaCor || "-",
      quantidade: form.quantidade || "1",
      valor: parseCurrency(form.valor) * Number(form.quantidade || 1),
      ...descontoCampos,
      situacao: form.situacao,
      etapasServico: capturarEtapasParaServico(nomeServico),
      ...flagsUrgencia,
    };
  }

  function itensDoFormulario() {
    const itemSelecionado = itemSelecionadoAtual();
    if (itemSelecionado) {
      const atualizado = itemUnicoDoFormulario(itemSelecionado);
      return atualizado ? [atualizado] : [];
    }

    const numeroDente = numeroDenteServico();
    const descontoCampos = { descontoTipo: form.descontoTipo, desconto: form.desconto };
    const flagsUrgencia = { urgente: form.urgente, repeticao: form.repeticao };

    const montarTransporte = (nome: string, quantidade: string, valorStr: string): ItemAdicionado => ({
      id: `${Date.now()}-transporte`,
      servico: /^(transporte|frete)\s*:/i.test(nome) ? nome : `Transporte: ${nome.trim()}`,
      categoria: form.categoria,
      numeroDente: "-",
      corDente: "-",
      quantidade,
      valor: parseCurrency(valorStr) * Number(quantidade || 1),
      ...descontoCampos,
      ...flagsUrgencia,
    });

    const itensTransporte: ItemAdicionado[] = [];
    if (/^(transporte|frete)\s*:/i.test(form.tipoProtese.trim())) {
      const nome = form.tipoProtese.replace(/^(transporte|frete)\s*:/i, "").trim();
      itensTransporte.push(montarTransporte(nome, form.quantidade || "1", form.valor));
    }

    const produtosSelecionados = produtosOs.filter(
      (produto) => produto.produtoId || produto.observacao?.trim() || parseCurrency(produto.valor) > 0
    );

    const itensProdutos = produtosSelecionados.map((produtoOs, index) => {
      const produto =
        produtosTabelaPrecoOs.find((item) => item.id === produtoOs.produtoId) ||
        produtos.find((item) => item.id === produtoOs.produtoId);
      const nomeProduto = produto?.nome || produtoOs.observacao?.trim() || "Produto";
      const quantidade = produtoOs.quantidade || "1";

      return {
        id: `${Date.now()}-produto-${index}`,
        servico: `Produto: ${nomeProduto}`,
        categoria: "",
        numeroDente: "-",
        corDente: "-",
        quantidade,
        valor: parseCurrency(produtoOs.valor) * Number(quantidade || 1),
        ...descontoCampos,
        produtoId: produtoOs.produtoId || undefined,
        observacao: produtoOs.observacao,
        ...flagsUrgencia,
      };
    });

    const nomeServico = form.tipoProtese.trim();
    const isTransporteNoCampoServico = /^(transporte|frete)\s*:/i.test(nomeServico);
    const itemServico: ItemAdicionado | null =
      nomeServico && !isTransporteNoCampoServico
        ? {
            id: `${Date.now()}-servico`,
            servico: nomeServico,
            categoria: form.categoria,
            numeroDente,
            corDente: form.escalaCor || "-",
            quantidade: form.quantidade || "1",
            valor: parseCurrency(form.valor) * Number(form.quantidade || 1),
            ...descontoCampos,
            situacao: form.situacao,
            etapasServico: capturarEtapasParaServico(nomeServico),
            ...flagsUrgencia,
          }
        : null;

    const resultado: ItemAdicionado[] = [];
    if (itemServico) resultado.push(itemServico);
    resultado.push(...itensProdutos, ...itensTransporte);
    return resultado;
  }

  const produtosOsSelecionados = () =>
    produtosOs.filter(
      (produto) => produto.produtoId || produto.observacao?.trim() || parseCurrency(produto.valor) > 0
    );

  const exigeCamposServicoForm = itensAdicionados.length === 0 && !itemSelecionadoId;

  function temEtapaPreenchida() {
    return etapas.some(
      (etapa) =>
        etapa.nome.trim() || etapa.responsavel.trim() || etapa.prazo.trim() || etapa.observacao.trim()
    );
  }

  function temColaboradorPreenchido() {
    return colaboradores.some((item) => item.nome.trim() || item.comissao.trim() || item.etapa.trim());
  }

  function temTerceirizadoPreenchido() {
    return terceirizados.some((item) => item.nome.trim() || item.servico.trim() || item.custo.trim());
  }

  function temConteudoParaAdicionar() {
    const itemEdicao = itemSelecionadoAtual();
    if (itemEdicao) {
      const tipo = tipoItemAdicionado(itemEdicao);
      if (tipo === "produto") return produtosOsSelecionados().length > 0;
      if (tipo === "transporte") return Boolean(form.tipoProtese.trim());
      return Boolean(form.tipoProtese.trim());
    }
    if (produtosOsSelecionados().length > 0) return true;
    if (form.tipoProtese.trim()) return true;
    if (temEtapaPreenchida()) return true;
    if (temColaboradorPreenchido()) return true;
    if (temTerceirizadoPreenchido()) return true;
    return false;
  }

  function classeAbaOs(aba: "etapas" | "produtos" | "colaboradores" | "terceirizados") {
    return abaServico === aba
      ? "rounded px-3 py-2 text-xs font-medium bg-primary-600 text-white shadow"
      : "px-1 py-2 text-xs font-medium text-slate-700 hover:text-primary-700";
  }

  function adicionarLinhaProduto() {
    setAbaServico("produtos");
    setProdutosOs((atuais) => [
      ...atuais,
      { produtoId: "", quantidade: "1", valor: "R$ 0,00", observacao: "" },
    ]);
  }

  function adicionarLinhaEtapa() {
    setAbaServico("etapas");
    const ultima = etapas[etapas.length - 1];
    if (ultima && !ultima.nome.trim() && !ultima.responsavel.trim() && !ultima.prazo.trim()) return;
    setEtapas((atuais) => [
      ...atuais,
      {
        nome: "",
        setor: "",
        responsavel: "",
        prazo: "",
        observacao: "",
        comissaoReais: "0,00",
      },
    ]);
  }

  function adicionarLinhaColaborador() {
    setAbaServico("colaboradores");
    const ultima = colaboradores[colaboradores.length - 1];
    if (ultima && !ultima.nome.trim() && !ultima.comissao.trim() && !ultima.etapa.trim()) return;
    setColaboradores((atuais) => [...atuais, { nome: "", comissao: "", etapa: "" }]);
  }

  function comissaoColaboradorCadastro(cadastro: ColaboradorListagem) {
    if (form.repeticao && cadastro.comissaoRepeticao?.replace(/[^\d]/g, "") !== "000") {
      return cadastro.comissaoRepeticao;
    }
    return cadastro.comissaoPercentual || "0,00";
  }

  function selecionarColaboradorOs(index: number, nome: string) {
    if (nome) {
      const duplicata = colaboradores.findIndex((item, i) => i !== index && item.nome === nome);
      if (duplicata >= 0) {
        setColaboradores((atuais) => atuais.filter((_, i) => i !== index));
        return;
      }
    }
    const comissaoTabela = comissaoColaboradorNaTabelaServico(servicoOsAtual, nome, form.repeticao);
    const cadastro = colaboradoresOpcoes.find((item) => item.nome === nome);
    setColaboradores((atuais) =>
      atuais.map((item, i) =>
        i === index
          ? {
              ...item,
              nome,
              comissao:
                comissaoTabela ||
                (cadastro ? comissaoColaboradorCadastro(cadastro) : item.comissao),
            }
          : item
      )
    );
  }

  function adicionarLinhaTerceirizado() {
    setAbaServico("terceirizados");
    setTerceirizados((atuais) => [...atuais, { nome: "", servico: "", custo: "" }]);
  }

  function capturarEtapasParaServico(nomeServico: string, etapasForm = etapas) {
    return etapasFormParaItemServico(
      nomeServico,
      etapasForm,
      categoriasTabelaPreco,
      modelosEtapas,
      { somentePreenchidasNoForm: true }
    );
  }

  function anexarEtapasServicoAoItem(item: ItemAdicionado): ItemAdicionado {
    if (tipoItemAdicionado(item) !== "servico") return item;
    return {
      ...item,
      etapasServico: capturarEtapasParaServico(item.servico),
    };
  }

  function prepararItensParaSalvarOs(itens: ItemAdicionado[]): ItemAdicionado[] {
    const servicos = itens.filter((item) => tipoItemAdicionado(item) === "servico");
    return itens.map((item) => {
      if (tipoItemAdicionado(item) !== "servico") return item;
      if (item.etapasServico !== undefined) return item;
      if (servicos.length === 1 && servicos[0]?.id === item.id) {
        return anexarEtapasServicoAoItem(item);
      }
      return { ...item, etapasServico: [] };
    });
  }

  function limparFormularioServicoAposAdicionar() {
    setTipoDenticao("permanente");
    setDentes([]);
    setProdutosOs([]);
    setAbaServico("etapas");
    setEtapas([{ nome: "", setor: "", responsavel: "", prazo: "", observacao: "" }]);
    setForm((current) => ({
      ...current,
      produtoId: "",
      tipoProtese: "",
      categoria: "",
      quantidade: "1",
      valor: "R$ 0,00",
      escalaCor: "",
      dataLaboratorio: "",
      dataDentista: "",
      horaLaboratorio: "",
      horaDentista: "",
      urgente: false,
      repeticao: false,
    }));
  }

  function movimentosEstoqueDaOs(osId: string, itens: ItemAdicionado[]): MovimentoEstoque[] {
    const cliente = clientes.find((item) => item.id === form.clienteId);
    return itens
      .filter((item) => item.produtoId)
      .map((item) => ({
        produtoId: item.produtoId || "",
        quantidade: parseQuantidadeEstoque(item.quantidade || 1),
        tipo: "saida" as const,
        origem: "os" as const,
        referencia: osId,
        numeroOs: form.numeroOs ? Number(form.numeroOs) : undefined,
        pacienteNome: form.pacienteNome.trim() || undefined,
        clienteNome: cliente?.nome || undefined,
        responsavel: `OS ${form.numeroOs || osId}`,
        setor: "Produção",
        observacao: item.servico,
        data: new Date().toISOString(),
      }))
      .filter((movimento) => movimento.produtoId && movimento.quantidade > 0);
  }

  function limparSelecaoItem() {
    setItemSelecionadoId(null);
    limparFormularioServicoAposAdicionar();
  }

  async function uploadArquivosSelecionados(): Promise<ArquivoOs[]> {
    if (!arquivos.length) return [];
    const formData = new FormData();
    arquivos.forEach((arquivo) => formData.append("files", arquivo));

    const response = await fetch("/api/uploads", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      if (err?.error) alert(String(err.error));
      return [];
    }
    const uploaded = await response.json();
    notificarUploadsAtualizados();
    return uploaded;
  }

  function adicionarArquivosSelecionados(event: React.ChangeEvent<HTMLInputElement>) {
    const selecionados = Array.from(event.target.files || []);
    if (!selecionados.length) return;

    setArquivos((atuais) => {
      const existentes = new Set(atuais.map((arquivo) => `${arquivo.name}-${arquivo.size}-${arquivo.lastModified}`));
      const novos = selecionados.filter(
        (arquivo) => !existentes.has(`${arquivo.name}-${arquivo.size}-${arquivo.lastModified}`)
      );
      return [...atuais, ...novos].slice(0, LIMITE_ARQUIVOS_OS);
    });
    event.target.value = "";
  }

  function abrirModalImpressaoAposSalvar(
    trabalho: {
      id: string;
      numeroOs: number;
      segmentoFaturamento?: string | null;
      instrucoes?: string | null;
      tipoProtese?: string | null;
    },
    multiplosSegmentos: boolean
  ) {
    setImprimirOsAposSalvar({
      trabalho: {
        id: trabalho.id,
        numeroOs: trabalho.numeroOs,
        segmentoFaturamento: trabalho.segmentoFaturamento,
        instrucoes: trabalho.instrucoes,
        tipoProtese: trabalho.tipoProtese ?? form.tipoProtese,
      },
      multiplosSegmentos,
    });
  }

  async function fecharModalImpressaoAposSalvar() {
    const eraNovaOs = !editId;
    setImprimirOsAposSalvar(null);
    if (eraNovaOs) {
      await resetarFormularioNovaOs();
    }
  }

  async function resetarFormularioNovaOs() {
    const nextOs = await fetch("/api/trabalhos/next-os")
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null);

    setDentes([]);
    setArquivos([]);
    setMateriaisSelecionados([]);
    setMaterialQuantidades({});
    setMaterialAberto(false);
    setBuscaMaterial("");
    setNovoMaterial("");
    setTipoDenticao("permanente");
    setAbaServico("etapas");
    setEtapas([]);
    setProdutosOs([]);
    setColaboradores([]);
    setTerceirizados([]);
    setItensAdicionados([]);
    setItemSelecionadoId(null);
    setAvisoAdicionarServico("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setForm({
      numeroOs: nextOs?.numeroOs ? String(nextOs.numeroOs) : "",
      clienteId: "",
      pacienteNome: "",
      casoUrgente: "",
      dentista: "",
      caixa: "",
      materialEnviado: "",
      produtoId: "",
      tipoProtese: "",
      categoria: "",
      quantidade: "1",
      valor: "R$ 0,00",
      descontoTipo: "percentual",
      desconto: "0,00",
      dataLancamento: new Date().toLocaleDateString("pt-BR"),
      dataLaboratorio: "",
      horaLaboratorio: "",
      dataDentista: "",
      horaDentista: "",
      escalaCor: "",
      situacao: "producao",
      urgente: false,
      repeticao: false,
      instrucoes: "",
      observacoes: "",
    });
  }

  function adicionarServico() {
    const pendentes = [
      !form.clienteId ? "cliente" : "",
      !form.pacienteNome.trim() ? "paciente" : "",
    ].filter(Boolean);

    if (!temConteudoParaAdicionar()) {
      pendentes.push("serviço, produto, etapa, colaborador ou terceirizado");
    }

    const adicionaServicoPelaCategoria =
      Boolean(form.tipoProtese.trim()) && !/^(transporte|frete)\s*:/i.test(form.tipoProtese.trim());
    if (!editId && !form.categoria && adicionaServicoPelaCategoria) {
      pendentes.push("categoria");
    }

    if (pendentes.length) {
      setAvisoAdicionarServico(`Preencha os campos obrigatórios: ${pendentes.join(", ")}.`);
      return;
    }

    setAvisoAdicionarServico("");

    const selectedId = itemSelecionadoId;
    const novosItens = itensDoFormulario();

    if (novosItens.length > 0) {
      setItensAdicionados((atuais) => {
        if (!selectedId) return [...atuais, ...novosItens];
        const indexSelecionado = atuais.findIndex((item) => item.id === selectedId);
        if (indexSelecionado < 0) return atuais;
        const itemAtualizado = novosItens[0];
        if (!itemAtualizado) return atuais;
        const atualizados = [...atuais];
        atualizados[indexSelecionado] = { ...itemAtualizado, id: selectedId };
        return atualizados;
      });
    }

    setItemSelecionadoId(null);
    limparFormularioServicoAposAdicionar();
  }

  function itensComMarcadoresAtualizados() {
    if (!editId || itensAdicionados.length === 0) return itensAdicionados;
    const alvoId = itemSelecionadoId || itensAdicionados[0]?.id;

    return itensAdicionados.map((item) =>
      item.id === alvoId
        ? { ...item, urgente: form.urgente, repeticao: form.repeticao }
        : item
    );
  }

  function escalaOsParaSalvar(itens: ItemAdicionado[]) {
    const itemServico = itens.find((item) => tipoItemAdicionado(item) === "servico");
    return itemServico?.categoria?.trim() || "";
  }

  function formatarLinhaItem(item: ItemAdicionado) {
    const incluirCategoria =
      item.categoria?.trim() && tipoItemAdicionado(item) === "servico";
    return `Item adicionado: ${item.servico} - dentes ${item.numeroDente} - cor ${item.corDente} - qtd ${item.quantidade} - valor ${item.valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })}${incluirCategoria ? ` - categoria ${item.categoria}` : ""}${
      itemUsaCamposOdontologicos(item) && item.desconto ? ` - desc ${item.desconto}` : ""
    }${
      itemUsaCamposOdontologicos(item) && item.situacao ? ` - situação ${item.situacao}` : ""
    }${item.produtoId ? ` - produtoId ${item.produtoId}` : ""}${item.urgente ? " - urgente" : ""}${item.repeticao ? " - repetição" : ""}${item.observacao ? ` - obs ${item.observacao}` : ""}`;
  }

  function valorItens(itens: ItemAdicionado[]) {
    return itens.reduce(
      (sum, item) => sum + valorComDesconto(item.valor, item.descontoTipo, item.desconto),
      0
    );
  }

  async function mensagemErroApi(res: Response, padrao: string) {
    try {
      const data = await res.json();
      if (typeof data?.error === "string" && data.error.trim()) return data.error;
    } catch {
      /* resposta não-JSON */
    }
    return padrao;
  }

  function etapasParaInstrucoes() {
    const prazoGeral = form.dataLaboratorio.trim();
    let lista = deduplicarEtapas(
      etapas.map((etapa, indice) => ({
        indice,
        nome: etapa.nome,
        responsavel: etapa.responsavel,
        prazo: etapa.prazo,
        observacao: etapa.observacao,
      }))
    );
    if (prazoGeral && lista.length > 0) {
      const ultima = lista[lista.length - 1];
      if (!ultima.prazo.trim()) {
        lista = [...lista.slice(0, -1), { ...ultima, prazo: prazoGeral }];
      }
    }
    return lista
      .map((etapa) =>
        formatarLinhaEtapaComTempo(etapa, tempoCalculadoEtapa(etapa.nome) || undefined)
      )
      .filter(Boolean)
      .join("\n");
  }

  function montarCorpoInstrucoes(arquivosEnviados: ArquivoOs[]) {
    return [
      instrucoesTextoLivre(form.instrucoes),
      form.materialEnviado ? `Material enviado: ${form.materialEnviado}` : "",
      form.caixa ? `Caixa: ${form.caixa}` : "",
      form.dentista ? `Dentista: ${form.dentista}` : "",
      form.casoUrgente ? `Caso odontológico: ${form.casoUrgente}` : "",
      form.dataLaboratorio ? `Data laboratório: ${form.dataLaboratorio} ${form.horaLaboratorio}`.trim() : "",
      form.dataDentista ? `Data dentista: ${form.dataDentista} ${form.horaDentista}`.trim() : "",
      etapasParaInstrucoes(),
      deduplicarColaboradores(colaboradores)
        .filter((colaborador) => colaborador.nome.trim())
        .map((colaborador) => formatarLinhaColaborador(colaborador))
        .filter(Boolean)
        .join("\n"),
      terceirizados
        .filter((terceiro) => terceiro.nome || terceiro.servico || terceiro.custo)
        .map(
          (terceiro) =>
            `Terceirizado ${terceiro.nome || "-"}: ${terceiro.servico || "serviço"}${
              terceiro.custo ? ` - custo ${terceiro.custo}` : ""
            }`
        )
        .join("\n"),
      arquivosEnviados
        .map((arquivo) => `Arquivo anexado: ${arquivo.name} | ${arquivo.type} | ${arquivo.url}`)
        .join("\n") ||
        (arquivos.length ? `Arquivos anexados: ${arquivos.map((arquivo) => arquivo.name).join(", ")}` : ""),
    ]
      .filter(Boolean)
      .join("\n");
  }

  function linhasEtapasParaItemServico(item: ItemAdicionado) {
    const fonte =
      item.etapasServico !== undefined
        ? item.etapasServico
        : capturarEtapasParaServico(item.servico);
    const prazoGeral = form.dataLaboratorio.trim();
    let lista = deduplicarEtapas(
      fonte.map((etapa, indice) => ({
        indice,
        nome: etapa.nome,
        responsavel: etapa.responsavel,
        prazo: etapa.prazo,
        observacao: etapa.observacao,
      }))
    );
    if (prazoGeral && lista.length === 1 && !lista[0]?.prazo.trim()) {
      const ultima = lista[lista.length - 1];
      lista = [{ ...ultima, prazo: prazoGeral }];
    }
    return lista
      .map((etapa) =>
        formatarLinhaEtapaComTempo(etapa, tempoCalculadoEtapa(etapa.nome) || undefined)
      )
      .filter(Boolean)
      .join("\n");
  }

  function montarInstrucoesSegmento(
    itens: ItemAdicionado[],
    corpoComum: string,
    segmento: SegmentoFaturamento = "servico",
    linhasEtapasServico?: string
  ) {
    const servicoUnico = segmento === "servico" && itens.length === 1;
    let corpo =
      segmento === "servico" ? corpoComum : removerComplementosOsDoCorpo(corpoComum);
    if (servicoUnico && linhasEtapasServico !== undefined) {
      corpo = removerComplementosOsDoCorpo(corpo);
      corpo = [corpo, linhasEtapasServico].filter(Boolean).join("\n");
    }
    const linhas = itens.map(formatarLinhaItem).join("\n");
    return [corpo, linhas].filter(Boolean).join("\n");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    if (!form.clienteId || !form.pacienteNome.trim()) {
      alert("Selecione o cliente e informe o nome do paciente.");
      return;
    }

    if (!editId) {
      const config = clienteConfig(form.clienteId);
      const limite = parseCurrency(config.limiteSaldoDevedor || "0,00");
      const saldo = saldoDevedorCliente(form.clienteId);
      if (limite > 0 && saldo >= limite) {
        alert(
          `Este cliente atingiu o limite de saldo devedor (${limite.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })}). Saldo atual: ${saldo.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })}. Não é possível criar nova OS.`
        );
        return;
      }
    }

    setSalvando(true);
    const arquivosEnviados = await uploadArquivosSelecionados();
    const itensNaLista = itensComMarcadoresAtualizados();
    const itensExtrasForm = itensDoFormulario();
    let itensParaSalvar = itensNaLista.length > 0 ? itensNaLista : itensExtrasForm;
    itensParaSalvar = prepararItensParaSalvarOs(itensParaSalvar);

    if (itensParaSalvar.length === 0) {
      setSalvando(false);
      alert("Adicione ao menos um serviço ou produto em Itens Adicionados.");
      return;
    }
    const corpoComum = montarCorpoInstrucoes(arquivosEnviados);
    const blocosSalvar = planejarBlocosSalvarOs(itensParaSalvar);
    const dividir = blocosSalvar.length > 1 || deveDividirOs(itensParaSalvar);

    const dataPrevistaIso = brDateToIso(form.dataLaboratorio || form.dataDentista);
    const dentesResumo = dentesSelecionadosResumo();
    /** PUT: null limpa campos no banco; POST: omitir vazios (API não aceita null em .optional()). */
    const payloadPutCompartilhado = {
      dentes: dentesResumo || null,
      cor: form.escalaCor || null,
      material: form.materialEnviado || null,
      dataPrevista: dataPrevistaIso ?? null,
      status: form.situacao || "pedido",
      observacoes: form.observacoes ?? null,
    };
    const payloadPostCompartilhado = bodyTrabalhoSemNull({
      status: form.situacao || "pedido",
      ...(dentesResumo ? { dentes: dentesResumo } : {}),
      ...(form.escalaCor ? { cor: form.escalaCor } : {}),
      ...(form.materialEnviado ? { material: form.materialEnviado } : {}),
      ...(dataPrevistaIso ? { dataPrevista: dataPrevistaIso } : {}),
      ...(form.observacoes ? { observacoes: form.observacoes } : {}),
    });

    async function salvarSegmentoExistente(
      id: string,
      segmento: SegmentoFaturamento,
      itens: ItemAdicionado[],
      opts?: {
        segmentoFaturamento?: SegmentoFaturamento;
        linhasEtapasServico?: string;
        tipoProtese?: string;
        dentes?: string | null;
      }
    ) {
      const item = itens[0];
      const dentes =
        opts?.dentes !== undefined
          ? opts.dentes
          : segmento === "servico" &&
              itens.length === 1 &&
              item?.numeroDente &&
              item.numeroDente !== "-"
            ? item.numeroDente
            : payloadPutCompartilhado.dentes;

      return fetch(`/api/trabalhos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payloadPutCompartilhado,
          dentes,
          ...(opts?.segmentoFaturamento
            ? { segmentoFaturamento: opts.segmentoFaturamento }
            : {}),
          escala: escalaOsParaSalvar(itens) || null,
          tipoProtese:
            opts?.tipoProtese ?? tituloSegmentoOs(itens, segmento, form.tipoProtese),
          valor: valorItens(itens),
          instrucoes:
            montarInstrucoesSegmento(
              itens,
              corpoComum,
              segmento,
              opts?.linhasEtapasServico
            ) || null,
        }),
      });
    }

    if (editId) {
      const registros = grupoOsRegistros.length
        ? grupoOsRegistros
        : [{ id: editId, segmentoFaturamento: "servico" as SegmentoFaturamento }];

      if (dividir) {
        const idsUsados = new Set<string>();
        let meta = metaGrupoOsEdicao;

        if (!meta?.pacienteId) {
          const idsProbe = new Set<string>();
          const precisaCriarSegmento = blocosSalvar.some((bloco) => {
            const { reg } = buscarRegistroParaBlocoSalvar(registros, bloco, idsProbe);
            if (reg) {
              idsProbe.add(reg.id);
              return false;
            }
            return true;
          });
          if (precisaCriarSegmento) {
            const completo = await fetch(`/api/trabalhos/${editId}`).then((r) => r.json());
            meta = {
              clienteId: completo.clienteId,
              pacienteId: completo.pacienteId,
              numeroOs: completo.numeroOs,
              grupoOsId: completo.grupoOsId || completo.id,
              dataEntrada: completo.dataEntrada,
            };
          }
        }

        const promessas: Promise<Response>[] = [];

        for (const bloco of blocosSalvar) {
          const { reg, migrarSegmento } = buscarRegistroParaBlocoSalvar(
            registros,
            bloco,
            idsUsados
          );
          const servicoUnico =
            bloco.segmento === "servico" && bloco.itens.length === 1;
          const linhasEtapas = servicoUnico
            ? linhasEtapasParaItemServico(bloco.itens[0])
            : undefined;
          const tipoProtese = servicoUnico
            ? tituloTrabalhoServicoItem(bloco.itens[0])
            : tituloSegmentoOs(bloco.itens, bloco.segmento, form.tipoProtese);
          const dentesItem =
            servicoUnico && bloco.itens[0].numeroDente !== "-"
              ? bloco.itens[0].numeroDente
              : null;

          if (reg) {
            idsUsados.add(reg.id);
            promessas.push(
              salvarSegmentoExistente(reg.id, bloco.segmento, bloco.itens, {
                segmentoFaturamento: migrarSegmento,
                linhasEtapasServico: linhasEtapas,
                tipoProtese,
                dentes: dentesItem ?? payloadPutCompartilhado.dentes,
              })
            );
            continue;
          }

          if (!meta?.pacienteId) continue;

          promessas.push(
            fetch("/api/trabalhos", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(
                bodyTrabalhoSemNull({
                  ...payloadPostCompartilhado,
                  clienteId: meta.clienteId,
                  pacienteId: meta.pacienteId,
                  numeroOs: meta.numeroOs,
                  grupoOsId: meta.grupoOsId,
                  segmentoFaturamento: bloco.segmento,
                  tipoProtese,
                  dataEntrada: new Date(meta.dataEntrada).toISOString().slice(0, 10),
                  dentes: dentesItem || undefined,
                  escala: escalaOsParaSalvar(bloco.itens) || undefined,
                  valor: valorItens(bloco.itens),
                  instrucoes: montarInstrucoesSegmento(
                    bloco.itens,
                    corpoComum,
                    bloco.segmento,
                    linhasEtapas
                  ),
                })
              ),
            })
          );
        }

        const respostas = await Promise.all(promessas);
        const falha = respostas.find((res) => !res.ok);
        setSalvando(false);
        if (!falha) {
          const idEstoque = editIdPreferidoGrupo(registros) || editId;
          sincronizarMovimentosOs(idEstoque, movimentosEstoqueDaOs(idEstoque, itensParaSalvar));
          notificarTrabalhosAtualizados({ trabalhoId: idEstoque });
          const regPrincipal = registros.find((r) => r.id === idEstoque) || registros[0];
          abrirModalImpressaoAposSalvar(
            {
              id: idEstoque,
              numeroOs: Number(form.numeroOs) || 0,
              segmentoFaturamento: regPrincipal?.segmentoFaturamento,
              instrucoes: regPrincipal?.instrucoes,
              tipoProtese: form.tipoProtese,
            },
            grupoOsTemMultiplosSegmentos(
              blocosSalvar.map((b) => ({ segmentoFaturamento: b.segmento }))
            )
          );
        } else {
          alert(await mensagemErroApi(falha, "Não foi possível salvar a edição da OS."));
        }
      } else {
        const blocoUnico = blocosSalvar[0];
        const segmentoUnico = blocoUnico?.segmento ?? "servico";
        const { reg } = buscarRegistroParaBlocoSalvar(
          registros,
          blocoUnico ?? { segmento: segmentoUnico, itens: itensParaSalvar },
          new Set()
        );
        const alvo = reg || registros[0];
        const itensUnicos = blocoUnico?.itens ?? itensParaSalvar;
        const servicoUnico =
          segmentoUnico === "servico" && itensUnicos.length === 1;
        const res = await salvarSegmentoExistente(alvo.id, segmentoUnico, itensUnicos, {
          linhasEtapasServico: servicoUnico
            ? linhasEtapasParaItemServico(itensUnicos[0])
            : undefined,
          tipoProtese: servicoUnico
            ? tituloTrabalhoServicoItem(itensUnicos[0])
            : undefined,
          dentes:
            servicoUnico && itensUnicos[0].numeroDente !== "-"
              ? itensUnicos[0].numeroDente
              : undefined,
        });
        setSalvando(false);
        if (res.ok) {
          sincronizarMovimentosOs(alvo.id, movimentosEstoqueDaOs(alvo.id, itensParaSalvar));
          notificarTrabalhosAtualizados({ trabalhoId: alvo.id });
          abrirModalImpressaoAposSalvar(
            {
              id: alvo.id,
              numeroOs: Number(form.numeroOs) || 0,
              segmentoFaturamento: segmentoUnico,
              instrucoes: alvo.instrucoes,
              tipoProtese: form.tipoProtese,
            },
            false
          );
        } else {
          alert(await mensagemErroApi(res, "Não foi possível salvar a edição da OS."));
        }
      }
      return;
    }

    const pacienteRes = await fetch("/api/pacientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: form.pacienteNome.trim(),
        clienteId: form.clienteId,
      }),
    });

    if (!pacienteRes.ok) {
      setSalvando(false);
      alert("Não foi possível cadastrar o paciente.");
      return;
    }

    const paciente = await pacienteRes.json();

    const criarPayload = (
      segmento: SegmentoFaturamento,
      itens: ItemAdicionado[],
      extras?: { numeroOs?: number; grupoOsId?: string }
    ) => {
      const servicoUnico = segmento === "servico" && itens.length === 1;
      const item = itens[0];
      return {
        clienteId: form.clienteId,
        pacienteId: paciente.id,
        segmentoFaturamento: segmento,
        tipoProtese: servicoUnico
          ? tituloTrabalhoServicoItem(item)
          : tituloSegmentoOs(itens, segmento, form.tipoProtese),
        dentes:
          servicoUnico && item.numeroDente !== "-"
            ? item.numeroDente
            : dentesSelecionadosResumo(),
        cor: form.escalaCor,
        material: form.materialEnviado,
        escala: escalaOsParaSalvar(itens),
        dataEntrada: brDateToIso(form.dataLancamento) || undefined,
        dataPrevista: brDateToIso(form.dataLaboratorio || form.dataDentista) || undefined,
        valor: valorItens(itens),
        status: form.situacao,
        observacoes: form.observacoes,
        instrucoes: montarInstrucoesSegmento(
          itens,
          corpoComum,
          segmento,
          servicoUnico ? linhasEtapasParaItemServico(item) : undefined
        ),
        ...extras,
      };
    };

    let trabalhoPrincipal: { id: string; numeroOs: number; grupoOsId?: string | null } | null = null;

    if (dividir) {
      let numeroOs: number | undefined;
      let grupoOsId: string | undefined;

      for (const bloco of blocosSalvar) {
        const res = await fetch("/api/trabalhos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            bodyTrabalhoSemNull(
              criarPayload(bloco.segmento, bloco.itens, {
                numeroOs,
                grupoOsId,
              })
            )
          ),
        });
        if (!res.ok) {
          setSalvando(false);
          const rotulo =
            bloco.segmento === "servico"
              ? bloco.itens.length > 1
                ? "serviços"
                : "serviço"
              : bloco.segmento === "produto"
                ? "produtos"
                : "transporte";
          alert(
            await mensagemErroApi(
              res,
              trabalhoPrincipal
                ? `A OS principal foi criada, mas não foi possível criar a parte de ${rotulo}.`
                : `Não foi possível criar a OS de ${rotulo}.`
            )
          );
          return;
        }
        const criado = await res.json();
        if (!trabalhoPrincipal) {
          trabalhoPrincipal = criado;
          numeroOs = criado.numeroOs;
          grupoOsId = criado.grupoOsId || criado.id;
        }
      }
    } else {
      const blocoUnico = blocosSalvar[0];
      const segmento: SegmentoFaturamento = blocoUnico?.segmento ?? "servico";
      const itensUnicos = blocoUnico?.itens ?? itensParaSalvar;
      const res = await fetch("/api/trabalhos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyTrabalhoSemNull(criarPayload(segmento, itensUnicos))),
      });
      if (!res.ok) {
        setSalvando(false);
        alert(await mensagemErroApi(res, "Não foi possível criar a OS."));
        return;
      }
      trabalhoPrincipal = await res.json();
    }

    setSalvando(false);
    if (trabalhoPrincipal) {
      notificarTrabalhosAtualizados({ trabalhoId: trabalhoPrincipal.id });
      sincronizarMovimentosOs(
        trabalhoPrincipal.id,
        movimentosEstoqueDaOs(trabalhoPrincipal.id, itensParaSalvar)
      );
      abrirModalImpressaoAposSalvar(
        {
          id: trabalhoPrincipal.id,
          numeroOs: trabalhoPrincipal.numeroOs,
          segmentoFaturamento: blocosSalvar[0]?.segmento ?? "servico",
          tipoProtese: form.tipoProtese,
        },
        grupoOsTemMultiplosSegmentos(
          blocosSalvar.map((b) => ({ segmentoFaturamento: b.segmento }))
        )
      );
    }
  }

  function renderItensAdicionados() {
    return (
      <div className="mt-4 rounded border border-slate-200 bg-white p-3">
        <div className="mb-3 text-center">
          <span className="font-medium text-slate-600">Itens Adicionados</span>
        </div>
        <div className="mb-2 flex justify-end text-[11px] text-slate-600">
          <span>
            Total Serviços:{" "}
            {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="px-3 py-2 text-left font-medium uppercase">Serviço/Produto</th>
                <th className="px-3 py-2 text-left font-medium uppercase">Número Dente</th>
                <th className="px-3 py-2 text-left font-medium uppercase">Cor Dente</th>
                <th className="px-3 py-2 text-left font-medium uppercase">Quantidade</th>
                <th className="px-3 py-2 text-left font-medium uppercase">Desc.</th>
                <th className="px-3 py-2 text-left font-medium uppercase">Situação</th>
                <th className="px-3 py-2 text-left font-medium uppercase">Valor</th>
                <th className="px-3 py-2 text-center font-medium uppercase">Opções</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {itensAdicionados.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-5 text-center text-slate-400">
                    Nenhum serviço adicionado para conferência.
                  </td>
                </tr>
              )}
              {itensAdicionados.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => {
                    if (editId) selecionarItem(item);
                  }}
                  className={`${editId ? "cursor-pointer hover:bg-blue-50" : ""} odd:bg-slate-50/60 ${
                    itemSelecionadoId === item.id ? "bg-blue-100 ring-1 ring-blue-300" : ""
                  }`}
                >
                  <td className="px-3 py-2 text-slate-700">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{nomeExibicaoItemOs(item)}</span>
                      {item.urgente && (
                        <span className="text-[10px] font-extrabold uppercase tracking-wide text-red-800">
                          URGENTE
                        </span>
                      )}
                      {item.repeticao && (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-orange-100 px-1.5 text-[10px] font-extrabold text-orange-700">
                          R
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {itemUsaCamposOdontologicos(item) ? exibirTexto(item.numeroDente) : ""}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {itemUsaCamposOdontologicos(item) ? exibirTexto(item.corDente) : ""}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{item.quantidade}</td>
                  <td className="px-3 py-2 text-slate-600">{formatarDescontoItemOs(item)}</td>
                  <td className="px-3 py-2">
                    {itemExibeBadgeProduto(item) ? (
                      <span className="inline-flex items-center rounded-full bg-slate-600 px-2.5 py-1 text-[10px] font-semibold text-white">
                        Produto
                      </span>
                    ) : itemExibeBadgeTransporte(item) ? (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                        Transporte
                      </span>
                    ) : (
                      <span
                        className={`rounded px-2 py-1 text-[10px] font-semibold ${
                          STATUS_TRABALHO[item.situacao || ""]?.color || "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {STATUS_TRABALHO[item.situacao || ""]?.label || item.situacao || "-"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {item.valor.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setItensAdicionados((atuais) =>
                          atuais.filter((atual) => atual.id !== item.id)
                        );
                        if (itemSelecionadoId === item.id) setItemSelecionadoId(null);
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded text-red-500 hover:bg-red-50"
                      title="Excluir item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (!paginaPronta) {
    return (
      <div className="space-y-4 text-xs text-slate-700">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>Produção</span>
          <span>/</span>
          <span className="font-medium text-slate-700">Ordem de Serviço</span>
        </div>
        <PainelCarregando mensagem="Carregando ordem de serviço..." />
      </div>
    );
  }

  return (
    <div className="space-y-4 text-xs text-slate-700">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span>Produção</span>
        <span>/</span>
        <span className="font-medium text-slate-700">Ordem de Serviço</span>
      </div>

      <form onSubmit={submit} className="rounded border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3 text-center">
          <h1 className="text-sm font-medium text-slate-700">
            {editId ? `Editar Ordem de Serviço ${form.numeroOs}` : "Ordem de Serviço"}
          </h1>
        </div>

        <section className="grid gap-3 p-4 md:grid-cols-5">
          {dateField("Data Lançamento", "dataLancamento")}
          <Input label="Número OS" value={form.numeroOs || "Gerando..."} readOnly />
          <Input label="Caixa" value={form.caixa} onChange={(e) => setForm({ ...form, caixa: e.target.value })} />
          <Input label="Caso Clínico" value={form.casoUrgente} onChange={(e) => setForm({ ...form, casoUrgente: e.target.value })} />
          <Input
            label={requiredLabel("Paciente", Boolean(avisoAdicionarServico))}
            value={form.pacienteNome}
            onChange={(e) => setForm({ ...form, pacienteNome: e.target.value })}
            placeholder="Digite o nome do paciente"
            required
          />

          <div className="space-y-1">
            <Select
              label={requiredLabel("Selecione um Cliente", Boolean(avisoAdicionarServico))}
              value={form.clienteId}
              onChange={(e) => aplicarConfiguracaoCliente(e.target.value)}
              required
            >
              <option value="">Selecione...</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome}
                </option>
              ))}
            </Select>
            {form.clienteId ? (
              <p className="text-[12px] font-medium leading-snug text-[#4a90d9]">
                Tabela Utilizada{" "}
                <span className="font-semibold">{tabelaPrecoSelecionada}</span>
              </p>
            ) : null}
          </div>
          <Input
            label="Dentista"
            value={form.dentista}
            onChange={(e) => setForm({ ...form, dentista: e.target.value })}
            placeholder="Nome do dentista (opcional)"
          />
          <div className="relative space-y-2 md:col-span-3">
            <label className="block text-sm font-medium text-slate-700">
              Material Enviado pelo Dentista
            </label>
            <div className="rounded border border-slate-300 bg-white p-2 shadow-sm">
              {materiaisSelecionados.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {materiaisSelecionados.map((material) => (
                    <span
                      key={material}
                      className="inline-flex items-center rounded bg-blue-600 px-2 py-1 text-[10px] font-semibold text-white"
                    >
                      {materialQuantidades[material] || 1} {material}
                    </span>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => setMaterialAberto((aberto) => !aberto)}
                className="flex w-full items-center justify-center gap-2 rounded border border-slate-500 bg-slate-100 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200"
              >
                <Tag className="h-3.5 w-3.5 text-slate-500" />
                Selecione Materiais
                <span className="text-slate-400">⌄</span>
              </button>
            </div>
            {materialAberto && (
              <div className="absolute left-0 z-30 mt-1 w-full rounded border border-slate-300 bg-white p-4 shadow-xl">
                <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
                  <Input
                    value={buscaMaterial}
                    onChange={(e) => setBuscaMaterial(e.target.value)}
                    placeholder="Procurar"
                    className="h-8"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setBuscaMaterial("");
                      setMateriaisSelecionados([]);
                      setMaterialQuantidades({});
                      setForm((current) => ({ ...current, materialEnviado: "" }));
                    }}
                    className="rounded border border-slate-300 px-3 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    Limpar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNovoMaterial(buscaMaterial);
                      setModalMaterialAberto(true);
                    }}
                    className="rounded border border-emerald-300 px-3 text-xs text-emerald-700 hover:bg-emerald-50"
                  >
                    + Material na Lista
                  </button>
                </div>
                <div className="max-h-80 space-y-1 overflow-auto pr-2">
                  {materiaisFiltrados.map((material) => {
                    const selecionado = materiaisSelecionados.includes(material);
                    return (
                      <div key={material} className="grid grid-cols-[1fr_minmax(160px,260px)] items-center gap-4 rounded px-1 py-1 text-xs text-slate-600 hover:bg-slate-50">
                        <label className="flex min-w-0 flex-1 items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selecionado}
                            onChange={() => toggleMaterial(material)}
                            className="h-4 w-4 accent-blue-600"
                          />
                          <span className="truncate">{material}</span>
                        </label>
                        <div className="grid grid-cols-[32px_1fr_32px] items-center overflow-hidden rounded border border-slate-300 bg-white">
                          <button
                            type="button"
                            disabled={!selecionado}
                            onClick={() => alterarQuantidadeMaterial(material, -1)}
                            className="h-6 border-r border-slate-200 text-slate-600 disabled:opacity-40"
                          >
                            -
                          </button>
                          <span className="text-center text-xs">{materialQuantidades[material] || 1}</span>
                          <button
                            type="button"
                            disabled={!selecionado}
                            onClick={() => alterarQuantidadeMaterial(material, 1)}
                            className="h-6 border-l border-slate-200 text-slate-600 disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {materiaisFiltrados.length === 0 && (
                    <p className="py-3 text-center text-xs text-slate-400">
                      Nenhum material encontrado.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={adicionarArquivosSelecionados}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={arquivos.length >= LIMITE_ARQUIVOS_OS}
            className="rounded border border-slate-300 px-3 py-2 text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ImageUp className="mr-2 inline h-4 w-4" /> Selecione Imagens ou Vídeos ({arquivos.length}/{LIMITE_ARQUIVOS_OS})
          </button>
          {arquivos.length > 0 && (
            <div className="md:col-span-4 rounded border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
              <p className="mb-2 font-medium">Arquivos selecionados ({arquivos.length}/{LIMITE_ARQUIVOS_OS}):</p>
              <div className="grid gap-2 sm:grid-cols-3 md:grid-cols-5">
                {previews.map((preview, index) => (
                  <div
                    key={`${preview.file.name}-${preview.file.size}`}
                    className="relative overflow-hidden rounded border border-emerald-100 bg-white shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setArquivos((atuais) => atuais.filter((_, i) => i !== index))
                      }
                      className="absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-red-600 shadow hover:bg-red-50"
                      title="Excluir imagem ou vídeo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    {preview.isImage && (
                      <Image
                        src={preview.url}
                        alt={preview.file.name}
                        width={240}
                        height={160}
                        unoptimized
                        className="h-24 w-full object-cover"
                      />
                    )}
                    {preview.isVideo && (
                      <video
                        src={preview.url}
                        controls
                        className="h-24 w-full bg-black object-cover"
                      />
                    )}
                    {!preview.isImage && !preview.isVideo && (
                      <div className="flex h-24 items-center justify-center text-slate-400">
                        Arquivo
                      </div>
                    )}
                    <div className="truncate px-2 py-1 text-[11px] text-slate-600">
                      {preview.file.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="border-t border-slate-100 bg-slate-50/70 p-4">
          <h2 className="mb-4 text-center text-base font-medium text-slate-700">Serviço</h2>
          <div className="rounded border border-slate-200 bg-white p-4">
            {itemSelecionadoId && (
              <div className="mb-3 flex items-center justify-between rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                <span>Item selecionado para edição. Altere os campos abaixo e clique em Atualizar Item Selecionado.</span>
                <button
                  type="button"
                  onClick={limparSelecaoItem}
                  className="rounded border border-blue-200 bg-white px-2 py-1 text-blue-700 hover:bg-blue-100"
                >
                  Cancelar edição
                </button>
              </div>
            )}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-5">
                <label className="flex cursor-pointer flex-col items-start gap-1 text-[10px] font-medium text-slate-500">
                  <span>Urgente</span>
                  <span
                    className={`relative inline-flex h-5 w-10 items-center rounded-full transition ${
                      form.urgente ? "bg-red-700" : "bg-slate-200"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={form.urgente}
                      onChange={(e) => setForm({ ...form, urgente: e.target.checked })}
                      className="peer sr-only"
                    />
                    <span
                      className={`absolute left-1 h-4 w-4 rounded-full bg-white shadow transition ${
                        form.urgente ? "translate-x-5" : ""
                      }`}
                    />
                  </span>
                </label>
                <label className="flex cursor-pointer flex-col items-start gap-1 text-[10px] font-medium text-slate-500">
                  <span>Repetição</span>
                  <span
                    className={`relative inline-flex h-5 w-10 items-center rounded-full transition ${
                      form.repeticao ? "bg-orange-300" : "bg-slate-200"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={form.repeticao}
                      onChange={(e) => setForm({ ...form, repeticao: e.target.checked })}
                      className="peer sr-only"
                    />
                    <span
                      className={`absolute left-1 h-4 w-4 rounded-full bg-white shadow transition ${
                        form.repeticao ? "translate-x-5" : ""
                      }`}
                    />
                  </span>
                </label>
              </div>
              <div className="flex items-center gap-2 text-sm text-primary-700">
                <span>Total Serviço:</span>
              <input
                className="w-40 rounded border border-slate-200 px-3 py-2 text-right text-slate-700"
                value={total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                readOnly
              />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-6">
              <div className="space-y-1">
                <Select
                  label={requiredLabel("Categoria", exigeCamposServicoForm && !editId && Boolean(avisoAdicionarServico))}
                  value={form.categoria}
                  onChange={(e) => selecionarCategoriaServico(e.target.value)}
                  required={exigeCamposServicoForm && !editId}
                  disabled={categoriasTabelaPreco.length === 0}
                >
                  <option value="">
                    {categoriasTabelaPreco.length === 0
                      ? "Cadastre categorias na Tabela de Preços"
                      : "Selecione uma Categoria"}
                  </option>
                  {categoriasTabelaPreco.map((categoria) => (
                    <option key={categoria.id} value={categoria.nome}>
                      {categoria.nome}
                    </option>
                  ))}
                </Select>
              </div>
              <Select
                label={requiredLabel("Serviço", exigeCamposServicoForm && Boolean(avisoAdicionarServico))}
                value={valorSelectServico()}
                onChange={(e) => selecionarServicoTabela(e.target.value)}
                required={exigeCamposServicoForm}
                disabled={!form.categoria}
              >
                <option value="">
                  {!form.categoria
                    ? "Selecione uma categoria"
                    : servicosDaCategoria.length === 0
                      ? "Nenhum serviço nesta categoria"
                      : "Selecione um Serviço"}
                </option>
                {servicosDaCategoria.map((servico) => (
                  <option key={servico.id} value={servico.nome}>
                    {servico.nome}
                    {servico.tipo === "transporte" ? " (Transporte)" : ""}
                  </option>
                ))}
              </Select>
              <Input label="Qtd" type="number" min="1" value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: e.target.value })} />
              <Input
                label="Valor Un."
                selectOnFocus
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: formatCurrencyInput(e.target.value) })}
              />
              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">Desc.</label>
                <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20">
                  <select
                    value={form.descontoTipo}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        descontoTipo: e.target.value,
                        desconto: e.target.value === "valor" ? "R$ 0,00" : "0,00",
                      })
                    }
                    className="w-14 border-r border-slate-300 bg-white px-2 text-sm text-slate-600 focus:outline-none"
                  >
                    <option value="percentual">%</option>
                    <option value="valor">$</option>
                  </select>
                  <input
                    value={form.desconto}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        desconto:
                          form.descontoTipo === "valor"
                            ? formatCurrencyInput(e.target.value)
                            : formatPercentInput(e.target.value),
                      })
                    }
                    placeholder={form.descontoTipo === "valor" ? "R$ 0,00" : "0,00"}
                    className="w-full px-3 py-2 text-sm outline-none"
                    {...propsInputComSelecaoAoFocar({})}
                  />
                </div>
              </div>
              <Select label="Situação" value={form.situacao} onChange={(e) => setForm({ ...form, situacao: e.target.value })}>
                {Object.entries(STATUS_TRABALHO).map(([key, value]) => (
                  <option key={key} value={key}>{value.label}</option>
                ))}
              </Select>

              {dateField("Prazo Laboratório", "dataLaboratorio")}
              <Input label="Hora Laboratório" type="time" value={form.horaLaboratorio} onChange={(e) => setForm({ ...form, horaLaboratorio: e.target.value })} />
              {dateField("Prazo Dentista", "dataDentista")}
              <Input label="Hora Dentista" type="time" value={form.horaDentista} onChange={(e) => setForm({ ...form, horaDentista: e.target.value })} />
              <Input label="Escala/Cor" value={form.escalaCor} onChange={(e) => setForm({ ...form, escalaCor: e.target.value })} />
            </div>

            <div className="mt-5 text-center">
              <div className="mb-2 text-[11px] text-slate-500">Selecione os dentes do trabalho</div>
              <div className="mb-3 flex justify-center gap-5 text-[11px] text-slate-600">
                <label className="inline-flex cursor-pointer items-center gap-1.5">
                  <input
                    type="radio"
                    name="tipoDenticao"
                    checked={tipoDenticao === "permanente"}
                    onChange={() => trocarTipoDenticao("permanente")}
                    className="h-3.5 w-3.5 accent-blue-500"
                  />
                  Permanente
                </label>
                <label className="inline-flex cursor-pointer items-center gap-1.5">
                  <input
                    type="radio"
                    name="tipoDenticao"
                    checked={tipoDenticao === "deciduos"}
                    onChange={() => trocarTipoDenticao("deciduos")}
                    className="h-3.5 w-3.5 accent-blue-500"
                  />
                  Decíduos
                </label>
              </div>
              <div className="mx-auto max-w-3xl rounded bg-white px-3 py-2">
                <div className="flex items-end justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => selecionarArcada("sup")}
                    className="mb-1 rounded bg-slate-500 px-2 py-1 text-[11px] font-bold text-white hover:bg-primary-600"
                    title="Selecionar todos os dentes superiores"
                  >
                    SUP
                  </button>
                  <div className="flex flex-wrap justify-center gap-0.5 border-b border-dashed border-slate-300 pb-1">
                    {dentesPorDenticao().superiores.map((dente) => toothButton(dente, "sup"))}
                  </div>
                </div>
                <div className="flex items-start justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => selecionarArcada("inf")}
                    className="mt-1 rounded bg-slate-500 px-2 py-1 text-[11px] font-bold text-white hover:bg-primary-600"
                    title="Selecionar todos os dentes inferiores"
                  >
                    INF
                  </button>
                  <div className="flex flex-wrap justify-center gap-0.5 pt-1">
                    {dentesPorDenticao().inferiores.map((dente) => toothButton(dente, "inf"))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-3 text-left text-[11px] font-semibold text-emerald-600">
                Dentes Selecionados:{" "}
                {renderDentesSelecionados()}
              </div>
              <div className="mb-5">
                <Textarea
                  label="Observações / Instruções técnicas"
                  value={form.instrucoes}
                  onChange={(e) => setForm({ ...form, instrucoes: e.target.value })}
                  placeholder="Descreva todos os detalhes do trabalho, ajustes, material, cor, acabamento, prova, entrega..."
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setAbaServico("etapas")}
                  className={classeAbaOs("etapas")}
                >
                  Etapas
                </button>
                {exibeAbaProdutos && (
                  <button
                    type="button"
                    onClick={() => setAbaServico("produtos")}
                    className={classeAbaOs("produtos")}
                  >
                    {abaServico === "produtos" ? "Produtos" : "PRODUTOS"}
                  </button>
                )}
                {exibeAbaColaboradores && (
                  <button
                    type="button"
                    onClick={() => setAbaServico("colaboradores")}
                    className={classeAbaOs("colaboradores")}
                  >
                    Colaboradores / Comissões
                  </button>
                )}
                {exibeAbaTerceirizados && (
                  <button
                    type="button"
                    onClick={() => setAbaServico("terceirizados")}
                    className={classeAbaOs("terceirizados")}
                  >
                    Serviços Terceirizados / Comissões
                  </button>
                )}
              </div>

              <div
                className={`mt-3 rounded border border-slate-200 p-3 text-left ${
                  abaServico === "etapas" ? "bg-white" : "bg-slate-50"
                }`}
              >
                {abaServico === "etapas" && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-800">Etapas</span>
                      <button
                        type="button"
                        className="rounded bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-700"
                        title="Recurso em teste no Smart Prótese"
                      >
                        Buscar Melhor data e horário com IA (em teste)
                      </button>
                    </div>

                    <div className="max-h-[min(420px,52vh)] space-y-3 overflow-y-auto overflow-x-hidden pr-1">
                      {etapas.map((etapa, index) => {
                        const { data: dataEtapa, hora: horaEtapa } = partesPrazoEtapaOs(etapa.prazo);
                        const setorRotulo = rotuloSetorEtapa(etapa);
                        return (
                          <div
                            key={`${etapa.nome}-${index}`}
                            className="rounded border border-slate-200 bg-white p-3 shadow-sm"
                          >
                            <div className="mb-3 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-semibold text-slate-800">
                                  {nomeEtapaSemSetor(etapa.nome)}
                                </span>
                                <Info
                                  className="h-4 w-4 shrink-0 text-primary-600"
                                  aria-hidden
                                />
                              </div>
                              <span className="text-xs font-medium text-primary-600">{setorRotulo}</span>
                            </div>

                            <div className="grid items-end gap-3 md:grid-cols-[minmax(9rem,1fr)_minmax(6rem,0.75fr)_minmax(12rem,1.6fr)_minmax(9rem,1.1fr)_auto]">
                              <div>
                                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                  Prazo
                                </label>
                                <div className="flex items-center gap-2 rounded border border-slate-300 bg-white px-2 py-0.5">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 shrink-0 accent-primary-600"
                                    aria-label={`Confirmar prazo de ${nomeEtapaSemSetor(etapa.nome)}`}
                                  />
                                  <CampoDataBr
                                    value={dataEtapa}
                                    onChange={(data) =>
                                      atualizarPrazoEtapaOs(index, data, horaEtapa)
                                    }
                                    placeholder="dd/mm/aaaa"
                                    className="min-w-0 flex-1 space-y-0"
                                    inputClassName="h-8 border-0 px-1 py-1 pr-8 shadow-none focus:ring-0"
                                    iconPosition="right"
                                    forceClose={calendarioEtapaAberto !== index}
                                    onCalendarOpenChange={(open) =>
                                      setCalendarioEtapaAberto(open ? index : null)
                                    }
                                  />
                                </div>
                              </div>

                              <CampoHoraBr
                                label="Hora"
                                value={horaEtapa}
                                onChange={(hora) =>
                                  atualizarPrazoEtapaOs(index, dataEtapa, hora)
                                }
                                placeholder="00:00"
                                inputClassName="h-10 py-2"
                              />

                              <Select
                                label="Colaborador"
                                value={etapa.responsavel}
                                onChange={(e) =>
                                  setEtapas((atuais) =>
                                    atuais.map((item, i) =>
                                      i === index
                                        ? sincronizarComissaoEtapa({
                                            ...item,
                                            responsavel: e.target.value,
                                          })
                                        : item
                                    )
                                  )
                                }
                              >
                                <option value="">Selecione um colaborador</option>
                                {etapa.responsavel &&
                                  !colaboradoresOpcoes.some(
                                    (colaborador) => colaborador.nome === etapa.responsavel
                                  ) && (
                                    <option value={etapa.responsavel}>{etapa.responsavel}</option>
                                  )}
                                {colaboradoresOpcoes.map((colaborador) => (
                                  <option key={colaborador.id} value={colaborador.nome}>
                                    {colaborador.nome}
                                  </option>
                                ))}
                              </Select>

                              <div className="space-y-1">
                                <label className="block text-[11px] font-medium text-slate-600">
                                  Valor Comissão
                                </label>
                                <div className="flex h-10 overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
                                  <span className="flex w-10 shrink-0 items-center justify-center border-r border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                                    R$
                                  </span>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={etapa.comissaoReais || "0,00"}
                                    onChange={(e) =>
                                      atualizarComissaoReaisEtapa(index, e.target.value)
                                    }
                                    className="h-full w-full bg-transparent px-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-primary-500/20"
                                    {...propsInputComSelecaoAoFocar({})}
                                  />
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => setEtapas((atuais) => atuais.filter((_, i) => i !== index))}
                                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded bg-red-500 text-white hover:bg-red-600"
                                title="Excluir etapa"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {abaServico === "produtos" && (
                  <div className="space-y-3">
                    {produtosOs.length === 0 && (
                      <button
                        type="button"
                        onClick={adicionarLinhaProduto}
                        className="w-full rounded bg-primary-600 px-3 py-2 text-xs font-medium text-white hover:bg-primary-700"
                      >
                        + Adicionar Produto
                      </button>
                    )}
                    {produtosOs.map((produtoOs, index) => (
                      <div
                        key={`${produtoOs.produtoId}-${index}`}
                        className="grid gap-3 rounded border border-slate-200 bg-white p-3 md:grid-cols-[1.4fr_0.7fr_1fr_1fr_auto]"
                      >
                        <Select
                          label="Produto cadastrado"
                          value={produtoOs.produtoId}
                          onChange={(e) => {
                            const produto = produtosTabelaPrecoOs.find(
                              (item) => item.id === e.target.value
                            );
                            const valor =
                              produto?.valor !== undefined
                                ? produto.valor.toLocaleString("pt-BR", {
                                    style: "currency",
                                    currency: "BRL",
                                  })
                                : produtoOs.valor;

                            setProdutosOs((atuais) =>
                              atuais.map((item, i) =>
                                i === index ? { ...item, produtoId: e.target.value, valor } : item
                              )
                            );
                          }}
                        >
                          <option value="">Selecione um produto</option>
                          {produtoOs.produtoId &&
                            !produtosTabelaPrecoOs.some(
                              (produto) => produto.id === produtoOs.produtoId
                            ) && (
                              <option value={produtoOs.produtoId}>
                                {produtoFromItem({
                                  id: "",
                                  servico: `Produto: ${produtoOs.observacao || produtoOs.produtoId}`,
                                  numeroDente: "-",
                                  corDente: "-",
                                  quantidade: "1",
                                  valor: 0,
                                  produtoId: produtoOs.produtoId,
                                })?.nome || produtoOs.produtoId}
                              </option>
                            )}
                          {produtosTabelaPrecoOs.map((produto) => (
                            <option key={produto.id} value={produto.id}>
                              {produto.nome} -{" "}
                              {produto.valor.toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })}
                            </option>
                          ))}
                        </Select>
                        <Input
                          label="Quantidade"
                          type="number"
                          min="1"
                          value={produtoOs.quantidade}
                          onChange={(e) =>
                            setProdutosOs((atuais) =>
                              atuais.map((item, i) =>
                                i === index ? { ...item, quantidade: e.target.value } : item
                              )
                            )
                          }
                        />
                        <Input
                          label="Valor"
                          selectOnFocus
                          value={produtoOs.valor}
                          onChange={(e) => {
                            const valor = formatCurrencyInput(e.target.value);
                            setProdutosOs((atuais) =>
                              atuais.map((item, i) =>
                                i === index ? { ...item, valor } : item
                              )
                            );
                            if (index === 0) setForm({ ...form, valor });
                          }}
                        />
                        <Input
                          label="Observação"
                          value={produtoOs.observacao}
                          onChange={(e) =>
                            setProdutosOs((atuais) =>
                              atuais.map((item, i) =>
                                i === index ? { ...item, observacao: e.target.value } : item
                              )
                            )
                          }
                          placeholder="Lote, marca ou detalhe"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const proximos = produtosOs.filter((_, i) => i !== index);
                            setProdutosOs(proximos);
                            if (index === 0) {
                              setForm({
                                ...form,
                                produtoId: "",
                              });
                            }
                          }}
                          className="mt-6 inline-flex h-10 items-center justify-center rounded border border-red-200 px-3 text-red-600 hover:bg-red-50"
                          title="Excluir produto"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    {produtosOs.length > 0 && (
                      <button
                        type="button"
                        onClick={adicionarLinhaProduto}
                        className="w-full rounded bg-primary-600 px-3 py-2 text-xs font-medium text-white hover:bg-primary-700"
                      >
                        + Adicionar Produto
                      </button>
                    )}

                  </div>
                )}

                {abaServico === "colaboradores" && exibeAbaColaboradores && (
                  <div className="space-y-3">
                    <p className="text-[10px] text-slate-500">
                      Colaboradores e comissões cadastrados na tabela de preços do serviço{" "}
                      <span className="font-medium text-slate-700">{servicoOsAtual?.nome}</span>.
                    </p>
                    {colaboradores.length === 0 && (
                      <button
                        type="button"
                        onClick={adicionarLinhaColaborador}
                        className="w-full rounded bg-primary-600 px-3 py-2 text-xs font-medium text-white hover:bg-primary-700"
                      >
                        + Adicionar Colaborador
                      </button>
                    )}
                    {colaboradores.map((colaborador, index) => (
                      <div
                        key={`${colaborador.nome}-${index}`}
                        className="grid gap-3 rounded border border-slate-200 bg-white p-3 md:grid-cols-[1fr_1fr_1fr_auto]"
                      >
                        <Select
                          label="Colaborador"
                          value={colaborador.nome}
                          onChange={(e) => selecionarColaboradorOs(index, e.target.value)}
                        >
                          <option value="">Selecione um colaborador</option>
                          {colaborador.nome &&
                            !colaboradoresComissaoServico.some((c) => c.nome === colaborador.nome) && (
                              <option value={colaborador.nome}>{colaborador.nome}</option>
                            )}
                          {colaboradoresComissaoServico.map((opcao) => (
                            <option key={opcao.id || opcao.nome} value={opcao.nome}>
                              {opcao.nome}
                            </option>
                          ))}
                        </Select>
                        <Input
                          label="Comissão (%)"
                          value={colaborador.comissao}
                          onChange={(e) =>
                            setColaboradores((atuais) =>
                              atuais.map((item, i) =>
                                i === index
                                  ? {
                                      ...item,
                                      comissao: formatarComissaoPercentInput(e.target.value),
                                    }
                                  : item
                              )
                            )
                          }
                          placeholder="0,00%"
                        />
                        {modelosEtapasOs.length > 0 ? (
                          <Select
                            label="Etapa"
                            value={colaborador.etapa}
                            onChange={(e) =>
                              setColaboradores((atuais) =>
                                atuais.map((item, i) =>
                                  i === index ? { ...item, etapa: e.target.value } : item
                                )
                              )
                            }
                          >
                            <option value="">Selecione uma etapa</option>
                            {colaborador.etapa &&
                              !modelosEtapasOs.some((m) => m.nome === colaborador.etapa) && (
                                <option value={colaborador.etapa}>{colaborador.etapa}</option>
                              )}
                            {modelosEtapasOs.map((modelo) => (
                              <option key={modelo.id} value={modelo.nome}>
                                {modelo.nome}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <Input
                            label="Etapa"
                            value={colaborador.etapa}
                            onChange={(e) =>
                              setColaboradores((atuais) =>
                                atuais.map((item, i) =>
                                  i === index ? { ...item, etapa: e.target.value } : item
                                )
                              )
                            }
                            placeholder="Produção, prova, finalizado..."
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const proximos = colaboradores.filter((_, i) => i !== index);
                            setColaboradores(proximos);
                          }}
                          className="mt-6 inline-flex h-10 items-center justify-center rounded border border-red-200 px-3 text-red-600 hover:bg-red-50"
                          title="Excluir colaborador"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    {colaboradores.length > 0 && (
                      <button
                        type="button"
                        onClick={adicionarLinhaColaborador}
                        className="w-full rounded bg-primary-600 px-3 py-2 text-xs font-medium text-white hover:bg-primary-700"
                      >
                        + Adicionar Colaborador
                      </button>
                    )}
                  </div>
                )}

                {abaServico === "terceirizados" && exibeAbaTerceirizados && (
                  <div className="space-y-3">
                    <p className="text-[10px] text-slate-500">
                      Serviços terceirizados cadastrados na tabela de preços do serviço{" "}
                      <span className="font-medium text-slate-700">{servicoOsAtual?.nome}</span>.
                    </p>
                    {terceirizados.length === 0 && (
                      <button
                        type="button"
                        onClick={adicionarLinhaTerceirizado}
                        className="w-full rounded bg-primary-600 px-3 py-2 text-xs font-medium text-white hover:bg-primary-700"
                      >
                        + Adicionar Terceirizado
                      </button>
                    )}
                    {terceirizados.map((terceiro, index) => (
                      <div
                        key={`${terceiro.nome}-${index}`}
                        className="grid gap-3 rounded border border-slate-200 bg-white p-3 md:grid-cols-[1fr_1fr_1fr_auto]"
                      >
                        <Select
                          label="Terceirizado"
                          value={terceiro.nome}
                          onChange={(e) => selecionarTerceirizado(index, e.target.value)}
                        >
                          <option value="">Selecione um terceirizado</option>
                          {terceiro.nome &&
                            !terceirizadosComissaoServico.some((c) => c.nome === terceiro.nome) && (
                              <option value={terceiro.nome}>{terceiro.nome}</option>
                            )}
                          {terceirizadosComissaoServico.map((opcao) => (
                            <option key={opcao.id || opcao.nome} value={opcao.nome}>
                              {opcao.nome}
                            </option>
                          ))}
                        </Select>
                        <Input
                          label="Serviço"
                          value={terceiro.servico}
                          onChange={(e) =>
                            setTerceirizados((atuais) =>
                              atuais.map((item, i) =>
                                i === index ? { ...item, servico: e.target.value } : item
                              )
                            )
                          }
                          placeholder="Serviço terceirizado"
                        />
                        <Input
                          label="Comissão / Custo"
                          value={terceiro.custo}
                          onChange={(e) =>
                            setTerceirizados((atuais) =>
                              atuais.map((item, i) =>
                                i === index
                                  ? { ...item, custo: formatCurrencyInput(e.target.value) }
                                  : item
                              )
                            )
                          }
                          placeholder="R$ 0,00"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const proximos = terceirizados.filter((_, i) => i !== index);
                            setTerceirizados(proximos);
                          }}
                          className="mt-6 inline-flex h-10 items-center justify-center rounded border border-red-200 px-3 text-red-600 hover:bg-red-50"
                          title="Excluir serviço terceirizado"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    {terceirizados.length > 0 && (
                      <button
                        type="button"
                        onClick={adicionarLinhaTerceirizado}
                        className="w-full rounded bg-primary-600 px-3 py-2 text-xs font-medium text-white hover:bg-primary-700"
                      >
                        + Adicionar Terceirizado
                      </button>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={adicionarServico}
                className={`mt-4 flex w-full items-center justify-center gap-2 rounded px-3 py-2 text-xs font-medium text-white shadow-sm ${
                  avisoAdicionarServico
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-emerald-500 hover:bg-emerald-600"
                }`}
              >
                {avisoAdicionarServico ? <AlertTriangle className="h-4 w-4" /> : null}
                {avisoAdicionarServico || (itemSelecionadoId ? "Atualizar Item Selecionado" : "+ Adicionar Serviço")}
              </button>

              {renderItensAdicionados()}
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-2 border-t border-slate-100 p-4">
          <Button type="button" variant="outline" onClick={() => router.push("/app/producao/controle")}>
            Cancelar
          </Button>
          <Button type="submit" disabled={salvando}>
            {salvando ? <Plus className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {salvando ? "Salvando..." : editId ? "Salvar Alterações" : "Salvar Ordem de Serviço"}
          </Button>
        </div>
      </form>

      <Modal
        open={modalMaterialAberto}
        onClose={() => setModalMaterialAberto(false)}
        title="Cadastrar Material"
        size="sm"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            adicionarMaterial();
          }}
          className="space-y-4 text-[11px] text-slate-600"
        >
          <Input
            label="Material"
            value={novoMaterial}
            onChange={(event) => setNovoMaterial(event.target.value)}
            placeholder="Digite o nome do material"
            required
          />
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="submit" size="sm">
              Cadastrar Material
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setModalMaterialAberto(false)}>
              Fechar
            </Button>
          </div>
        </form>
      </Modal>

      <ImprimirOsModal
        open={!!imprimirOsAposSalvar}
        onClose={() => void fecharModalImpressaoAposSalvar()}
        trabalho={imprimirOsAposSalvar?.trabalho ?? null}
        multiplosSegmentos={imprimirOsAposSalvar?.multiplosSegmentos ?? false}
      />
    </div>
  );
}
