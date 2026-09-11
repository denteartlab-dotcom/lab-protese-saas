"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  FileSpreadsheet,
  ImagePlus,
  Plus,
  Printer,
  Send,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  calcularTotaisItens,
  itensSemPrecoOrcamento,
  totalLiquidoOrcamento,
  type ItemOrcamento,
  type Orcamento,
} from "@/lib/orcamentos-types";
import { propsInputComSelecaoAoFocar } from "@/lib/input-selecao";
import {
  exigeParcelamento,
  exigeValorDescontoVista,
  itemOrcamentoLinhaNova,
  normalizarParcelas,
  parseListaCondicoesPagamento,
  rotuloCondicoesPagamento,
  rotuloListaCondicoesPagamento,
  serializarListaCondicoesPagamento,
  type CondicoesPagamentoOrcamento,
  type FormaPagamentoOrcamento,
} from "@/lib/orcamentos-pagamento";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { fetchPortalPublico } from "@/lib/portal-publico-cliente";
import type { PortalPublicoPaginaOrcamento } from "@/lib/portal-publico-types";
import { baixarExcel } from "@/lib/exportar-excel";
import {
  normalizarUnidadeMedida,
  rotuloUnidadeCurto,
  UNIDADE_MEDIDA_PADRAO,
  UNIDADES_MEDIDA,
} from "@/lib/unidades-medida";

function parseMoeda(value: string) {
  return Number(value.replace(/\D/g, "")) / 100;
}

