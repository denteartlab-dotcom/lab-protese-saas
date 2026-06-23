"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Barcode, Minus, Plus, Upload } from "lucide-react";
import {
  AnexosReciboCampo,
  type AnexosReciboCampoRef,
} from "@/components/financeiro/AnexosReciboCampo";
import {
  ANEXOS_FINANCEIRO_VAZIOS,
  carregarEntidadesDespesaLocal,
  extrairDadosEdicaoDespesa,
  labelNomeEntidadeDespesa,
  desempacotarDespesa,
  TIPOS_FORNECEDOR_DESPESA,
  type AnexoDespesa,
  type EntidadeDespesa,
  type LancamentoDespesaDetalhe,
} from "@/lib/lancamento-despesa";
import { CampoDataBr } from "@/components/ui";
import { SelectPesquisavel } from "@/components/SelectPesquisavel";
import { dateToBrShort, somarDiasBr } from "@/lib/datas-br";
import { parseNotaFiscalArquivo } from "@/lib/nfe-import";
import {
  encontrarFornecedorPorNfe,
  formatMoneyBrNfe,
  formatQuantidadeNfe,
  lerFornecedoresComCnpj,
} from "@/lib/nfe-xml";
import { PlanoContasCategoriaSelect } from "@/components/financeiro/PlanoContasCategoriaSelect";
import {
  carregarPlanoContas,
  categoriaPadraoLancamento,
} from "@/lib/plano-contas";
import { cn } from "@/lib/utils";
import type { ConciliacaoInicial } from "@/lib/conciliacao-lancamento";
import { InputLeitorCodigoBoleto } from "@/components/InputLeitorCodigoBoleto";
import {
  indiceParcelaParaLeituraBoleto,
  mensagemLeituraBoleto,
  parseLeituraBoleto,
} from "@/lib/codigo-barras-boleto";

export type ItemReceitaLinha = {
  id: string;
  produto: string;
  descricao: string;
  quantidade: string;
  custoUnitario: string;
};

export type ParcelaReceitaLinha = {
  parcela: string;
  formaPagamento: string;
  conta: string;
  vencimento: string;
  codigoBarrasPix: string;
  valor: string;
  pago: boolean;
};

export type LancarReceitaPayload = {
  clienteId: string;
  entidadeNome?: string;
  tipoCliente: string;
  categoria: string;
  dataLancamento: string;
  notaFiscalRef: string;
  receitaFixa: boolean;
  itens: ItemReceitaLinha[];
  parcelas: ParcelaReceitaLinha[];
  descontoTipo: "percentual" | "valor";
  desconto: string;
  observacoes: string;
  valorBruto: number;
  totalLiquido: number;
  anexos?: AnexoDespesa[];
};

export type ModoLancamento = "receita" | "despesa";

type ClienteOpt = { id: string; nome: string };

const labelClass = "mb-1 block text-[11px] font-medium text-slate-600";
const inputClass =
  "h-9 w-full rounded border border-slate-300 bg-white px-2.5 text-[12px] text-slate-800 outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]";
const selectClass = inputClass;

function novoItem(): ItemReceitaLinha {
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    produto: "",
    descricao: "",
    quantidade: "1",
    custoUnitario: "0,00",
  };
}

function parseMoney(value: string) {
  return (
    Number(
      value
        .replace(/[^\d,.-]/g, "")
        .replace(/\./g, "")
        .replace(",", ".")
    ) || 0
  );
}

function formatMoneyInput(value: string) {
  const amount = Number(value.replace(/\D/g, "")) / 100;
  return amount.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: LancarReceitaPayload) => void | Promise<void>;
  /** Clientes (receita) ou fornecedores (despesa). */
  entidades: ClienteOpt[];
  modo?: ModoLancamento;
  salvando?: boolean;
  tituloEdicao?: string;
  /** Arquivos já salvos (edição). */
  anexosIniciais?: AnexoDespesa[];
  /** Despesa em edição (Contas a Pagar). */
  lancamentoEdicao?: LancamentoDespesaDetalhe | null;
  todosLancamentosEdicao?: LancamentoDespesaDetalhe[];
  /** Layout Smart Prótese para conciliação OFX. */
  variante?: "padrao" | "conciliacao-smart";
  conciliacaoInicial?: ConciliacaoInicial | null;
  contasBancarias?: { nome: string }[];
  overlayZIndex?: number;
};

const cfgModo = {
  receita: {
    titulo: "Lançar Receita",
    tipo: "Tipo Cliente",
    nome: "Nome do Cliente",
    fixa: "Receita Fixa",
    tipoPadrao: "cliente",
    categoriaPadrao: "Receitas de Serviços",
    dataModal: "lancar-receita-smart",
    tiposEntidade: [
      { value: "cliente", label: "Cliente" },
      { value: "particular", label: "Particular" },
      { value: "convenio", label: "Convênio" },
    ],
  },
  despesa: {
    titulo: "Lançar Despesa",
    tipo: "Tipo Fornecedor",
    nome: "Nome do Fornecedor",
    fixa: "Despesa Fixa",
    tipoPadrao: "fornecedores",
    categoriaPadrao: "Guia de Simples Nacional",
    dataModal: "lancar-despesa-smart",
    tiposEntidade: TIPOS_FORNECEDOR_DESPESA,
  },
} as const;