function formatMoedaInput(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatTelefone(raw?: string) {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return raw || "";
}

/** Imagens de upload no link público passam pelo proxy autenticado pelo token. */
function urlImagemOrcamentoPublico(token: string, imagemUrl?: string) {
  const u = imagemUrl?.trim();
  if (!u) return "";
  if (u.startsWith("data:") || u.startsWith("blob:")) return u;
  if (
    u.startsWith("/uploads/") ||
    u.startsWith("/api/uploads/disco/") ||
    u.startsWith("/api/uploads/arquivo/")
  ) {
    return `/api/orcamentos/public/${encodeURIComponent(token)}/arquivo?u=${encodeURIComponent(u)}`;
  }
  return u;
}

export default function OrcamentoPublicoPage() {
  const params = useParams();
  const token = String(params.token || "");

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [orcamento, setOrcamento] = useState<Orcamento | null>(null);
  const [itens, setItens] = useState<ItemOrcamento[]>([]);
  const [descontoPercentual, setDescontoPercentual] = useState(0);
  const [descontoValor, setDescontoValor] = useState("R$ 0,00");
  const [tipoDesconto, setTipoDesconto] = useState<"percentual" | "valor">("percentual");
  const [freteValor, setFreteValor] = useState("R$ 0,00");
  const [observacao, setObservacao] = useState("");
  const [formaPagamento, setFormaPagamento] =
    useState<FormaPagamentoOrcamento>("a_vista");
  const [parcelas, setParcelas] = useState(1);
  const [valorCondicao, setValorCondicao] = useState("R$ 0,00");
  const [descontoCondicaoTipo, setDescontoCondicaoTipo] = useState<
    "percentual" | "valor"
  >("percentual");
  const [descontoCondicao, setDescontoCondicao] = useState("0");
  const [condicoesSalvas, setCondicoesSalvas] = useState<
    CondicoesPagamentoOrcamento[]
  >([]);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [buscaProduto, setBuscaProduto] = useState("");
  const [fotoModalIndex, setFotoModalIndex] = useState<number | null>(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [erroFoto, setErroFoto] = useState("");
  const inputFotoRef = useRef<HTMLInputElement>(null);
  const inputArquivoOrcamentoRef = useRef<HTMLInputElement>(null);
  const [lendoArquivo, setLendoArquivo] = useState(false);
  const [erroArquivo, setErroArquivo] = useState("");
  const [msgArquivo, setMsgArquivo] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetchPortalPublico<PortalPublicoPaginaOrcamento>("orcamento", token);
      if (!res.ok) {
        setErro(res.message || res.error || "Link indisponível.");
        setOrcamento(null);
        return;
      }
      const data = res.dados.entidade;
      setOrcamento(data);
      setItens(
        (data.itens || []).map((item) => ({
          ...item,
          unidade: item.unidade || UNIDADE_MEDIDA_PADRAO,
        }))
      );
      setObservacao(data.observacoes || "");
      const listaCond = parseListaCondicoesPagamento(data.condicoesPagamento);
      setCondicoesSalvas(listaCond);
      // Rascunho sempre começa em À vista para exibir valor/desconto.
      setFormaPagamento("a_vista");
      setParcelas(1);
      setValorCondicao(formatMoedaInput(data.totalLiquido || 0));
      setDescontoCondicaoTipo("percentual");
      setDescontoCondicao("0");
      setDescontoPercentual(data.descontoPercentual || 0);
      setDescontoValor(formatMoedaInput(data.desconto || 0));
      setFreteValor(formatMoedaInput(data.frete || 0));
      setEnviado(
        data.status === "enviado" ||
          data.status === "aprovado" ||
          data.status === "cancelado"
      );
    } catch {
      setErro("Não foi possível carregar o orçamento.");
    } finally {
      setCarregando(false);
    }
  }, [token]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const subtotal = useMemo(() => calcularTotaisItens(itens), [itens]);
  const freteNumero = useMemo(() => parseMoeda(freteValor), [freteValor]);
  const totalLiquido = useMemo(() => {
    if (tipoDesconto === "percentual") {
      return totalLiquidoOrcamento(subtotal, 0, descontoPercentual, freteNumero);
    }
    return totalLiquidoOrcamento(
      subtotal,
      parseMoeda(descontoValor),
      0,
      freteNumero
    );
  }, [subtotal, descontoPercentual, descontoValor, tipoDesconto, freteNumero]);

  function montarCondicaoRascunho(): CondicoesPagamentoOrcamento {
    const valorInformado = parseMoeda(valorCondicao);
    const descontoInformado =
      descontoCondicaoTipo === "valor"
        ? parseMoeda(descontoCondicao)
        : Number(String(descontoCondicao).replace(",", ".")) || 0;
    return {
      id: `cond-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      forma: formaPagamento,
      parcelas: exigeParcelamento(formaPagamento)
        ? normalizarParcelas(parcelas)
        : 1,
      valor: valorInformado > 0 ? valorInformado : totalLiquido,
      descontoTipo: exigeValorDescontoVista(formaPagamento)
        ? descontoCondicaoTipo
        : undefined,
      desconto:
        exigeValorDescontoVista(formaPagamento) && descontoInformado > 0
          ? descontoInformado
          : undefined,
    };
  }

  function limparRascunhoCondicao() {
    setFormaPagamento("a_vista");
    setParcelas(1);
    setValorCondicao(formatMoedaInput(totalLiquido));
    setDescontoCondicaoTipo("percentual");
    setDescontoCondicao("0");
  }

  function adicionarCondicaoPagamento() {
    const nova = montarCondicaoRascunho();
    setCondicoesSalvas((atual) => [...atual, nova]);
    limparRascunhoCondicao();
  }

  function removerCondicaoPagamento(id?: string, index?: number) {
    setCondicoesSalvas((atual) =>
      atual.filter((c, i) => (id ? c.id !== id : i !== index))
    );
  }

  function atualizarItem<K extends keyof ItemOrcamento>(
    index: number,
    campo: K,
    valor: ItemOrcamento[K]
  ) {
    setItens((atual) =>
      atual.map((item, i) => (i === index ? { ...item, [campo]: valor } : item))
    );
  }

  function atualizarValorUnitario(index: number, texto: string) {
    atualizarItem(index, "valorUnitario", parseMoeda(texto));
  }

  function adicionarLinhaProduto() {
    setItens((atual) => [...atual, itemOrcamentoLinhaNova()]);
  }

  const todosSelecionados =
    itens.length > 0 && selecionados.size === itens.length;
  const algunsSelecionados =
    selecionados.size > 0 && selecionados.size < itens.length;

  const termoBuscaProduto = buscaProduto.trim().toLowerCase();
  const itensVisiveis = useMemo(() => {
    if (!termoBuscaProduto) {
      return itens.map((item, index) => ({ item, index }));
    }
    return itens
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => {
        const haystack = [item.produtoNome, item.marca, item.codigoBarras]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(termoBuscaProduto);
      });
  }, [itens, termoBuscaProduto]);

  const indicesVisiveis = useMemo(
    () => itensVisiveis.map(({ index }) => index),
    [itensVisiveis]
  );

  const todosVisiveisSelecionados =
    indicesVisiveis.length > 0 &&
    indicesVisiveis.every((index) => selecionados.has(index));
  const algunsVisiveisSelecionados =
    indicesVisiveis.some((index) => selecionados.has(index)) &&
    !todosVisiveisSelecionados;

  function toggleSelecionar(index: number) {
    setSelecionados((atual) => {
      const next = new Set(atual);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleSelecionarTodos() {
    if (termoBuscaProduto) {
      setSelecionados((atual) => {
        const next = new Set(atual);
        if (todosVisiveisSelecionados) {
          for (const index of indicesVisiveis) next.delete(index);
        } else {
          for (const index of indicesVisiveis) next.add(index);
        }
        return next;
      });
      return;
    }
    if (todosSelecionados) {
      setSelecionados(new Set());
      return;
    }
    setSelecionados(new Set(itens.map((_, i) => i)));
  }

  function reindexarSelecionados(indicesRemovidos: number[]) {
    const removidos = new Set(indicesRemovidos);
    setSelecionados((atual) => {
      const next = new Set<number>();
      for (const idx of atual) {
        if (removidos.has(idx)) continue;
        let novo = idx;
        for (const r of indicesRemovidos) {
          if (r < idx) novo -= 1;
        }
        if (novo >= 0) next.add(novo);
      }
      return next;
    });
  }

  function excluirLinhas(indices: number[]) {
    if (indices.length === 0) return;
    if (itens.length - indices.length < 1) {
      alert("O orçamento precisa ter pelo menos um produto.");
      return;
    }
    const remover = new Set(indices);
    setItens((atual) => atual.filter((_, i) => !remover.has(i)));
    reindexarSelecionados(indices);
  }

  function excluirLinha(index: number) {
    excluirLinhas([index]);
  }

  const inputCelula =
    "h-8 w-full min-w-0 rounded-sm border border-slate-200 px-2 text-[10px] disabled:bg-slate-50";
  const inputNomeProduto =
    "min-h-[2.75rem] w-full min-w-[180px] resize-y rounded-sm border border-slate-200 px-2 py-1.5 text-[10px] leading-snug disabled:bg-slate-50";

  async function exportarExcel() {
    try {
      await baixarExcel(
        `orcamento-pedido-${orcamento?.numeroPedido || token}`,
        [
          "Cod Barras",
          "Produto",
          "Marca",
          "Qtd",
          "Medida",
          "Unidade",
          "Valor Unit.",
          "Subtotal",
        ],
        [
          ...itens.map((item) => [
            item.codigoBarras || "",
            item.produtoNome,
            item.marca || "",
            item.quantidade,
            item.unidadeValor && item.unidadeValor > 0 ? item.unidadeValor : "",
            item.unidade || UNIDADE_MEDIDA_PADRAO,
            Number(item.valorUnitario.toFixed(2)),
            Number((item.quantidade * item.valorUnitario).toFixed(2)),
          ]),
          [],
          ["", "", "", "", "", "", "Valor Total", Number(subtotal.toFixed(2))],
          [
            "",
            "",
            "",
            "",
            "",
            "",
            "Desconto",
            Number(
              (
                tipoDesconto === "percentual"
                  ? subtotal * (descontoPercentual / 100)
                  : parseMoeda(descontoValor)
              ).toFixed(2)
            ),
          ],
          ["", "", "", "", "", "", "Frete", Number(freteNumero.toFixed(2))],
          [
            "",
            "",
            "",
            "",
            "",
            "",
            "Total Líquido",
            Number(totalLiquido.toFixed(2)),
          ],
        ],
        { nomeAba: "Orcamento", colunasTexto: [0] }
      );
    } catch {
      alert("Não foi possível gerar o Excel. Tente novamente.");
    }
  }

  async function enviarResposta() {
    if (!orcamento || enviado) return;

    const semPreco = itensSemPrecoOrcamento(itens);
    if (semPreco.length > 0) {
      const nomes = semPreco
        .slice(0, 5)
        .map((i) => i.produtoNome || "produto")
        .join(", ");
      alert(
        `Não é possível enviar com item(ns) em R$ 0,00. Informe o valor ou marque como "Em falta": ${nomes}${
          semPreco.length > 5 ? "…" : ""
        }.`
      );
      return;
    }
    const comValor = itens.filter(
      (i) => !i.emFalta && Number(i.valorUnitario) > 0
    );
    if (comValor.length === 0) {
      alert(
        "Informe o valor de pelo menos um produto disponível (ou remova os itens em falta)."
      );
      return;
    }

    setEnviando(true);
    try {
      let listaEnvio = [...condicoesSalvas];
      if (listaEnvio.length === 0) {
        listaEnvio = [montarCondicaoRascunho()];
      }
      const response = await fetch(`/api/orcamentos/public/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itens,
          desconto: tipoDesconto === "valor" ? parseMoeda(descontoValor) : 0,
          descontoPercentual: tipoDesconto === "percentual" ? descontoPercentual : 0,
          frete: freteNumero,
          observacoes: observacao,
          condicoesPagamento: serializarListaCondicoesPagamento(listaEnvio),
          condicoesPagamentoLista: listaEnvio,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        alert(data.message || "Não foi possível enviar o orçamento.");
        return;
      }
      setEnviado(true);
      setCondicoesSalvas(listaEnvio);
      setOrcamento(data);
      if (data.mensagem) {
        /* confirmação 202 — UI já mostra estado "enviado" */
      }
    } catch {
      alert("Erro ao enviar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  function marcarEmFalta(index: number, emFalta: boolean) {
    setItens((atual) =>
      atual.map((item, i) =>
        i === index
          ? {
              ...item,
              emFalta,
              valorUnitario: emFalta ? 0 : item.valorUnitario,
            }
          : item
      )
    );
  }

  function abrirModalFoto(index: number) {
    if (enviado) return;
    setErroFoto("");
    setFotoModalIndex(index);
  }

  function fecharModalFoto() {
    if (enviandoFoto) return;
    setFotoModalIndex(null);
    setErroFoto("");
    if (inputFotoRef.current) inputFotoRef.current.value = "";
  }

  async function onSelecionarFotoItem(file: File | null) {
    if (fotoModalIndex == null || !file || enviado || enviandoFoto) return;
    setErroFoto("");
    if (!file.type.startsWith("image/")) {
      setErroFoto("Selecione um arquivo de imagem.");
      return;
    }
    setEnviandoFoto(true);
    try {
      const formData = new FormData();
      formData.append("files", file);
      const res = await fetch(`/api/orcamentos/public/${token}/upload`, {
        method: "POST",
        body: formData,
      });
      const json = (await res.json().catch(() => null)) as
        | Array<{ url?: string }>
        | { error?: string }
        | null;
      if (!res.ok) {
        const errMsg =
          json && !Array.isArray(json) ? json.error : undefined;
        const err = new Error(errMsg || "Não foi possível enviar a foto.");
        if (json && !Array.isArray(json) && "code" in json) {
          (err as Error & { code?: string }).code = String(
            (json as { code?: string }).code || ""
          );
        }
        throw err;
      }
      const uploaded = Array.isArray(json) ? json : [];
      const url = uploaded[0]?.url?.trim();
      if (!url) throw new Error("Resposta de upload inválida.");
      atualizarItem(fotoModalIndex, "imagemUrl", url);
    } catch (err) {
      const { tratarErroUploadArmazenamento } = await import(
        "@/lib/uploads-erro-armazenamento"
      );
      if (!tratarErroUploadArmazenamento(err)) {
        setErroFoto(err instanceof Error ? err.message : "Falha no upload da foto.");
      } else {
        setErroFoto("");
      }
    } finally {
      setEnviandoFoto(false);
      if (inputFotoRef.current) inputFotoRef.current.value = "";
    }
  }

  function removerFotoItem() {
    if (fotoModalIndex == null || enviado) return;
    atualizarItem(fotoModalIndex, "imagemUrl", undefined);
    setErroFoto("");
  }

  function aplicarFreteLido(
    frete: number | undefined | null,
    textoArquivo: string,
    extrairFrete: (texto: string) => number,
    itensAtual: ItemOrcamento[] = itens
  ) {
    const subtotal = itensAtual.reduce(
      (acc, i) => acc + i.quantidade * i.valorUnitario,
      0
    );
    const rejeitaSeTotal = (v: number) => {
      if (!(v > 0)) return 0;
      if (subtotal > 0 && Math.abs(v - subtotal) < 0.05) return 0;
      if (subtotal > 0 && v >= subtotal * 0.85) return 0;
      return v;
    };
    const doTexto = rejeitaSeTotal(extrairFrete(textoArquivo));
    const doResultado = rejeitaSeTotal(Number(frete) || 0);
    // Texto "Frete --> 30,00" tem prioridade sobre frete vindo da IA/API
    const valor = doTexto > 0 ? doTexto : doResultado;
    setFreteValor(formatMoedaInput(valor > 0 ? valor : 0));
  }

  function aplicarPagamentoLido(
    pagamento:
      | { forma: FormaPagamentoOrcamento; parcelas: number }
      | null
      | undefined,
    textoArquivo: string,
    extrairPagamento: (
      texto: string
    ) => { forma: FormaPagamentoOrcamento; parcelas: number } | null
  ) {
    const doTexto = extrairPagamento(textoArquivo);
    const pag = doTexto || pagamento || null;
    if (!pag?.forma) return;
    const forma = pag.forma;
    const parcelas = exigeParcelamento(forma)
      ? normalizarParcelas(pag.parcelas)
      : 1;
    setFormaPagamento(forma);
    setParcelas(parcelas);
    setCondicoesSalvas((atual) => {
      const semMesmaForma = atual.filter((c) => c.forma !== forma);
      return [
        ...semMesmaForma,
        {
          id: `arquivo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          forma,
          parcelas,
        },
      ];
    });
  }

  async function onSelecionarArquivoOrcamento(file: File | null) {
    if (!file || enviado || lendoArquivo || enviando) return;
    setLendoArquivo(true);
    setErroArquivo("");
    setMsgArquivo("");
    try {
      // Lib client-safe (sem pdfjs/IA de servidor) — evita quebrar o upload no navegador.
      const {
        validarArquivoOrcamento,
        preencherItensComTexto,
        casarLinhasComItens,
        extrairLinhasTextoHeuristico,
        extrairFreteDoTexto,
        extrairCondicaoPagamentoDoTexto,
        mensagemResultadoLeitura,
      } = await import("@/lib/orcamento-leitura-match");

      const erroValidacao = validarArquivoOrcamento(file);
      if (erroValidacao) throw new Error(erroValidacao);
      if (itens.length === 0) {
        throw new Error("O orçamento não tem itens para preencher.");
      }

      const ehPdf =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");
      const ehImagem =
        file.type.startsWith("image/") ||
        /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name);
      const ehPlanilha =
        /\.(xlsx|xls|csv)$/i.test(file.name) ||
        /sheet|excel|csv/i.test(file.type || "");

      let textoCliente = "";
      if (ehPdf) {
        try {
          const { extrairTextoPdf } = await import("@/lib/nfe-pdf");
          textoCliente = await extrairTextoPdf(file);
        } catch (err) {
          console.error("extrairTextoPdf", err);
          textoCliente = "";
        }
      }

      let resultadoLocal: Awaited<
        ReturnType<typeof preencherItensComTexto>
      > | null = null;

      if (!ehPlanilha && textoCliente.trim().length > 10) {
        try {
          resultadoLocal = preencherItensComTexto(itens, textoCliente);
        } catch (err) {
          console.warn("leitura local", err);
        }
      }

      // Sempre consulta a API também para forçar leitura completa (100% dos produtos).
      const formData = new FormData();
      formData.append("file", file);
      formData.append("itens", JSON.stringify(itens));
      if (textoCliente.trim()) formData.append("texto", textoCliente);

      let res = await fetch(
        `/api/orcamentos/public/${encodeURIComponent(token)}/parse`,
        { method: "POST", body: formData }
      );

      if (!res.ok) {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
        }
        const base64 = btoa(binary);
        res = await fetch(
          `/api/orcamentos/public/${encodeURIComponent(token)}/parse`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              itens,
              texto: textoCliente,
              mimeType:
                file.type ||
                (ehPdf
                  ? "application/pdf"
                  : ehPlanilha
                    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    : ehImagem
                      ? "image/jpeg"
                      : "application/octet-stream"),
              base64,
              nomeArquivo: file.name,
            }),
          }
        );
      }

      const json = (await res.json().catch(() => null)) as {
        error?: string;
        message?: string;
        mensagem?: string;
        itens?: ItemOrcamento[];
        matches?: Array<{ produtoNomeSistema: string; nomeArquivo: string }>;
        naoEncontrados?: Array<{ nome: string }>;
        acrescentados?: number;
        atualizados?: number;
        frete?: number;
        pagamento?: {
          forma: FormaPagamentoOrcamento;
          parcelas: number;
        } | null;
      } | null;

      if (!res.ok) {
        if (resultadoLocal && resultadoLocal.matches.length > 0) {
          setItens(resultadoLocal.itens);
          aplicarFreteLido(
            resultadoLocal.frete,
            textoCliente,
            extrairFreteDoTexto,
            resultadoLocal.itens
          );
          aplicarPagamentoLido(
            resultadoLocal.pagamento,
            textoCliente,
            extrairCondicaoPagamentoDoTexto
          );
          setMsgArquivo(mensagemResultadoLeitura(resultadoLocal));
          return;
        }
        if (textoCliente.trim()) {
          const linhas = extrairLinhasTextoHeuristico(textoCliente);
          if (linhas.length > 0) {
            const local = casarLinhasComItens(itens, linhas);
            if (local.matches.length > 0) {
              setItens(local.itens);
              aplicarFreteLido(
                local.frete,
                textoCliente,
                extrairFreteDoTexto,
                local.itens
              );
              aplicarPagamentoLido(
                local.pagamento,
                textoCliente,
                extrairCondicaoPagamentoDoTexto
              );
              setMsgArquivo(mensagemResultadoLeitura(local));
              return;
            }
          }
        }
        throw new Error(
          json?.error ||
            json?.message ||
            (ehImagem
              ? "Não foi possível ler a imagem. Tente um PDF com texto ou uma foto mais nítida."
              : "Não foi possível ler o arquivo.")
        );
      }
      if (!Array.isArray(json?.itens) || json.itens.length === 0) {
        if (resultadoLocal && resultadoLocal.itens.length > 0) {
          setItens(resultadoLocal.itens);
          aplicarFreteLido(
            resultadoLocal.frete,
            textoCliente,
            extrairFreteDoTexto,
            resultadoLocal.itens
          );
          aplicarPagamentoLido(
            resultadoLocal.pagamento,
            textoCliente,
            extrairCondicaoPagamentoDoTexto
          );
          setMsgArquivo(mensagemResultadoLeitura(resultadoLocal));
          return;
        }
        throw new Error("Resposta inválida da leitura do arquivo.");
      }

      // Escolhe o resultado com mais produtos aplicados do arquivo (leitura 100%).
      const scoreApi =
        (json.acrescentados ?? 0) +
        (json.atualizados ?? 0) +
        (json.matches?.length ?? 0);
      const scoreLocal = resultadoLocal
        ? resultadoLocal.acrescentados +
          resultadoLocal.atualizados +
          resultadoLocal.matches.length
        : 0;
      const preferLocal =
        resultadoLocal &&
        (resultadoLocal.itens.length > json.itens.length ||
          scoreLocal > scoreApi);

      if (preferLocal && resultadoLocal) {
        setItens(resultadoLocal.itens);
        aplicarFreteLido(
          resultadoLocal.frete ?? json.frete,
          textoCliente,
          extrairFreteDoTexto,
          resultadoLocal.itens
        );
        aplicarPagamentoLido(
          resultadoLocal.pagamento ?? json.pagamento,
          textoCliente,
          extrairCondicaoPagamentoDoTexto
        );
        setMsgArquivo(mensagemResultadoLeitura(resultadoLocal));
        return;
      }

      setItens(json.itens);
      aplicarFreteLido(
        json.frete,
        textoCliente,
        extrairFreteDoTexto,
        json.itens
      );
      aplicarPagamentoLido(
        json.pagamento,
        textoCliente,
        extrairCondicaoPagamentoDoTexto
      );
      setMsgArquivo(
        json.mensagem ||
          `Aplicamos ${(json.matches?.length ?? 0)} item(ns) do arquivo. Revise antes de enviar.`
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Falha ao ler o arquivo.";
      setErroArquivo(msg);
      alert(msg);
    } finally {
      setLendoArquivo(false);
      if (inputArquivoOrcamentoRef.current) {
        inputArquivoOrcamentoRef.current.value = "";
      }
    }
  }

  const itemFotoModal =
    fotoModalIndex != null ? itens[fotoModalIndex] ?? null : null;

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f4f6] text-sm text-slate-500">
        Carregando orçamento...
      </div>
    );
  }

  if (erro || !orcamento) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f4f6] p-6">
        <div className="max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="mb-2 text-lg font-semibold text-slate-700">Link indisponível</h1>
          <p className="text-sm text-slate-500">{erro}</p>
        </div>
      </div>
    );
  }

  const somenteLeitura = enviado;

  return (
    <div className="min-h-screen bg-[#f3f4f6] py-6 print:bg-white print:py-0">
      <div className="mx-auto max-w-5xl px-4 print:max-w-none print:px-0">
        <div className="mb-4 flex items-center justify-end no-print">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void exportarExcel()}
              className="inline-flex h-8 items-center gap-1 rounded border border-slate-300 bg-white px-3 text-[11px] text-slate-600 hover:bg-slate-50"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Excel
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-8 items-center gap-1 rounded bg-blue-500 px-3 text-[11px] font-medium text-white hover:bg-blue-600"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir
            </button>
          </div>
        </div>

        <div className="print-area overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm print:overflow-visible print:border-0 print:shadow-none">
          <div className="hidden border-b border-slate-100 py-6 text-center print:block">
            <img
              src="/images/lab-protese-logo.png"
              alt="Dente Art"
              width={300}
              height={100}
              className="mx-auto object-contain"
              style={{ width: 300, height: 100 }}
            />
          </div>

          <div className="grid gap-4 border-b border-slate-100 px-5 py-4 text-[11px] text-slate-600 md:grid-cols-3">
            <div>
              <p className="font-medium text-slate-800">{orcamento.labNome}</p>
              <p>{formatTelefone(orcamento.labTelefone)}</p>
            </div>
            <div>
              <p>
                <span className="font-medium text-slate-700">Cliente:</span>{" "}
                {orcamento.labNome}
              </p>
              <p>{orcamento.labEmail || ""}</p>
            </div>
            <div className="md:text-right">
              <p>
                <span className="font-medium text-slate-700">Pedido</span> #
                {orcamento.numeroPedido}
              </p>
              <p>
                <span className="font-medium text-slate-700">Data do Pedido:</span>{" "}
                {formatDate(orcamento.data)}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto px-5 py-4 print:overflow-visible">
            <div className="mb-3 flex flex-wrap items-end gap-3 no-print">
              {!somenteLeitura && (
                <button
                  type="button"
                  onClick={adicionarLinhaProduto}
                  className="inline-flex items-center gap-1 rounded border border-[#8bc34a] bg-white px-2.5 py-1 text-[10px] font-medium text-[#689f38] hover:bg-[#f1f8e9]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  produto
                </button>
              )}
              <div className="min-w-[240px] flex-1">
                <label className="mb-1 block text-[10px] font-medium text-slate-600">
                  Buscar
                </label>
                <div className="flex">
                  <input
                    value={buscaProduto}
                    onChange={(e) => setBuscaProduto(e.target.value)}
                    placeholder="Buscar produto..."
                    className="h-8 min-w-0 flex-1 rounded-l-sm border border-r-0 border-slate-200 px-3 text-[11px] outline-none focus:border-blue-400"
                  />
                  <button
                    type="button"
                    onClick={() => setBuscaProduto("")}
                    className="h-8 shrink-0 rounded-r-sm border border-slate-200 bg-slate-100 px-4 text-[11px] font-medium text-slate-600 hover:bg-slate-200"
                  >
                    Limpar
                  </button>
                </div>
              </div>
            </div>
            <table className="w-full min-w-[860px] text-[10px] print:min-w-0">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
                  {!somenteLeitura && (
                    <th className="w-9 px-2 py-2 text-center no-print">
                      <input
                        type="checkbox"
                        checked={
                          termoBuscaProduto
                            ? todosVisiveisSelecionados
                            : todosSelecionados
                        }
                        ref={(el) => {
                          if (el) {
                            el.indeterminate = termoBuscaProduto
                              ? algunsVisiveisSelecionados
                              : algunsSelecionados;
                          }
                        }}
                        onChange={toggleSelecionarTodos}
                        className="h-4 w-4 accent-[#4a90d9]"
                        aria-label="Selecionar todos os produtos"
                      />
                    </th>
                  )}
                  <th className="w-16 px-2 py-2 text-center font-semibold uppercase no-print">
                    Foto
                  </th>
                  <th className="w-[88px] px-2 py-2 text-left font-semibold uppercase">
                    Cod Barras
                  </th>
                  <th className="min-w-[200px] px-2 py-2 text-left font-semibold uppercase">
                    Produto
                  </th>
                  <th className="min-w-[120px] w-[130px] px-2 py-2 text-left font-semibold uppercase">
                    Marca
                  </th>
                  <th className="w-[72px] px-2 py-2 text-center font-semibold uppercase">
                    Quantidade
                  </th>
                  <th className="w-14 px-1 py-2" aria-label="Valor da unidade" />
                  <th className="w-20 px-2 py-2 text-center font-semibold uppercase">
                    Unidade
                  </th>
                  <th className="w-[76px] px-1 py-2 text-right font-semibold uppercase">
                    Valor Unit.
                  </th>
                  <th className="w-[64px] px-1 py-2 text-center font-semibold uppercase no-print">
                    Em falta
                  </th>
                  <th className="w-[80px] px-2 py-2 text-right font-semibold uppercase">
                    Subtotal
                  </th>
                  {!somenteLeitura && (
                    <th className="w-9 px-1 py-2 no-print" aria-label="Excluir" />
                  )}
                </tr>
              </thead>
              <tbody>
                {itensVisiveis.length === 0 ? (
                  <tr>
                    <td
                      colSpan={somenteLeitura ? 9 : 12}
                      className="px-3 py-8 text-center text-[11px] text-slate-400"
                    >
                      {itens.length === 0
                        ? "Nenhum produto no orçamento."
                        : "Nenhum produto encontrado com esse nome."}
                    </td>
                  </tr>
                ) : (
                  itensVisiveis.map(({ item, index }) => (
                  <tr
                    key={`${item.produtoId}-${index}`}
                    className={`border-b border-slate-50 ${
                      item.emFalta
                        ? "bg-amber-50/70"
                        : selecionados.has(index)
                          ? "bg-blue-50/60"
                          : ""
                    }`}
                  >
                    {!somenteLeitura && (
                      <td className="px-2 py-2 text-center no-print">
                        <input
                          type="checkbox"
                          checked={selecionados.has(index)}
                          onChange={() => toggleSelecionar(index)}
                          className="h-4 w-4 accent-[#4a90d9]"
                          aria-label={`Selecionar ${item.produtoNome || "produto"}`}
                        />
                      </td>
                    )}
                    <td className="px-2 py-2 text-center no-print">
                      {somenteLeitura ? (
                        <div className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-50">
                          {item.imagemUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={urlImagemOrcamentoPublico(token, item.imagemUrl)}
                              alt={item.produtoNome || "Produto"}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-[10px] text-slate-300">—</span>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => abrirModalFoto(index)}
                          title={
                            item.imagemUrl
                              ? "Alterar foto do produto"
                              : "Adicionar foto do produto"
                          }
                          aria-label={
                            item.imagemUrl
                              ? "Alterar foto do produto"
                              : "Adicionar foto do produto"
                          }
                          className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-50 transition hover:border-[#4a90d9] hover:bg-blue-50/50"
                        >
                          {item.imagemUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={urlImagemOrcamentoPublico(token, item.imagemUrl)}
                              alt={item.produtoNome || "Produto"}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <ImagePlus className="h-5 w-5 text-slate-300" aria-hidden />
                          )}
                        </button>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {somenteLeitura ? (
                        <span className="text-slate-500">{item.codigoBarras || ""}</span>
                      ) : (
                        <input
                          value={item.codigoBarras || ""}
                          onChange={(e) =>
                            atualizarItem(index, "codigoBarras", e.target.value)
                          }
                          className={inputCelula}
                          placeholder="Código"
                          {...propsInputComSelecaoAoFocar({})}
                        />
                      )}
                    </td>
                    <td className="min-w-[200px] px-2 py-2 align-top">
                      {somenteLeitura ? (
                        <span className="block whitespace-normal break-words font-medium leading-snug text-slate-700">
                          {item.produtoNome}
                          {item.emFalta ? (
                            <span className="ml-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-800">
                              Em falta
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <textarea
                          value={item.produtoNome}
                          onChange={(e) =>
                            atualizarItem(index, "produtoNome", e.target.value)
                          }
                          rows={2}
                          className={inputNomeProduto}
                          placeholder="Nome do produto"
                          title={item.produtoNome}
                        />
                      )}
                    </td>
                    <td className="min-w-[120px] w-[130px] px-2 py-2 align-middle">
                      {somenteLeitura ? (
                        <span
                          className="block whitespace-normal break-words text-slate-600"
                          title={item.marca || undefined}
                        >
                          {item.marca || ""}
                        </span>
                      ) : (
                        <input
                          value={item.marca || ""}
                          onChange={(e) => atualizarItem(index, "marca", e.target.value)}
                          className={`${inputCelula} min-w-[110px]`}
                          placeholder="Marca"
                          title={item.marca || "Marca"}
                          {...propsInputComSelecaoAoFocar({})}
                        />
                      )}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {somenteLeitura ? (
                        <span>{item.quantidade}</span>
                      ) : (
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={item.quantidade}
                          onChange={(e) => {
                            const raw = Number(
                              String(e.target.value).replace(",", ".")
                            );
                            atualizarItem(
                              index,
                              "quantidade",
                              Math.max(1, Math.trunc(raw) || 1)
                            );
                          }}
                          className={`${inputCelula} mx-auto max-w-[64px] text-center`}
                          {...propsInputComSelecaoAoFocar({})}
                        />
                      )}
                    </td>
                    <td className="px-1 py-2 text-center">
                      {somenteLeitura ? (
                        <span className="text-slate-600">
                          {item.unidadeValor && item.unidadeValor > 0
                            ? item.unidadeValor
                            : ""}
                        </span>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={
                            item.unidadeValor && item.unidadeValor > 0
                              ? item.unidadeValor
                              : ""
                          }
                          placeholder=""
                          title="Valor da unidade (ex.: 500 em 500ml)"
                          aria-label="Valor da unidade"
                          onChange={(e) => {
                            const raw = String(e.target.value).replace(",", ".");
                            if (raw.trim() === "") {
                              atualizarItem(index, "unidadeValor", undefined);
                              return;
                            }
                            const n = Number(raw);
                            atualizarItem(
                              index,
                              "unidadeValor",
                              Number.isFinite(n) && n > 0 ? n : undefined
                            );
                          }}
                          className={`${inputCelula} mx-auto max-w-[56px] text-center`}
                          {...propsInputComSelecaoAoFocar({})}
                        />
                      )}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {somenteLeitura ? (
                        <span className="text-slate-600">
                          {rotuloUnidadeCurto(item.unidade)}
                        </span>
                      ) : (
                        <div className="mx-auto flex max-w-[88px] flex-col gap-1">
                          <select
                            value={
                              UNIDADES_MEDIDA.some(
                                (u) => u.value === (item.unidade || UNIDADE_MEDIDA_PADRAO)
                              )
                                ? item.unidade || UNIDADE_MEDIDA_PADRAO
                                : "__outra__"
                            }
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === "__outra__") {
                                atualizarItem(index, "unidade", "gr");
                                return;
                              }
                              atualizarItem(
                                index,
                                "unidade",
                                normalizarUnidadeMedida(v)
                              );
                            }}
                            className={`${inputCelula} text-left`}
                          >
                            {UNIDADES_MEDIDA.map((u) => (
                              <option key={u.value} value={u.value}>
                                {rotuloUnidadeCurto(u.value)}
                              </option>
                            ))}
                            <option value="__outra__">Outra…</option>
                          </select>
                          {!UNIDADES_MEDIDA.some(
                            (u) => u.value === (item.unidade || "")
                          ) && (
                            <input
                              value={item.unidade || ""}
                              onChange={(e) =>
                                atualizarItem(index, "unidade", e.target.value)
                              }
                              placeholder="gr, kg, ml…"
                              className={`${inputCelula} text-center`}
                              {...propsInputComSelecaoAoFocar({})}
                            />
                          )}
                        </div>
                      )}
                    </td>
                    <td className="w-[76px] px-1 py-2 text-right align-middle">
                      {somenteLeitura ? (
                        item.emFalta ? (
                          <span className="text-amber-700">Em falta</span>
                        ) : (
                          formatCurrency(item.valorUnitario)
                        )
                      ) : (
                        <input
                          value={
                            item.emFalta
                              ? ""
                              : item.valorUnitario > 0
                                ? formatMoedaInput(item.valorUnitario)
                                : ""
                          }
                          placeholder={item.emFalta ? "Em falta" : "R$ 0,00"}
                          disabled={item.emFalta}
                          onChange={(e) =>
                            atualizarValorUnitario(index, e.target.value)
                          }
                          className={`ml-auto block h-8 w-[4.5rem] rounded-sm border px-1 text-right text-[10px] ${
                            item.emFalta
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : !(item.valorUnitario > 0)
                                ? "border-red-300 bg-red-50"
                                : "border-slate-200"
                          }`}
                          {...propsInputComSelecaoAoFocar({})}
                        />
                      )}
                    </td>
                    <td className="px-1 py-2 text-center align-middle no-print">
                      {somenteLeitura ? (
                        item.emFalta ? (
                          <span className="text-[10px] font-semibold text-amber-700">
                            Sim
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">—</span>
                        )
                      ) : (
                        <label
                          className="inline-flex cursor-pointer flex-col items-center gap-0.5"
                          title="Marcar produto como em falta / indisponível"
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(item.emFalta)}
                            onChange={(e) =>
                              marcarEmFalta(index, e.target.checked)
                            }
                            className="h-4 w-4 accent-amber-600"
                            aria-label={`Em falta: ${item.produtoNome || "produto"}`}
                          />
                          <span className="text-[8px] uppercase text-slate-500">
                            Falta
                          </span>
                        </label>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right font-medium text-slate-700">
                      {item.emFalta
                        ? "—"
                        : formatCurrency(item.quantidade * item.valorUnitario)}
                    </td>
                    {!somenteLeitura && (
                      <td className="px-1 py-2 text-center no-print">
                        <button
                          type="button"
                          onClick={() => excluirLinha(index)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="Excluir produto"
                          aria-label="Excluir produto"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end border-t border-slate-100 px-5 py-4">
            <div className="w-full max-w-xs space-y-2 text-[11px]">
              <div className="flex justify-between text-slate-600">
                <span>Valor Total:</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-600">Desconto:</span>
                <div className="flex items-center gap-1">
                  <select
                    value={tipoDesconto}
                    disabled={somenteLeitura}
                    onChange={(e) =>
                      setTipoDesconto(e.target.value as "percentual" | "valor")
                    }
                    className="h-7 w-12 rounded-sm border border-slate-200 text-[10px]"
                  >
                    <option value="percentual">%</option>
                    <option value="valor">R$</option>
                  </select>
                  {tipoDesconto === "percentual" ? (
                    <input
                      type="number"
                      min={0}
                      max={100}
                      disabled={somenteLeitura}
                      value={descontoPercentual}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") {
                          setDescontoPercentual(0);
                          return;
                        }
                        setDescontoPercentual(Number(raw));
                      }}
                      className="h-7 w-16 rounded-sm border border-slate-200 px-1 text-right text-[10px]"
                      {...propsInputComSelecaoAoFocar({})}
                    />
                  ) : (
                    <input
                      value={descontoValor}
                      disabled={somenteLeitura}
                      onChange={(e) => {
                        const valor = parseMoeda(e.target.value);
                        setDescontoValor(formatMoedaInput(valor));
                      }}
                      className="h-7 w-24 rounded-sm border border-slate-200 px-1 text-right text-[10px]"
                      {...propsInputComSelecaoAoFocar({})}
                    />
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-600">Frete:</span>
                <input
                  value={freteValor}
                  disabled={somenteLeitura}
                  onChange={(e) => {
                    const valor = parseMoeda(e.target.value);
                    setFreteValor(formatMoedaInput(valor));
                  }}
                  className="h-7 w-24 rounded-sm border border-slate-200 px-1 text-right text-[10px]"
                  {...propsInputComSelecaoAoFocar({})}
                />
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-2 text-sm font-semibold text-blue-600">
                <span>Total Líquido:</span>
                <span>{formatCurrency(totalLiquido)}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 border-t border-slate-100 px-5 py-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase text-slate-500">
                Observação
              </label>
              <textarea
                value={observacao}
                disabled={somenteLeitura}
                onChange={(e) => setObservacao(e.target.value)}
                rows={4}
                className="w-full rounded-sm border border-slate-200 px-2 py-1.5 text-[11px] disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase text-slate-500">
                Condições de pagamento
              </label>
              {somenteLeitura ? (
                <div className="min-h-[88px] space-y-1.5 rounded-sm border border-slate-200 bg-slate-50 px-2 py-2 text-[11px] text-slate-700">
                  {condicoesSalvas.length > 0 ? (
                    condicoesSalvas.map((c, i) => (
                      <p key={c.id || i}>{rotuloCondicoesPagamento(c)}</p>
                    ))
                  ) : (
                    <p>
                      {rotuloListaCondicoesPagamento(
                        parseListaCondicoesPagamento(
                          orcamento.condicoesPagamento
                        )
                      )}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <select
                    value={formaPagamento}
                    onChange={(e) => {
                      const forma = e.target.value as FormaPagamentoOrcamento;
                      setFormaPagamento(forma);
                      if (!exigeParcelamento(forma)) setParcelas(1);
                      if (
                        exigeValorDescontoVista(forma) &&
                        parseMoeda(valorCondicao) <= 0
                      ) {
                        setValorCondicao(formatMoedaInput(totalLiquido));
                      }
                    }}
                    className="h-9 w-full rounded-sm border border-slate-200 px-2 text-[11px]"
                  >
                    <option value="a_vista">À vista</option>
                    <option value="pix">Pix</option>
                    <option value="cartao_credito">Cartão de crédito</option>
                    <option value="boleto">Boleto</option>
                  </select>

                  {exigeValorDescontoVista(formaPagamento) ? (
                    <div className="space-y-2 rounded-sm border border-emerald-200 bg-emerald-50/50 p-2">
                      <p className="text-[10px] font-semibold uppercase text-emerald-800">
                        {formaPagamento === "pix"
                          ? "Pix — valor e desconto"
                          : "À vista — valor e desconto"}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-0.5 block text-[9px] font-medium uppercase text-slate-500">
                          Valor (R$)
                        </label>
                        <input
                          value={valorCondicao}
                          onChange={(e) =>
                            setValorCondicao(
                              formatMoedaInput(parseMoeda(e.target.value))
                            )
                          }
                          className="h-8 w-full rounded-sm border border-slate-200 bg-white px-2 text-right text-[11px]"
                          {...propsInputComSelecaoAoFocar({})}
                        />
                      </div>
                      <div>
                        <label className="mb-0.5 block text-[9px] font-medium uppercase text-slate-500">
                          Desconto à vista
                        </label>
                        <div className="flex gap-1">
                          <select
                            value={descontoCondicaoTipo}
                            onChange={(e) => {
                              const tipo = e.target.value as
                                | "percentual"
                                | "valor";
                              setDescontoCondicaoTipo(tipo);
                              setDescontoCondicao(
                                tipo === "valor" ? "R$ 0,00" : "0"
                              );
                            }}
                            className="h-8 w-12 rounded-sm border border-slate-200 bg-white text-[10px]"
                          >
                            <option value="percentual">%</option>
                            <option value="valor">R$</option>
                          </select>
                          {descontoCondicaoTipo === "percentual" ? (
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={descontoCondicao}
                              onChange={(e) =>
                                setDescontoCondicao(e.target.value)
                              }
                              className="h-8 min-w-0 flex-1 rounded-sm border border-slate-200 bg-white px-1 text-right text-[11px]"
                              {...propsInputComSelecaoAoFocar({})}
                            />
                          ) : (
                            <input
                              value={descontoCondicao}
                              onChange={(e) =>
                                setDescontoCondicao(
                                  formatMoedaInput(parseMoeda(e.target.value))
                                )
                              }
                              className="h-8 min-w-0 flex-1 rounded-sm border border-slate-200 bg-white px-1 text-right text-[11px]"
                              {...propsInputComSelecaoAoFocar({})}
                            />
                          )}
                        </div>
                      </div>
                      </div>
                    </div>
                  ) : null}

                  {exigeParcelamento(formaPagamento) && (
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={parcelas}
                        onChange={(e) =>
                          setParcelas(
                            normalizarParcelas(Number(e.target.value))
                          )
                        }
                        className="h-9 w-full rounded-sm border border-slate-200 px-2 text-[11px]"
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(
                          (n) => (
                            <option key={n} value={n}>
                              Parcelamento {n}x
                            </option>
                          )
                        )}
                      </select>
                      <input
                        value={valorCondicao}
                        onChange={(e) =>
                          setValorCondicao(
                            formatMoedaInput(parseMoeda(e.target.value))
                          )
                        }
                        placeholder="Valor (R$)"
                        className="h-9 w-full rounded-sm border border-slate-200 px-2 text-right text-[11px]"
                        {...propsInputComSelecaoAoFocar({})}
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={adicionarCondicaoPagamento}
                    className="inline-flex h-8 w-full items-center justify-center rounded border border-[#4a90d9] bg-white text-[11px] font-medium text-[#4a90d9] hover:bg-[#f0f7ff]"
                  >
                    Salvar condição de pagamento
                  </button>

                  {condicoesSalvas.length > 0 && (
                    <ul className="space-y-1.5 rounded-sm border border-slate-200 bg-white p-2">
                      {condicoesSalvas.map((c, i) => (
                        <li
                          key={c.id || i}
                          className="flex items-start justify-between gap-2 text-[11px] text-slate-700"
                        >
                          <span>{rotuloCondicoesPagamento(c)}</span>
                          <button
                            type="button"
                            onClick={() =>
                              removerCondicaoPagamento(c.id, i)
                            }
                            className="shrink-0 text-slate-400 hover:text-red-500"
                            aria-label="Remover condição"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-[9px] text-slate-500">
                    Salve à vista com valor/desconto e, se quiser, adicione
                    outra condição (ex.: boleto parcelado).
                  </p>
                </div>
              )}
            </div>
          </div>

          {!somenteLeitura && (
            <div className="grid gap-3 border-t border-slate-100 px-5 py-4 md:grid-cols-2 no-print">
              <button
                type="button"
                disabled={enviando || lendoArquivo}
                onClick={() => void enviarResposta()}
                className="inline-flex h-10 items-center justify-center gap-2 rounded bg-[#8bc34a] text-[12px] font-medium text-white hover:bg-[#7cb342] disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {enviando ? "Enviando..." : "Enviar Orçamento"}
              </button>
              <label
                className={cn(
                  "inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded border border-slate-300 bg-white text-[12px] text-slate-600 hover:bg-slate-50",
                  (enviando || lendoArquivo) && "pointer-events-none opacity-60"
                )}
                title="Envie PDF, imagem ou Excel da cotação para preencher valores automaticamente"
              >
                <Upload className="h-4 w-4" />
                {lendoArquivo ? "Lendo arquivo..." : "Upload Arquivo"}
                <input
                  ref={inputArquivoOrcamentoRef}
                  type="file"
                  accept="application/pdf,image/*,.pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  className="sr-only"
                  disabled={enviando || lendoArquivo}
                  onChange={(e) =>
                    void onSelecionarArquivoOrcamento(e.target.files?.[0] ?? null)
                  }
                />
              </label>
              <p className="md:col-span-2 text-[10px] text-slate-500">
                No Upload Arquivo, o sistema lê produtos, frete e condição de
                pagamento (ex.: 4X BOLETO). Marque &quot;Em falta&quot; nos itens
                indisponíveis. Não é possível enviar com valor R$ 0,00.
              </p>
              {msgArquivo ? (
                <p className="md:col-span-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
                  {msgArquivo}
                </p>
              ) : null}
              {erroArquivo ? (
                <p className="md:col-span-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                  {erroArquivo}
                </p>
              ) : null}
            </div>
          )}

          {somenteLeitura && (
            <div className="border-t border-emerald-100 bg-emerald-50 px-5 py-3 text-center text-[11px] font-medium text-emerald-700">
              Orçamento enviado com sucesso em{" "}
              {formatDate(orcamento.dataResposta)}. O laboratório já pode visualizar sua
              resposta.
            </div>
          )}
        </div>
      </div>

      {itemFotoModal && fotoModalIndex != null && !somenteLeitura ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 no-print"
          onClick={fecharModalFoto}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-foto-titulo"
            className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2
                  id="modal-foto-titulo"
                  className="text-sm font-semibold text-slate-800"
                >
                  Foto do produto
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {itemFotoModal.produtoNome?.trim() ||
                    `Item ${fotoModalIndex + 1}`}
                </p>
              </div>
              <button
                type="button"
                onClick={fecharModalFoto}
                disabled={enviandoFoto}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mx-auto mb-4 flex h-36 w-36 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
              {itemFotoModal.imagemUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={urlImagemOrcamentoPublico(token, itemFotoModal.imagemUrl)}
                  alt={itemFotoModal.produtoNome || "Produto"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImagePlus className="h-8 w-8 text-slate-300" aria-hidden />
              )}
            </div>

            <input
              ref={inputFotoRef}
              type="file"
              accept="image/*"
              className="hidden"
              disabled={enviandoFoto}
              onChange={(e) =>
                void onSelecionarFotoItem(e.target.files?.[0] ?? null)
              }
            />

            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                disabled={enviandoFoto}
                onClick={() => inputFotoRef.current?.click()}
                className="rounded border border-slate-300 bg-white px-3 py-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {enviandoFoto
                  ? "Enviando..."
                  : itemFotoModal.imagemUrl
                    ? "Trocar foto"
                    : "Adicionar foto"}
              </button>
              {itemFotoModal.imagemUrl ? (
                <button
                  type="button"
                  disabled={enviandoFoto}
                  onClick={removerFotoItem}
                  className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-3 py-2 text-[11px] text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remover
                </button>
              ) : null}
            </div>

            {erroFoto ? (
              <p className="mt-3 text-center text-[10px] text-rose-600">{erroFoto}</p>
            ) : (
              <p className="mt-3 text-center text-[10px] text-slate-400">
                A foto será enviada junto com o orçamento. Máx. 4 MB.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