export function LancarReceitaModal({
  open,
  onClose,
  onSubmit,
  entidades,
  modo = "receita",
  salvando = false,
  tituloEdicao,
  anexosIniciais = ANEXOS_FINANCEIRO_VAZIOS,
  lancamentoEdicao = null,
  todosLancamentosEdicao = [],
  variante = "padrao",
  conciliacaoInicial = null,
  contasBancarias = [],
  overlayZIndex = 9999,
}: Props) {
  const ehConciliacao = variante === "conciliacao-smart";
  const cfg = cfgModo[modo];
  const secaoPlano = modo === "receita" ? "receitas" : "despesas";
  const [tipoCliente, setTipoCliente] = useState<string>(cfg.tipoPadrao);
  const [clienteId, setClienteId] = useState("");
  const [categoria, setCategoria] = useState<string>(cfg.categoriaPadrao);
  const [dataLancamento, setDataLancamento] = useState(dateToBrShort(new Date()));
  const [notaFiscalRef, setNotaFiscalRef] = useState("");
  const [receitaFixa, setReceitaFixa] = useState(false);
  const [itens, setItens] = useState<ItemReceitaLinha[]>([novoItem()]);
  const [codigoBarras, setCodigoBarras] = useState("");
  const [descontoTipo, setDescontoTipo] = useState<"percentual" | "valor">("percentual");
  const [desconto, setDesconto] = useState("0,00");
  const [numParcelas, setNumParcelas] = useState(1);
  const [parcelas, setParcelas] = useState<ParcelaReceitaLinha[]>([
    {
      parcela: "1/1",
      formaPagamento: "",
      conta: "Caixa Principal",
      vencimento: dateToBrShort(new Date()),
      codigoBarrasPix: "",
      valor: "0,00",
      pago: false,
    },
  ]);
  const [observacoes, setObservacoes] = useState("");
  const [semOs, setSemOs] = useState(true);
  const [valorDireto, setValorDireto] = useState("0,00");
  const [descricaoDireta, setDescricaoDireta] = useState("");
  const [jurosParcela, setJurosParcela] = useState("0,00");
  const [arquivoNota, setArquivoNota] = useState<File | null>(null);
  const [parseandoNota, setParseandoNota] = useState(false);
  const [feedbackNota, setFeedbackNota] = useState<{
    tipo: "ok" | "erro";
    texto: string;
  } | null>(null);
  const [feedbackLeitorBoleto, setFeedbackLeitorBoleto] = useState<{
    tipo: "ok" | "erro";
    texto: string;
  } | null>(null);
  const [leitorBoletoAtivo, setLeitorBoletoAtivo] = useState(false);
  const leitorBoletoRef = useRef<HTMLInputElement>(null);
  const [portalPronto, setPortalPronto] = useState(false);
  const [entidadesDespesa, setEntidadesDespesa] = useState<ClienteOpt[]>([]);
  const [cadastrando, setCadastrando] = useState(false);
  const submitLockRef = useRef(false);
  const anexosRef = useRef<AnexosReciboCampoRef>(null);
  const parcelasGeracaoRef = useRef({ numParcelas: 1, dataLancamento: "" });
  const nomeEntidadeEdicaoRef = useRef("");
  const ocupado = cadastrando || salvando;
  const pastaAnexos = modo === "despesa" ? "despesas" : "receitas";

  useEffect(() => {
    setPortalPronto(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (ehConciliacao && conciliacaoInicial) return;
    if (lancamentoEdicao && modo === "despesa") return;

    setTipoCliente(cfg.tipoPadrao);
    setClienteId("");
    nomeEntidadeEdicaoRef.current = "";
    const plano = carregarPlanoContas();
    setCategoria(
      categoriaPadraoLancamento(plano, secaoPlano) || cfg.categoriaPadrao
    );
    setDataLancamento(dateToBrShort(new Date()));
    setNotaFiscalRef("");
    setReceitaFixa(false);
    setItens([novoItem()]);
    setCodigoBarras("");
    setDescontoTipo("percentual");
    setDesconto("0,00");
    setNumParcelas(1);
    parcelasGeracaoRef.current = { numParcelas: 0, dataLancamento: "" };
    setObservacoes("");
    setArquivoNota(null);
    setParseandoNota(false);
    setFeedbackNota(null);
    setFeedbackLeitorBoleto(null);
    setLeitorBoletoAtivo(false);
  }, [
    open,
    cfg.tipoPadrao,
    cfg.categoriaPadrao,
    secaoPlano,
    modo,
    lancamentoEdicao,
    ehConciliacao,
    conciliacaoInicial,
  ]);

  useEffect(() => {
    if (!open || !ehConciliacao || !conciliacaoInicial) return;

    const dataBr = dateToBrShort(new Date(conciliacaoInicial.data));
    setSemOs(true);
    setTipoCliente(cfg.tipoPadrao);
    setClienteId("");
    setCategoria(
      conciliacaoInicial.categoria ||
        categoriaPadraoLancamento(carregarPlanoContas(), secaoPlano) ||
        cfg.categoriaPadrao
    );
    setDataLancamento(dataBr);
    setValorDireto(money(conciliacaoInicial.valor));
    setDescricaoDireta(conciliacaoInicial.descricao);
    setObservacoes(conciliacaoInicial.observacoes);
    setDescontoTipo("percentual");
    setDesconto("0,00");
    setJurosParcela("0,00");
    setNumParcelas(1);
    setItens([
      {
        id: `item-conc-${Date.now()}`,
        produto: "",
        descricao: conciliacaoInicial.descricao,
        quantidade: "1",
        custoUnitario: money(conciliacaoInicial.valor),
      },
    ]);
    setParcelas([
      {
        parcela: "1/1",
        formaPagamento: conciliacaoInicial.formaPagamento,
        conta: conciliacaoInicial.contaNome,
        vencimento: dataBr,
        codigoBarrasPix: "",
        valor: money(conciliacaoInicial.valor),
        pago: true,
      },
    ]);
    parcelasGeracaoRef.current = { numParcelas: 1, dataLancamento: dataBr };
  }, [open, ehConciliacao, conciliacaoInicial, cfg.tipoPadrao, cfg.categoriaPadrao, secaoPlano]);

  useEffect(() => {
    if (!open || modo !== "despesa" || !lancamentoEdicao) return;

    const dados = extrairDadosEdicaoDespesa(
      lancamentoEdicao,
      todosLancamentosEdicao
    );
    const dataBr =
      dados.parcelas[0]?.vencimento ||
      dateToBrShort(new Date(lancamentoEdicao.data));

    nomeEntidadeEdicaoRef.current = dados.nomeEntidade;
    setTipoCliente(dados.tipoFornecedor);
    setCategoria(dados.categoria || cfg.categoriaPadrao);
    setDataLancamento(dataBr);
    setNotaFiscalRef(dados.notaFiscalRef);
    const metaEdicao = desempacotarDespesa(lancamentoEdicao.descricao).meta;
    setReceitaFixa(Boolean(metaEdicao.fixa && metaEdicao.fixaAtiva !== false));
    setItens(
      dados.itens.length
        ? dados.itens.map((item) => ({
            id: item.id,
            produto: item.produto,
            descricao: item.descricao,
            quantidade: item.quantidade,
            custoUnitario: item.custoUnitario,
          }))
        : [novoItem()]
    );
    setObservacoes(dados.observacoes);
    setDescontoTipo("percentual");
    setDesconto("0,00");
    setNumParcelas(dados.numParcelas);
    setParcelas(
      dados.parcelas.map((parcela) => ({
        parcela: parcela.parcela,
        formaPagamento: parcela.formaPagamento,
        conta: parcela.conta,
        vencimento: parcela.vencimento,
        codigoBarrasPix: parcela.codigoBarrasPix,
        valor: parcela.valor,
        pago: parcela.pago,
      }))
    );
    parcelasGeracaoRef.current = {
      numParcelas: dados.numParcelas,
      dataLancamento: dataBr,
    };
    setArquivoNota(null);
    setParseandoNota(false);
    setFeedbackNota(null);
  }, [open, modo, lancamentoEdicao, todosLancamentosEdicao, cfg.categoriaPadrao]);

  useEffect(() => {
    if (!open || modo !== "despesa") return;
    if (!lancamentoEdicao) setClienteId("");
    let cancelado = false;

    async function carregarEntidades() {
      if (tipoCliente === "clientes") {
        try {
          const res = await fetch("/api/clientes");
          const data = await res.json();
          if (cancelado) return;
          const lista = Array.isArray(data)
            ? data
                .map((item: { id?: string; nome?: string }) => ({
                  id: String(item.id || ""),
                  nome: String(item.nome || "").trim(),
                }))
                .filter((item) => item.id && item.nome)
            : [];
          setEntidadesDespesa(lista);
        } catch {
          if (!cancelado) setEntidadesDespesa([]);
        }
        return;
      }

      const tipo = tipoCliente as Exclude<EntidadeDespesa, "todos">;
      if (!cancelado) {
        setEntidadesDespesa(carregarEntidadesDespesaLocal(tipo));
      }
    }

    void carregarEntidades();
    return () => {
      cancelado = true;
    };
  }, [open, modo, tipoCliente, lancamentoEdicao]);

  useEffect(() => {
    if (!open || modo !== "despesa" || !lancamentoEdicao) return;
    const nome = nomeEntidadeEdicaoRef.current.trim();
    if (!nome) return;
    const match = entidadesDespesa.find(
      (item) => item.nome.trim().toLowerCase() === nome.toLowerCase()
    );
    if (match) setClienteId(match.id);
  }, [open, modo, lancamentoEdicao, entidadesDespesa]);

  const entidadesLista = modo === "despesa" ? entidadesDespesa : entidades;
  const labelNomeEntidade =
    modo === "despesa" ? labelNomeEntidadeDespesa(tipoCliente) : cfg.nome;

  async function importarArquivoNotaFiscal(file: File | null) {
    setArquivoNota(file);
    setFeedbackNota(null);
    if (!file) return;

    setParseandoNota(true);
    try {
      const dados = await parseNotaFiscalArquivo(file);

      setNotaFiscalRef(dados.referencia);
      setDataLancamento(dados.dataEmissao);

      let fornecedorVinculado = "";
      if (modo === "despesa") {
        setTipoCliente("fornecedores");
        const cadastro = lerFornecedoresComCnpj();
        const listaMatch =
          cadastro.length > 0
            ? cadastro
            : carregarEntidadesDespesaLocal("fornecedores").map((e) => ({
                id: e.id,
                nome: e.nome,
              }));
        fornecedorVinculado = encontrarFornecedorPorNfe(
          dados.emitenteNome,
          dados.emitenteCnpj,
          listaMatch
        );
        if (fornecedorVinculado) {
          setClienteId(fornecedorVinculado);
        }
      }

      setItens(
        dados.itens.map((item) => ({
          id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          produto: item.produto,
          descricao: item.descricao,
          quantidade: formatQuantidadeNfe(item.quantidade),
          custoUnitario: formatMoneyBrNfe(item.valorUnitario),
        }))
      );

      const emitenteInfo = [
        dados.emitenteNome,
        dados.emitenteCnpj ? `CNPJ ${dados.emitenteCnpj}` : "",
      ]
        .filter(Boolean)
        .join(" — ");

      if (!fornecedorVinculado && modo === "despesa" && emitenteInfo) {
        setObservacoes((atual) => {
          const prefixo = `Emitente NF-e: ${emitenteInfo}`;
          return atual.trim() ? `${prefixo}\n${atual}` : prefixo;
        });
      }

      const tipoArquivo = file.name.toLowerCase().endsWith(".pdf") ? "PDF" : "XML";
      setFeedbackNota({
        tipo: "ok",
        texto: fornecedorVinculado
          ? `NF-e (${tipoArquivo}) importada. Fornecedor e ${dados.itens.length} item(ns) preenchidos.`
          : `NF-e (${tipoArquivo}) importada. Valor e itens preenchidos.${emitenteInfo ? " Vincule o fornecedor manualmente." : ""}`,
      });
    } catch (err) {
      setFeedbackNota({
        tipo: "erro",
        texto:
          err instanceof Error
            ? err.message
            : "Não foi possível ler a nota fiscal.",
      });
    } finally {
      setParseandoNota(false);
    }
  }

  const valorBruto = useMemo(() => {
    if (ehConciliacao) {
      return parseMoney(valorDireto) + parseMoney(jurosParcela);
    }
    return itens.reduce((sum, item) => {
        const qtd = Number(item.quantidade.replace(",", ".")) || 0;
        return sum + parseMoney(item.custoUnitario) * qtd;
    }, 0);
  }, [ehConciliacao, valorDireto, jurosParcela, itens]);

  const descontoValor = useMemo(() => {
    const base = parseMoney(desconto);
    if (descontoTipo === "valor") return base;
    return valorBruto * (Math.min(Math.max(base, 0), 100) / 100);
  }, [desconto, descontoTipo, valorBruto]);

  const totalLiquido = Math.max(0, valorBruto - descontoValor);

  const valorParcelasTotal = useMemo(
    () => parcelas.reduce((sum, parcela) => sum + parseMoney(parcela.valor), 0),
    [parcelas]
  );

  const valorMinimoSalvar =
    modo === "despesa"
      ? Math.max(totalLiquido, valorParcelasTotal)
      : totalLiquido;

  useEffect(() => {
    if (!open || lancamentoEdicao) return;
    setDataLancamento(dateToBrShort(new Date()));
  }, [open, lancamentoEdicao]);

  useEffect(() => {
    if (!open || ehConciliacao) return;
    const valorParcela = numParcelas > 0 ? totalLiquido / numParcelas : 0;
    const recalcularVencimentos =
      parcelasGeracaoRef.current.numParcelas !== numParcelas ||
      parcelasGeracaoRef.current.dataLancamento !== dataLancamento;
    parcelasGeracaoRef.current = { numParcelas, dataLancamento };

    setParcelas((atual) => {
      return Array.from({ length: numParcelas }, (_, i) => {
        const existente = atual[i];
        return {
          parcela: `${i + 1}/${numParcelas}`,
          formaPagamento: existente?.formaPagamento ?? "",
          conta: existente?.conta ?? "Caixa Principal",
          vencimento: recalcularVencimentos
            ? somarDiasBr(dataLancamento, i * 30)
            : (existente?.vencimento ?? somarDiasBr(dataLancamento, i * 30)),
          codigoBarrasPix: existente?.codigoBarrasPix ?? "",
          valor: recalcularVencimentos
            ? money(valorParcela)
            : (existente?.valor ?? money(valorParcela)),
          pago: existente?.pago ?? false,
        };
      });
    });
  }, [numParcelas, totalLiquido, dataLancamento, open, ehConciliacao]);

  const opcoesConta = useMemo(() => {
    const nomes = new Set<string>(["Caixa Principal"]);
    for (const conta of contasBancarias) {
      if (conta.nome.trim()) nomes.add(conta.nome.trim());
    }
    return Array.from(nomes);
  }, [contasBancarias]);

  function atualizarItem(id: string, patch: Partial<ItemReceitaLinha>) {
    setItens((lista) =>
      lista.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  function subtotalItem(item: ItemReceitaLinha) {
    const qtd = Number(item.quantidade.replace(",", ".")) || 0;
    return parseMoney(item.custoUnitario) * qtd;
  }

  function atualizarParcela(index: number, patch: Partial<ParcelaReceitaLinha>) {
    setParcelas((lista) =>
      lista.map((p, i) => (i === index ? { ...p, ...patch } : p))
    );
  }

  const registrarLeituraBoleto = useCallback((bruto: string, indiceForcado?: number) => {
    const dados = parseLeituraBoleto(bruto);
    if (!dados) {
      setFeedbackLeitorBoleto({
        tipo: "erro",
        texto:
          "Código não reconhecido. Passe o leitor no boleto (44 ou 47 dígitos) ou cole o Pix copia e cola.",
      });
      return;
    }

    let indiceAplicado = -1;
    let totalParcelas = 0;

    setParcelas((lista) => {
      totalParcelas = lista.length;
      const indice =
        indiceForcado ?? indiceParcelaParaLeituraBoleto(lista, dados);
      indiceAplicado = indice;
      if (indice < 0) return lista;

      return lista.map((p, i) => {
        if (i !== indice) return p;
        const patch: Partial<ParcelaReceitaLinha> = {
          codigoBarrasPix: dados.ehPix ? dados.bruto : dados.linhaFormatada,
        };
        if (!p.formaPagamento.trim()) {
          patch.formaPagamento = dados.ehPix ? "Pix" : "Boleto";
        }
        if (dados.vencimentoBr) {
          patch.vencimento = dados.vencimentoBr;
        }
        if (dados.valor != null && parseMoney(p.valor) <= 0) {
          patch.valor = dados.valor.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        }
        return { ...p, ...patch };
      });
    });

    setCodigoBarras("");

    if (indiceAplicado < 0) {
      setFeedbackLeitorBoleto({
        tipo: "erro",
        texto: "Nenhuma parcela disponível para registrar o código.",
      });
      return;
    }

    setFeedbackLeitorBoleto({
      tipo: "ok",
      texto: mensagemLeituraBoleto(dados, indiceAplicado, totalParcelas || 1),
    });
    setLeitorBoletoAtivo(false);
  }, []);

  function alternarLeitorBoleto() {
    setLeitorBoletoAtivo((ativo) => {
      if (ativo) {
        leitorBoletoRef.current?.blur();
        return false;
      }
      setFeedbackLeitorBoleto(null);
      window.setTimeout(() => leitorBoletoRef.current?.focus(), 50);
      return true;
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitLockRef.current || ocupado) return;
    submitLockRef.current = true;
    setCadastrando(true);
    try {
      let anexos: AnexoDespesa[] | undefined;
      const lista = await anexosRef.current?.resolverAnexos();
      if (lista?.length) anexos = lista;
      const selecionada = entidadesLista.find((item) => item.id === clienteId);
      const itensEnvio = ehConciliacao
        ? [
            {
              id: itens[0]?.id || `item-conc-${Date.now()}`,
              produto: "",
              descricao: descricaoDireta,
              quantidade: "1",
              custoUnitario: valorDireto,
            },
          ]
        : itens;
      const parcelasEnvio = ehConciliacao
        ? parcelas.map((p) => ({
            ...p,
            valor: money(totalLiquido),
          }))
        : parcelas.map((parcela, index) => {
            if (modo !== "despesa" || index !== 0) return parcela;
            const codigo = codigoBarras.trim();
            if (!codigo || parcela.codigoBarrasPix.trim()) return parcela;
            return { ...parcela, codigoBarrasPix: codigo };
          });
      await onSubmit({
      clienteId,
        entidadeNome:
          selecionada?.nome || nomeEntidadeEdicaoRef.current || clienteId,
      tipoCliente,
      categoria,
      dataLancamento,
      notaFiscalRef,
      receitaFixa,
        itens: itensEnvio,
        parcelas: parcelasEnvio,
      descontoTipo,
      desconto,
      observacoes,
      valorBruto,
      totalLiquido,
        anexos,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Falha ao enviar os arquivos.");
    } finally {
      submitLockRef.current = false;
      setCadastrando(false);
    }
  }

  if (!open || !portalPronto) return null;

  const conteudo = (
    <div
      className="fixed inset-0 flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-6"
      style={{ zIndex: overlayZIndex }}
      data-modal={cfg.dataModal}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lancar-receita-titulo"
    >
      <div
        className="absolute inset-0"
        onClick={() => {
          if (!ocupado) onClose();
        }}
        aria-hidden
      />
      <div
        className={cn(
          "relative my-auto flex w-full flex-col rounded border border-slate-200 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.18)]",
          ehConciliacao ? "max-w-[min(1180px,92vw)]" : "max-w-[1060px]"
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
          <h2 id="lancar-receita-titulo" className="text-[14px] font-normal text-slate-800">
            {tituloEdicao || cfg.titulo}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-lg text-slate-400 hover:text-slate-600"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="max-h-[calc(100vh-5rem)] overflow-y-auto px-4 py-3 text-[11px] text-slate-700"
        >
          {ehConciliacao ? (
            <>
              {modo === "receita" ? (
                <label className="mb-3 flex cursor-pointer items-center gap-2 text-[12px] text-slate-700">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={semOs}
                    onClick={() => setSemOs((v) => !v)}
                    className={cn(
                      "relative h-5 w-9 shrink-0 rounded-full transition",
                      semOs ? "bg-[#4a90d9]" : "bg-slate-300"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition",
                        semOs ? "left-[18px]" : "left-0.5"
                      )}
                    />
                  </button>
                  Lançar uma Cobrança ou Outras Receitas sem O.S.
                </label>
              ) : null}

              <div className="mb-3">
                <label className={labelClass}>Categorias</label>
                <PlanoContasCategoriaSelect
                  secao={secaoPlano}
                  value={categoria}
                  onChange={setCategoria}
                  triggerClassName={selectClass}
                  menuEmPortal
                  required
                />
              </div>

              <div className="grid grid-cols-12 gap-3">
                {modo === "despesa" ? (
                  <>
                    <div className="col-span-12 md:col-span-3">
                      <label className={labelClass}>{cfg.tipo}</label>
                      <select
                        value={tipoCliente}
                        onChange={(e) => {
                          setTipoCliente(e.target.value);
                          setClienteId("");
                        }}
                        className={selectClass}
                      >
                        {cfg.tiposEntidade.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-12 md:col-span-4">
                      <label className={labelClass}>{labelNomeEntidade}</label>
                      <select
                        value={clienteId}
                        onChange={(e) => setClienteId(e.target.value)}
                        className={selectClass}
                      >
                        <option value="">Selecione</option>
                        {entidadesLista.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <div className="col-span-12 md:col-span-4">
                    <label className={labelClass}>Clientes</label>
                    <select
                      value={clienteId}
                      onChange={(e) => setClienteId(e.target.value)}
                      className={selectClass}
                    >
                      <option value="">Selecione</option>
                      {entidadesLista.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="col-span-6 md:col-span-2">
                  <label className={labelClass}>Valor</label>
                  <input
                    type="text"
                    value={valorDireto}
                    onChange={(e) => {
                      const fmt = formatMoneyInput(e.target.value);
                      setValorDireto(fmt);
                      setItens((lista) =>
                        lista.map((item, i) =>
                          i === 0 ? { ...item, custoUnitario: fmt } : item
                        )
                      );
                      setParcelas((lista) =>
                        lista.map((p, i) =>
                          i === 0 ? { ...p, valor: fmt } : p
                        )
                      );
                    }}
                    className={cn(inputClass, "text-right")}
                  />
                </div>
                <div
                  className={cn(
                    "col-span-6",
                    modo === "despesa" ? "md:col-span-3" : "md:col-span-6"
                  )}
                >
                  <label className={labelClass}>Descrição</label>
                  <input
                    type="text"
                    value={descricaoDireta}
                    onChange={(e) => {
                      setDescricaoDireta(e.target.value);
                      setItens((lista) =>
                        lista.map((item, i) =>
                          i === 0 ? { ...item, descricao: e.target.value } : item
                        )
                      );
                    }}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="mt-3 flex justify-end">
                <div className="w-full max-w-xs space-y-2 text-[12px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Valor Total</span>
                    <span className="font-medium text-slate-800">
                      {money(parseMoney(valorDireto))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-600">Desconto</span>
                    <div className="flex items-center gap-1">
                      <select
                        value={descontoTipo}
                        onChange={(e) =>
                          setDescontoTipo(e.target.value as "percentual" | "valor")
                        }
                        className="h-8 w-12 rounded border border-slate-300 text-center text-[11px]"
                      >
                        <option value="percentual">%</option>
                        <option value="valor">=</option>
                      </select>
                      <input
                        type="text"
                        value={desconto}
                        onChange={(e) =>
                          setDesconto(
                            descontoTipo === "valor"
                              ? formatMoneyInput(e.target.value)
                              : e.target.value.replace(/[^\d,.]/g, "")
                          )
                        }
                        className={cn(inputClass, "h-8 w-24 text-right")}
                      />
                      <span className="text-slate-500">{money(descontoValor)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                    <span className="font-semibold text-[#4a90d9]">Total Líquido</span>
                    <span className="text-[15px] font-bold text-[#4a90d9]">
                      {money(totalLiquido)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded border border-[#b8d4f0] bg-[#f0f7ff] p-3">
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-2 md:col-span-1">
                    <label className={labelClass}>Parcela</label>
                    <input
                      type="text"
                      readOnly
                      value={parcelas[0]?.parcela || "1/1"}
                      className={cn(inputClass, "bg-white text-center")}
                    />
                  </div>
                  <div className="col-span-5 md:col-span-2">
                    <label className={labelClass}>
                      {modo === "receita" ? "Forma Recebimento" : "Forma Pagamento"}
                    </label>
                    <select
                      value={parcelas[0]?.formaPagamento || ""}
                      onChange={(e) =>
                        atualizarParcela(0, { formaPagamento: e.target.value })
                      }
                      className={selectClass}
                    >
                      <option value="">Forma Pagamento</option>
                      <option value="Pix">Pix</option>
                      <option value="Dinheiro">Dinheiro</option>
                      <option value="Cartão">Cartão</option>
                      <option value="Boleto">Boleto</option>
                      <option value="Transferência">Transferência</option>
                    </select>
                  </div>
                  <div className="col-span-5 md:col-span-2">
                    <label className={labelClass}>Conta</label>
                    <select
                      value={parcelas[0]?.conta || ""}
                      onChange={(e) => atualizarParcela(0, { conta: e.target.value })}
                      className={selectClass}
                    >
                      {opcoesConta.map((nome) => (
                        <option key={nome} value={nome}>
                          {nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <label className={labelClass}>Vencimento</label>
                    <CampoDataBr
                      value={parcelas[0]?.vencimento || dataLancamento}
                      onChange={(v) => atualizarParcela(0, { vencimento: v })}
                      className="space-y-0"
                      inputClassName={inputClass}
                      calendarPosition="relative"
                    />
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <label className={labelClass}>Valor</label>
                    <input
                      type="text"
                      readOnly
                      value={money(totalLiquido)}
                      className={cn(inputClass, "bg-white text-right")}
                    />
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <label className={labelClass}>Juros</label>
                    <input
                      type="text"
                      value={jurosParcela}
                      onChange={(e) =>
                        setJurosParcela(formatMoneyInput(e.target.value))
                      }
                      className={cn(inputClass, "text-right")}
                    />
                  </div>
                  <div className="col-span-12 flex items-end justify-center md:col-span-1">
                    <div className="pb-1 text-center">
                      <label className="mb-1 block text-[10px] font-medium text-slate-600">
                        {modo === "receita" ? "Recebido" : "Pago"}
                      </label>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={parcelas[0]?.pago ?? true}
                        onClick={() =>
                          atualizarParcela(0, { pago: !parcelas[0]?.pago })
                        }
                        className={cn(
                          "relative mx-auto inline-flex h-5 w-9 rounded-full transition",
                          parcelas[0]?.pago ? "bg-[#4cae4c]" : "bg-slate-300"
                        )}
                      >
                        <span
                          className={cn(
                            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition",
                            parcelas[0]?.pago ? "left-[18px]" : "left-0.5"
                          )}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <label className={labelClass}>Observações</label>
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={4}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-[12px] outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]"
                />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                <button
                  type="submit"
                  disabled={ocupado || totalLiquido <= 0}
                  className="h-10 rounded bg-[#4a90d9] text-[13px] font-normal text-white hover:bg-[#3d7fc4] disabled:cursor-wait disabled:opacity-60"
                >
                  {ocupado ? "Cadastrando…" : "Cadastrar"}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={ocupado}
                  className="h-10 rounded border border-slate-300 bg-white text-[13px] font-normal text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Fechar
                </button>
              </div>
            </>
          ) : (
          <>
          <div className="grid grid-cols-12 items-end gap-x-3 gap-y-2">
            <div className="col-span-12 md:col-span-5">
              <label className={labelClass}>
                Nota fiscal — XML ou PDF (opcional)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={
                    parseandoNota
                      ? "Lendo nota fiscal…"
                      : arquivoNota?.name || ""
                  }
                  placeholder="Selecione XML ou PDF da NF-e"
                  className={cn(inputClass, "min-w-0 flex-1 bg-slate-50")}
                />
                <label
                  className={cn(
                    "inline-flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded border border-[#4a90d9] bg-white px-3 text-[12px] text-[#4a90d9] hover:bg-[#f0f7ff]",
                    parseandoNota && "pointer-events-none opacity-60"
                  )}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {parseandoNota ? "Lendo…" : "Upload"}
                  <input
                    type="file"
                    accept=".xml,.nfe,.pdf,application/xml,text/xml,application/pdf"
                    className="sr-only"
                    disabled={parseandoNota}
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      void importarArquivoNotaFiscal(file);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              {feedbackNota ? (
                <p
                  className={cn(
                    "mt-1 text-[10px]",
                    feedbackNota.tipo === "ok"
                      ? "text-emerald-600"
                      : "text-red-600"
                  )}
                >
                  {feedbackNota.texto}
                </p>
              ) : null}
            </div>
            <div className="col-span-6 md:col-span-2">
              <label className={labelClass}>Data de Lançamento</label>
              <CampoDataBr
                value={dataLancamento}
                onChange={setDataLancamento}
                className="space-y-0"
                inputClassName={inputClass}
              />
            </div>
            <div className="col-span-6 md:col-span-3">
              <label className={labelClass}>Nota Fiscal Referência</label>
              <input
                type="text"
                value={notaFiscalRef}
                onChange={(e) => setNotaFiscalRef(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="col-span-12 flex items-center justify-end gap-2 md:col-span-2 md:pb-0.5">
              <span className="text-[11px] text-slate-600">{cfg.fixa}</span>
              <button
                type="button"
                role="switch"
                aria-checked={receitaFixa}
                onClick={() => setReceitaFixa((v) => !v)}
                className={cn(
                  "relative h-5 w-9 shrink-0 rounded-full transition",
                  receitaFixa ? "bg-[#4a90d9]" : "bg-slate-300"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition",
                    receitaFixa ? "left-[18px]" : "left-0.5"
                  )}
                />
              </button>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-12 gap-3">
            <div className="col-span-12 md:col-span-3">
              <label className={labelClass}>{cfg.tipo}</label>
              <select
                value={tipoCliente}
                onChange={(e) => {
                  setTipoCliente(e.target.value);
                  setClienteId("");
                }}
                className={selectClass}
              >
                {cfg.tiposEntidade.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-12 md:col-span-6">
              <SelectPesquisavel
                label={labelNomeEntidade}
                value={clienteId}
                onChange={setClienteId}
                placeholder="Selecione"
                required={modo === "receita"}
                inputClassName={selectClass}
                menuEmPortal
                options={entidadesLista.map((c) => ({ value: c.id, label: c.nome }))}
              />
            </div>
            <div className="col-span-12 md:col-span-3">
              <label className={labelClass}>Categoria</label>
              <PlanoContasCategoriaSelect
                secao={secaoPlano}
                value={categoria}
                onChange={setCategoria}
                triggerClassName={selectClass}
                menuEmPortal
                required
              />
            </div>
          </div>

          <div className="mt-4">
            {modo === "despesa" ? (
              <div className="flex flex-col gap-1">
                <div
                  className={cn(
                    "flex h-9 w-full max-w-xl items-stretch overflow-hidden rounded border bg-white transition",
                    leitorBoletoAtivo
                      ? "border-emerald-500 ring-1 ring-emerald-500/30"
                      : "border-slate-300 focus-within:border-[#4a90d9] focus-within:ring-1 focus-within:ring-[#4a90d9]"
                  )}
                >
                  <button
                    type="button"
                    onClick={alternarLeitorBoleto}
                    className={cn(
                      "flex w-10 shrink-0 items-center justify-center border-r transition",
                      leitorBoletoAtivo
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                    )}
                    title={
                      leitorBoletoAtivo
                        ? "Desativar leitor USB"
                        : "Ativar leitor USB de código de barras"
                    }
                    aria-label={
                      leitorBoletoAtivo
                        ? "Desativar leitor de código de barras"
                        : "Ativar leitor de código de barras"
                    }
                    aria-pressed={leitorBoletoAtivo}
                  >
                    <Barcode className="h-5 w-5" />
                  </button>
                  {leitorBoletoAtivo ? (
                    <InputLeitorCodigoBoleto
                      inputRef={leitorBoletoRef}
                      value={codigoBarras}
                      onChange={setCodigoBarras}
                      onCodigoLido={registrarLeituraBoleto}
                      onCodigoInvalido={() =>
                        setFeedbackLeitorBoleto({
                          tipo: "erro",
                          texto:
                            "Código inválido. Use o leitor USB no boleto ou digite a linha digitável.",
                        })
                      }
                      placeholder="Passe o leitor USB no boleto..."
                      className="h-9 min-w-0 flex-1 border-0 bg-transparent px-2.5 font-mono text-[11px] outline-none focus:ring-0"
                      capturaGlobal
                      capturaGlobalAtivo={open && leitorBoletoAtivo}
                    />
                  ) : (
                    <input
                      type="text"
                      value={codigoBarras}
                      onChange={(e) => setCodigoBarras(e.target.value)}
                      placeholder="Leitor de Código de Barras"
                      className="h-9 min-w-0 flex-1 border-0 bg-transparent px-2.5 text-[12px] text-slate-800 outline-none"
                    />
                  )}
                </div>
                {feedbackLeitorBoleto ? (
                  <p
                    className={cn(
                      "text-[11px]",
                      feedbackLeitorBoleto.tipo === "ok"
                        ? "font-medium text-emerald-700"
                        : "font-medium text-amber-700"
                    )}
                  >
                    {feedbackLeitorBoleto.texto}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="flex max-w-xl items-center gap-2">
                <Barcode className="h-5 w-5 shrink-0 text-slate-500" />
                <input
                  type="text"
                  value={codigoBarras}
                  onChange={(e) => setCodigoBarras(e.target.value)}
                  placeholder="Leitor de Código de Barras"
                  className={cn(inputClass, "flex-1")}
                />
              </div>
            )}
          </div>

          <div className="mt-2 overflow-x-auto rounded border border-slate-200">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="bg-[#f5f6f8] text-[10px] font-semibold uppercase text-slate-500">
                  <th className="px-3 py-2 text-left">Produto</th>
                  <th className="px-3 py-2 text-left">Descrição</th>
                  <th className="px-3 py-2 text-center w-24">Quantidade</th>
                  <th className="px-3 py-2 text-right w-28">Custo Unitário</th>
                  <th className="px-3 py-2 text-right w-28">Subtotal</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {itens.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={item.produto}
                        onChange={(e) =>
                          atualizarItem(item.id, { produto: e.target.value })
                        }
                        className={inputClass}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={item.descricao}
                        onChange={(e) =>
                          atualizarItem(item.id, { descricao: e.target.value })
                        }
                        className={inputClass}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={item.quantidade}
                        onChange={(e) =>
                          atualizarItem(item.id, { quantidade: e.target.value })
                        }
                        className={cn(inputClass, "text-center")}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={item.custoUnitario}
                        onChange={(e) =>
                          atualizarItem(item.id, {
                            custoUnitario: formatMoneyInput(e.target.value),
                          })
                        }
                        className={cn(inputClass, "text-right")}
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-slate-800">
                      {money(subtotalItem(item))}
                    </td>
                    <td className="px-1 py-1.5">
                      {itens.length > 1 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setItens((lista) =>
                              lista.filter((i) => i.id !== item.id)
                            )
                          }
                          className="text-slate-400 hover:text-red-500"
                        >
                          ✕
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
            <button
              type="button"
              onClick={() => setItens((lista) => [...lista, novoItem()])}
              className="inline-flex items-center gap-1.5 rounded border border-[#4cae4c] bg-[#4cae4c] px-3 py-1.5 text-[12px] font-normal text-white hover:bg-[#449d44]"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar Item
            </button>
            <div className="w-full max-w-xs space-y-2 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Valor Total</span>
                <span className="font-medium text-slate-800">{money(valorBruto)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-600">Desconto</span>
                <div className="flex items-center gap-1">
                  <select
                    value={descontoTipo}
                    onChange={(e) =>
                      setDescontoTipo(e.target.value as "percentual" | "valor")
                    }
                    className="h-8 w-12 rounded border border-slate-300 text-center text-[11px]"
                  >
                    <option value="percentual">%</option>
                    <option value="valor">=</option>
                  </select>
                  <input
                    type="text"
                    value={desconto}
                    onChange={(e) =>
                      setDesconto(
                        descontoTipo === "valor"
                          ? formatMoneyInput(e.target.value)
                          : e.target.value.replace(/[^\d,.]/g, "")
                      )
                    }
                    className={cn(inputClass, "h-8 w-24 text-right")}
                  />
                  <span className="text-slate-500">{money(descontoValor)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                <span className="font-semibold text-[#4a90d9]">Total Líquido</span>
                <span className="text-[15px] font-bold text-[#4a90d9]">
                  {money(totalLiquido)}
                </span>
              </div>
            </div>
          </div>

          <p className="mt-6 text-center text-[12px] text-slate-500">
            Escolha a(s) forma(s) de pagamento
          </p>

          <div className="mt-2 flex items-center gap-2">
            <span className="text-[11px] text-slate-600">Parcelas</span>
            <button
              type="button"
              onClick={() => setNumParcelas((n) => Math.max(1, n - 1))}
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <input
              type="text"
              readOnly
              value={String(numParcelas)}
              className={cn(inputClass, "h-7 w-12 text-center")}
            />
            <button
              type="button"
              onClick={() => setNumParcelas((n) => Math.min(24, n + 1))}
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-2 overflow-x-auto rounded border border-slate-200">
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr className="bg-[#f5f6f8] text-[10px] font-semibold uppercase text-slate-500">
                  <th className="px-2 py-2 text-left w-16">Parcela</th>
                  <th className="px-2 py-2 text-left">Forma Pagamento</th>
                  <th className="px-2 py-2 text-left">Conta</th>
                  <th className="px-2 py-2 text-left">Vencimento</th>
                  <th className="px-2 py-2 text-left">Cod. Barras / Pix</th>
                  <th className="px-2 py-2 text-right w-24">Valor</th>
                  <th className="px-2 py-2 text-center w-14">Pago</th>
                </tr>
              </thead>
              <tbody>
                {parcelas.map((parcela, index) => (
                  <tr key={index} className="border-t border-slate-100">
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        readOnly
                        value={parcela.parcela}
                        className={cn(inputClass, "bg-slate-50 text-center")}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={parcela.formaPagamento}
                        onChange={(e) =>
                          atualizarParcela(index, {
                            formaPagamento: e.target.value,
                          })
                        }
                        className={selectClass}
                      >
                        <option value="">Selecione</option>
                        <option value="Pix">Pix</option>
                        <option value="Dinheiro">Dinheiro</option>
                        <option value="Cartão">Cartão</option>
                        <option value="Boleto">Boleto</option>
                        <option value="Transferência">Transferência</option>
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={parcela.conta}
                        onChange={(e) =>
                          atualizarParcela(index, { conta: e.target.value })
                        }
                        className={selectClass}
                      >
                        <option>Caixa Principal</option>
                        <option>Conta Bancária</option>
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <CampoDataBr
                        value={parcela.vencimento}
                        onChange={(v) => atualizarParcela(index, { vencimento: v })}
                        className="space-y-0"
                        inputClassName={inputClass}
                        calendarPosition="relative"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={parcela.codigoBarrasPix}
                        onChange={(e) =>
                          atualizarParcela(index, {
                            codigoBarrasPix: e.target.value,
                          })
                        }
                        placeholder="Digite o código ou Pix..."
                        className={inputClass}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={parcela.valor}
                        onChange={(e) =>
                          atualizarParcela(index, {
                            valor: formatMoneyInput(e.target.value),
                          })
                        }
                        className={cn(inputClass, "text-right")}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={parcela.pago}
                        onClick={() =>
                          atualizarParcela(index, { pago: !parcela.pago })
                        }
                        className={cn(
                          "relative mx-auto inline-flex h-5 w-9 rounded-full transition",
                          parcela.pago ? "bg-[#4a90d9]" : "bg-slate-300"
                        )}
                      >
                        <span
                          className={cn(
                            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition",
                            parcela.pago ? "left-[18px]" : "left-0.5"
                          )}
                        />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <label className={labelClass}>Observações</label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={4}
              className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-[12px] outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]"
            />
          </div>

          <AnexosReciboCampo
            ref={anexosRef}
            pasta={pastaAnexos}
            anexosIniciais={anexosIniciais}
            className="mt-4"
          />

          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
            <button
              type="submit"
              disabled={
                ocupado ||
                valorMinimoSalvar <= 0 ||
                (modo === "receita" && !clienteId)
              }
              className="h-10 rounded bg-[#4a90d9] text-[13px] font-normal text-white hover:bg-[#3d7fc4] disabled:cursor-wait disabled:opacity-60"
            >
              {ocupado
                ? tituloEdicao
                  ? "Salvando…"
                  : "Cadastrando…"
                : tituloEdicao
                  ? "Salvar"
                  : "Cadastrar"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={ocupado}
              className="h-10 rounded border border-slate-300 bg-white text-[13px] font-normal text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Fechar
            </button>
          </div>
          </>
          )}
        </form>
      </div>
    </div>
  );

  return createPortal(conteudo, document.body);
}

/** Alias para Contas a Pagar. */
export function LancarDespesaModal(
  props: Omit<Props, "modo"> & { modo?: never }
) {
  return <LancarReceitaModal {...props} modo="despesa" />;
}
