"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Copy, Edit3, Eye, Plus, Trash2 } from "lucide-react";
import { ConfirmacaoExclusaoModal } from "@/components/ConfirmacaoExclusaoModal";
import { BarraConfigListagem } from "@/components/listagem/BarraConfigListagem";
import { useListagemPaginada } from "@/hooks/use-listagem-paginada";
import { compararDataIso, compararNumero, compararTextoBr } from "@/lib/listagem-config";
import { PRODUTOS_ESTOQUE_EVENT } from "@/lib/estoque";
import { aguardarJobCliente } from "@/lib/jobs/polling-cliente";
import { listarProdutosCatalogo } from "@/lib/produtos-catalogo";
import {
  STATUS_ORCAMENTO,
  totalLiquido,
  type Orcamento,
  type StatusOrcamento,
} from "@/lib/orcamentos";
import { linkOrcamentoAtivo } from "@/lib/orcamentos-types";
import { readStorage } from "@/lib/persisted-storage";
import {
  exigeParcelamento,
  parseCondicoesPagamento,
  rotuloParcelamentoColuna,
} from "@/lib/orcamentos-pagamento";
import { formatCurrency } from "@/lib/utils";
import {
  abrirWhatsAppAprovacao,
  abrirWhatsAppReenviarConferencia,
  orcamentoPublicUrl,
} from "@/lib/whatsapp";
import {
  OrcamentoFormModal,
  type FornecedorContato,
  type SalvarOrcamentoPayload,
  type SalvarOrcamentoResult,
} from "./OrcamentoFormModal";
import { OrcamentoRespostaModal } from "./OrcamentoRespostaModal";

const FORNECEDORES_STORAGE_KEY = "labProteseFornecedores";
const LAB_TELEFONE_STORAGE_KEY = "labProteseLabTelefone";

type SessaoLab = { name: string; email: string };

function formatarData(iso: string | null) {
  if (!iso) return "";
  const [ano, mes, dia] = iso.split("-");
  if (!ano || !mes || !dia) return iso;
  return `${dia}/${mes}/${ano}`;
}

function IconWhatsApp({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  return readStorage(key, fallback);
}

export default function OrcamentosPage() {
  const searchParams = useSearchParams();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [fornecedores, setFornecedores] = useState<FornecedorContato[]>([]);
  const [produtos, setProdutos] = useState<
    Awaited<ReturnType<typeof listarProdutosCatalogo>>
  >([]);
  const [sessao, setSessao] = useState<SessaoLab | null>(null);
  const [situacao, setSituacao] = useState<"todos" | StatusOrcamento>("todos");
  const [busca, setBusca] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [somenteLeitura, setSomenteLeitura] = useState(false);
  const [orcamentoAtual, setOrcamentoAtual] = useState<Orcamento | null>(null);
  const [orcamentoParaExcluir, setOrcamentoParaExcluir] = useState<Orcamento | null>(null);
  const [orcamentoParaReabrir, setOrcamentoParaReabrir] = useState<Orcamento | null>(null);
  const [orcamentoParaAprovar, setOrcamentoParaAprovar] = useState<Orcamento | null>(null);
  const [orcamentoParaRecusar, setOrcamentoParaRecusar] = useState<Orcamento | null>(null);
  const [respostaModalAberto, setRespostaModalAberto] = useState(false);
  const [orcamentoResposta, setOrcamentoResposta] = useState<Orcamento | null>(null);
  const [processandoAprovacao, setProcessandoAprovacao] = useState(false);

  const recarregarOrcamentos = useCallback(async () => {
    try {
      const response = await fetch("/api/orcamentos");
      if (!response.ok) return;
      const data = (await response.json()) as Orcamento[];
      setOrcamentos(Array.isArray(data) ? data : []);
    } catch {
      // ignora
    }
  }, []);

  const carregarProdutos = useCallback(async () => {
    setProdutos(await listarProdutosCatalogo());
  }, []);

  useEffect(() => {
    if (modalAberto) {
      void carregarProdutos();
      setFornecedores(readJson<FornecedorContato[]>(FORNECEDORES_STORAGE_KEY, []));
    }
  }, [modalAberto, carregarProdutos]);

  useEffect(() => {
    void recarregarOrcamentos();
    setFornecedores(readJson<FornecedorContato[]>(FORNECEDORES_STORAGE_KEY, []));
    void carregarProdutos();

    fetch("/api/session")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.name) setSessao({ name: data.name, email: data.email });
      });

    const atualizarProdutos = () => void carregarProdutos();
    window.addEventListener(PRODUTOS_ESTOQUE_EVENT, atualizarProdutos);
    return () => window.removeEventListener(PRODUTOS_ESTOQUE_EVENT, atualizarProdutos);
  }, [carregarProdutos, recarregarOrcamentos]);

  useEffect(() => {
    const intervalo = window.setInterval(() => {
      void recarregarOrcamentos();
    }, 15000);
    return () => window.clearInterval(intervalo);
  }, [recarregarOrcamentos]);

  const produtosOpcoes = useMemo(
    () =>
      produtos.map((produto) => ({
        id: produto.id,
        nome: produto.nome,
        marca: produto.marca,
        codigoBarras: produto.codigoBarras,
        valorCusto: produto.valorCusto ?? 0,
        estoque: produto.estoque ?? 0,
      })),
    [produtos]
  );

  const orcamentosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return orcamentos
      .filter((orcamento) => orcamento.status !== "excluido")
      .filter((orcamento) => {
        if (situacao !== "todos" && orcamento.status !== situacao) return false;
        if (!termo) return true;
        return (
          String(orcamento.numeroPedido).includes(termo) ||
          orcamento.fornecedorNome.toLowerCase().includes(termo) ||
          STATUS_ORCAMENTO[orcamento.status].label.toLowerCase().includes(termo)
        );
      });
  }, [busca, orcamentos, situacao]);

  const listagem = useListagemPaginada<Orcamento, "numeroPedido" | "data" | "fornecedor">({
    storageKey: "orcamentos",
    itens: orcamentosFiltrados,
    padrao: { ordenarPor: "numeroPedido", direcao: "desc", porPagina: 50 },
    comparadores: {
      numeroPedido: (a, b) => compararNumero(a.numeroPedido, b.numeroPedido),
      data: (a, b) => compararDataIso(a.data, b.data),
      fornecedor: (a, b) => compararTextoBr(a.fornecedorNome, b.fornecedorNome),
    },
  });

  function abrirNovo() {
    setOrcamentoAtual(null);
    setSomenteLeitura(false);
    setModalAberto(true);
  }

  function abrirEdicao(orcamento: Orcamento) {
    setOrcamentoAtual(orcamento);
    setSomenteLeitura(false);
    setModalAberto(true);
  }

  function abrirVisualizacao(orcamento: Orcamento) {
    if (orcamento.status === "enviado" || orcamento.status === "aprovado") {
      setOrcamentoResposta(orcamento);
      setRespostaModalAberto(true);
      return;
    }
    setOrcamentoAtual(orcamento);
    setSomenteLeitura(true);
    setModalAberto(true);
  }

  function abrirAprovacao(orcamento: Orcamento) {
    setOrcamentoResposta(orcamento);
    setRespostaModalAberto(true);
  }

  function solicitarAprovarOrcamento(orcamento: Orcamento) {
    setOrcamentoParaAprovar(orcamento);
  }

  async function confirmarAprovarOrcamento() {
    const orcamento = orcamentoParaAprovar;
    if (!orcamento) return;
    setOrcamentoParaAprovar(null);
    await alterarStatusOrcamento(orcamento, "aprovado");
  }

  function solicitarRecusarOrcamento(orcamento: Orcamento) {
    setOrcamentoParaRecusar(orcamento);
  }

  async function confirmarRecusarOrcamento() {
    const orcamento = orcamentoParaRecusar;
    if (!orcamento) return;
    setOrcamentoParaRecusar(null);
    await alterarStatusOrcamento(orcamento, "cancelado");
  }

  function fecharRespostaModal() {
    setRespostaModalAberto(false);
    setOrcamentoResposta(null);
  }

  function fecharModal() {
    setModalAberto(false);
    setOrcamentoAtual(null);
    setSomenteLeitura(false);
  }

  useEffect(() => {
    if (searchParams.get("novo") === "1") {
      setOrcamentoAtual(null);
      setSomenteLeitura(false);
      setModalAberto(true);
      return;
    }

    const orcamentoId = searchParams.get("orcamentoId");
    const pedido = searchParams.get("pedido");
    const acao = searchParams.get("acao");
    if (!orcamentoId && !pedido) return;

    const alvo =
      (orcamentoId && orcamentos.find((o) => o.id === orcamentoId)) ||
      (pedido &&
        orcamentos.find((o) => String(o.numeroPedido) === pedido.trim()));

    if (!alvo) {
      if (pedido) setBusca(pedido.trim());
      return;
    }

    setBusca(String(alvo.numeroPedido));
    if (acao === "resposta") {
      setOrcamentoResposta(alvo);
      setRespostaModalAberto(true);
      return;
    }
    abrirVisualizacao(alvo);
  }, [searchParams, orcamentos]);

  async function salvarOrcamento(
    payload: SalvarOrcamentoPayload
  ): Promise<SalvarOrcamentoResult | null> {
    const labTelefone = readJson<string>(LAB_TELEFONE_STORAGE_KEY, "");

    const body = {
      fornecedorId: payload.fornecedorId,
      fornecedorNome: payload.fornecedorNome,
      status: "aguardando_resposta" as const,
      itens: payload.itens,
      whatsappEnvio: payload.whatsappEnvio,
      observacoes: payload.observacoes,
      labNome: sessao?.name,
      labEmail: sessao?.email,
      labTelefone: labTelefone || undefined,
    };

    const response = payload.orcamentoId
      ? await fetch(`/api/orcamentos/${payload.orcamentoId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...body,
            itens: payload.itens,
          }),
        })
      : await fetch("/api/orcamentos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

    if (!response.ok) {
      alert("Não foi possível salvar o orçamento.");
      return null;
    }

    const data = (await response.json()) as Orcamento;
    await recarregarOrcamentos();
    fecharModal();

    return {
      token: data.token,
      numeroPedido: data.numeroPedido,
      whatsappEnvio: data.whatsappEnvio || payload.whatsappEnvio,
    };
  }

  async function confirmarExclusao() {
    if (!orcamentoParaExcluir) return;
    await fetch(`/api/orcamentos/${orcamentoParaExcluir.id}`, { method: "DELETE" });
    setOrcamentoParaExcluir(null);
    await recarregarOrcamentos();
  }

  async function sincronizarFinanceiroOrcamento(orcamento: Orcamento) {
    setProcessandoAprovacao(true);
    try {
      const response = await fetch(`/api/orcamentos/${orcamento.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "aprovado", forcarFinanceiro: true }),
      });
      const data = (await response.json()) as { message?: string; parcelasFinanceiro?: number };
      if (!response.ok) {
        alert(data.message || "Não foi possível gerar as parcelas.");
        return;
      }
      const n = data.parcelasFinanceiro ?? 0;
      alert(
        n > 0
          ? `${n} parcela(s) registrada(s) em Contas a Pagar.`
          : "Nenhuma parcela foi gerada. Verifique o total líquido e o parcelamento."
      );
    } finally {
      setProcessandoAprovacao(false);
    }
  }

  async function alterarStatusOrcamento(
    orcamento: Orcamento,
    status: "aprovado" | "cancelado"
  ) {
    setProcessandoAprovacao(true);
    try {
      const response = await fetch(`/api/orcamentos/${orcamento.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = (await response.json()) as Orcamento & {
        parcelasFinanceiro?: number;
        message?: string;
        estoqueJobId?: string | null;
      };
      if (!response.ok) {
        alert(data.message || "Não foi possível atualizar o orçamento.");
        return;
      }
      if (status === "aprovado") {
        const cond = parseCondicoesPagamento(orcamento.condicoesPagamento);
        const n = data.parcelasFinanceiro ?? 0;
        if (n > 0) {
          const parcelado = exigeParcelamento(cond.forma);
          alert(
            parcelado
              ? `Orçamento aprovado. ${n} parcela(s) em Contas a Pagar (vencimento a cada 30 dias). Veja em Financeiro › Contas a Pagar com filtro "Todos".`
              : `Orçamento aprovado. Despesa registrada em Contas a Pagar.`
          );
        } else if (exigeParcelamento(cond.forma)) {
          alert(
            "Orçamento aprovado, mas as parcelas não foram geradas. Verifique o valor líquido e tente novamente."
          );
        }

        /** Estoque + custos em job (issue 029) — não bloqueia o modal no client. */
        if (data.estoqueJobId) {
          try {
            await aguardarJobCliente(data.estoqueJobId, { timeoutMs: 60_000 });
            window.dispatchEvent(new Event(PRODUTOS_ESTOQUE_EVENT));
            void carregarProdutos();
          } catch (err) {
            console.warn("[orcamento] job estoque", err);
            alert(
              "Orçamento aprovado, mas a atualização de estoque ainda está processando. Atualize a página de produtos em instantes."
            );
          }
        }
      }
      await recarregarOrcamentos();
      fecharRespostaModal();
    } finally {
      setProcessandoAprovacao(false);
    }
  }

  function copiarLink(orcamento: Orcamento) {
    const url = orcamentoPublicUrl(orcamento.token);
    void navigator.clipboard.writeText(url);
    alert("Link copiado!");
  }

  async function confirmarReabrirLinkOrcamento() {
    const orcamento = orcamentoParaReabrir;
    if (!orcamento) return;

    setProcessandoAprovacao(true);
    try {
      const response = await fetch(`/api/orcamentos/${orcamento.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reabrirParaEdicao: true }),
      });
      const data = (await response.json()) as Orcamento & { message?: string };
      if (!response.ok) {
        alert(data.message || "Não foi possível reabrir o orçamento.");
        return;
      }

      await recarregarOrcamentos();

      const url = orcamentoPublicUrl(data.token);
      window.open(url, "_blank", "noopener,noreferrer");

      const telefone = data.whatsappEnvio?.trim();
      if (telefone) {
        const ok = abrirWhatsAppReenviarConferencia(
          telefone,
          data.numeroPedido,
          url
        );
        if (!ok) {
          alert(
            "Orçamento reaberto e link aberto no navegador. Não foi possível abrir o WhatsApp — verifique o número."
          );
        }
      } else {
        alert(
          "Orçamento reaberto. O link foi aberto em nova aba. Cadastre o WhatsApp do fornecedor para reenviar automaticamente."
        );
      }

      setOrcamentoParaReabrir(null);
      fecharRespostaModal();
    } finally {
      setProcessandoAprovacao(false);
    }
  }

  function enviarAprovacaoWhatsApp(orcamento: Orcamento) {
    const telefone = orcamento.whatsappEnvio?.trim();
    if (!telefone) {
      alert("Este pedido não possui WhatsApp do fornecedor cadastrado.");
      return;
    }
    const ok = abrirWhatsAppAprovacao(
      telefone,
      orcamento.numeroPedido,
      orcamento.fornecedorNome || "Fornecedor",
      formatCurrency(totalLiquido(orcamento))
    );
    if (!ok) {
      alert("Não foi possível abrir o WhatsApp. Verifique o número do fornecedor.");
    }
  }

  return (
    <div className="space-y-3 text-xs text-slate-600">
      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
        <span>Estoque</span>
        <span className="text-slate-400">&gt;</span>
        <span className="font-medium text-slate-600">Orçamento</span>
      </div>

      <h1 className="text-2xl font-normal text-slate-700">Estoque</h1>

      <button
        type="button"
        onClick={abrirNovo}
        className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-emerald-500 px-4 text-[11px] font-semibold text-white shadow-sm hover:bg-emerald-600"
      >
        <Plus className="h-4 w-4" />
        Solicitar Orçamento
      </button>

      <div className="rounded border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-end gap-4 border-b border-slate-100 px-4 py-3">
          <div className="w-44">
            <label className="mb-1 block text-[10px] font-medium text-slate-600">Situação</label>
            <select
              value={situacao}
              onChange={(e) => setSituacao(e.target.value as "todos" | StatusOrcamento)}
              className="h-8 w-full rounded-sm border border-slate-200 bg-white px-2 text-[11px] text-slate-700 outline-none focus:border-blue-400"
            >
              <option value="todos">Todos</option>
              <option value="enviado">Enviado</option>
              <option value="aguardando_resposta">Aguardando Resposta</option>
              <option value="aprovado">Aprovado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>

          <div className="min-w-[280px] flex-1">
            <label className="mb-1 block text-[10px] font-medium text-slate-600">Busca</label>
            <div className="flex">
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder=""
                className="h-8 min-w-0 flex-1 rounded-l-sm border border-r-0 border-slate-200 px-3 text-[11px] outline-none focus:border-blue-400"
              />
              <button
                type="button"
                onClick={() => setBusca("")}
                className="h-8 shrink-0 rounded-r-sm border border-slate-200 bg-slate-100 px-4 text-[11px] font-medium text-slate-600 hover:bg-slate-200"
              >
                Limpar
              </button>
            </div>
          </div>
        </div>

        <BarraConfigListagem
          embutido
          configAberto={listagem.configAberto}
          onToggleConfig={() =>
            listagem.configAberto ? listagem.fecharConfig() : listagem.abrirConfig()
          }
          onFecharConfig={listagem.fecharConfig}
          rascunho={listagem.rascunho}
          opcoesOrdenacao={[
            { valor: "numeroPedido", label: "ID" },
            { valor: "data", label: "Data" },
            { valor: "fornecedor", label: "Fornecedor" },
          ]}
          onAlterarOrdenarPor={(valor) => listagem.atualizarRascunho({ ordenarPor: valor })}
          onAlterarDirecao={(direcao) => listagem.atualizarRascunho({ direcao })}
          onAlterarPorPagina={(porPagina) => listagem.atualizarRascunho({ porPagina })}
          onGravarConfig={listagem.gravarConfig}
          pagina={listagem.pagina}
          totalPaginas={listagem.totalPaginas}
          onPagina={listagem.setPagina}
          totalItens={listagem.totalItens}
        >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-[10px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
                <th className="px-3 py-2.5 text-left font-semibold uppercase">ID</th>
                <th className="px-3 py-2.5 text-left font-semibold uppercase">Data</th>
                <th className="px-3 py-2.5 text-left font-semibold uppercase">Data Resposta</th>
                <th className="px-3 py-2.5 text-left font-semibold uppercase">Fornecedor</th>
                <th className="px-3 py-2.5 text-left font-semibold uppercase">Status</th>
                <th className="px-3 py-2.5 text-center font-semibold uppercase">Aprovação</th>
                <th className="px-3 py-2.5 text-center font-semibold uppercase">Enviar resposta</th>
                <th className="px-3 py-2.5 text-right font-semibold uppercase">Subtotal</th>
                <th className="px-3 py-2.5 text-center font-semibold uppercase">
                  Parcelamento
                </th>
                <th className="px-3 py-2.5 text-right font-semibold uppercase">Desc</th>
                <th className="px-3 py-2.5 text-right font-semibold uppercase">Total Líq</th>
                <th className="px-3 py-2.5 text-center font-semibold uppercase">Opções</th>
              </tr>
            </thead>
            <tbody>
              {listagem.totalItens === 0 ? (
                <tr>
                  <td colSpan={12} className="h-32" />
                </tr>
              ) : (
                listagem.itensPagina.map((orcamento) => {
                  const status = STATUS_ORCAMENTO[orcamento.status];
                  const liquido = totalLiquido(orcamento);
                  const linkAtivo = linkOrcamentoAtivo(
                    orcamento.status,
                    orcamento.linkAtivo
                  );
                  return (
                    <tr
                      key={orcamento.id}
                      className="border-b border-slate-50 text-slate-600 hover:bg-slate-50/50"
                    >
                      <td className="px-3 py-2">#{orcamento.numeroPedido}</td>
                      <td className="px-3 py-2">{formatarData(orcamento.data)}</td>
                      <td className="px-3 py-2">{formatarData(orcamento.dataResposta)}</td>
                      <td className="px-3 py-2">{orcamento.fornecedorNome || ""}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-[9px] font-semibold ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {orcamento.status === "enviado" ? (
                          <div className="flex flex-wrap items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => abrirAprovacao(orcamento)}
                              className="rounded-sm border border-blue-200 bg-blue-50 px-2 py-0.5 text-[9px] font-semibold text-blue-700 hover:bg-blue-100"
                            >
                              Ver orçamento
                            </button>
                            <button
                              type="button"
                              disabled={processandoAprovacao}
                              onClick={() => solicitarAprovarOrcamento(orcamento)}
                              className="inline-flex items-center gap-0.5 rounded-sm border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                            >
                              <Check className="h-3 w-3" />
                              Aprovar
                            </button>
                          </div>
                        ) : orcamento.status === "aprovado" ? (
                          <span className="text-[9px] font-semibold text-emerald-700">Aprovado</span>
                        ) : orcamento.status === "cancelado" ? (
                          <span className="text-[9px] font-semibold text-red-600">Recusado</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {orcamento.status === "aprovado" && orcamento.whatsappEnvio ? (
                          <button
                            type="button"
                            onClick={() => enviarAprovacaoWhatsApp(orcamento)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-emerald-600 transition hover:bg-emerald-50 hover:text-emerald-700"
                            title="Enviar resposta ao fornecedor no WhatsApp"
                          >
                            <IconWhatsApp />
                          </button>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {orcamento.status === "aguardando_resposta" && orcamento.subtotal === 0
                          ? ""
                          : formatCurrency(orcamento.subtotal)}
                      </td>
                      <td className="px-3 py-2 text-center text-slate-600">
                        <div className="flex flex-col items-center gap-0.5">
                          {orcamento.status === "aguardando_resposta" &&
                          !orcamento.condicoesPagamento
                            ? "—"
                            : rotuloParcelamentoColuna(orcamento.condicoesPagamento)}
                          {orcamento.status === "aprovado" &&
                            exigeParcelamento(
                              parseCondicoesPagamento(orcamento.condicoesPagamento).forma
                            ) && (
                              <button
                                type="button"
                                disabled={processandoAprovacao}
                                onClick={() => void sincronizarFinanceiroOrcamento(orcamento)}
                                className="text-[9px] font-medium text-blue-600 hover:underline disabled:opacity-50"
                                title="Gerar parcelas em Contas a Pagar"
                              >
                                Gerar parcelas
                              </button>
                            )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatCurrency(
                          orcamento.descontoPercentual > 0
                            ? orcamento.subtotal * (orcamento.descontoPercentual / 100)
                            : orcamento.desconto
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-slate-700">
                        {formatCurrency(liquido)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-2">
                          {linkAtivo && orcamento.status === "aguardando_resposta" && (
                            <button
                              type="button"
                              onClick={() => copiarLink(orcamento)}
                              className="text-slate-500 hover:text-slate-700"
                              title="Copiar link para o fornecedor"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => abrirVisualizacao(orcamento)}
                            className="text-blue-500 hover:text-blue-600"
                            title={
                              orcamento.status === "enviado" || orcamento.status === "aprovado"
                                ? "Ver resposta do fornecedor"
                                : "Visualizar pedido"
                            }
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          {orcamento.status === "aguardando_resposta" && (
                            <button
                              type="button"
                              onClick={() => abrirEdicao(orcamento)}
                              className="text-amber-500 hover:text-amber-600"
                              title="Editar"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setOrcamentoParaExcluir(orcamento)}
                            className="text-red-500 hover:text-red-600"
                            title="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        </BarraConfigListagem>
      </div>

      <OrcamentoFormModal
        open={modalAberto}
        onClose={fecharModal}
        onSave={salvarOrcamento}
        orcamento={orcamentoAtual}
        somenteLeitura={somenteLeitura}
        fornecedores={fornecedores}
        produtos={produtosOpcoes}
        preencherZerados={searchParams.get("novo") === "1" && !orcamentoAtual}
      />

      <OrcamentoRespostaModal
        open={respostaModalAberto}
        orcamento={orcamentoResposta}
        onClose={fecharRespostaModal}
        onAprovar={solicitarAprovarOrcamento}
        onRecusar={solicitarRecusarOrcamento}
        onReabrirLink={setOrcamentoParaReabrir}
        processando={processandoAprovacao}
      />

      <ConfirmacaoExclusaoModal
        open={!!orcamentoParaAprovar}
        titulo="Aprovar orçamento"
        mensagem={
          orcamentoParaAprovar
            ? `Deseja aprovar o orçamento #${orcamentoParaAprovar.numeroPedido}?`
            : ""
        }
        aviso="O custo dos produtos e o estoque serão atualizados. Despesas serão registradas em Contas a Pagar conforme o parcelamento."
        detalhe={
          orcamentoParaAprovar
            ? `${orcamentoParaAprovar.fornecedorNome || "Fornecedor"}`
            : undefined
        }
        tipoConfirmacao="primario"
        processando={processandoAprovacao}
        onClose={() => setOrcamentoParaAprovar(null)}
        onConfirm={() => void confirmarAprovarOrcamento()}
      />

      <ConfirmacaoExclusaoModal
        open={!!orcamentoParaRecusar}
        titulo="Recusar orçamento"
        mensagem={
          orcamentoParaRecusar
            ? `Deseja recusar o orçamento #${orcamentoParaRecusar.numeroPedido}?`
            : ""
        }
        aviso="O pedido será marcado como cancelado."
        detalhe={
          orcamentoParaRecusar
            ? `${orcamentoParaRecusar.fornecedorNome || "Fornecedor"}`
            : undefined
        }
        processando={processandoAprovacao}
        onClose={() => setOrcamentoParaRecusar(null)}
        onConfirm={() => void confirmarRecusarOrcamento()}
      />

      <ConfirmacaoExclusaoModal
        open={!!orcamentoParaReabrir}
        titulo="Reabrir orçamento"
        mensagem={
          orcamentoParaReabrir
            ? `Reabrir o pedido #${orcamentoParaReabrir.numeroPedido} para edição?`
            : ""
        }
        aviso='O status voltará para "Aguardando Resposta", o link será reaberto e o WhatsApp abrirá para você reenviar ao fornecedor.'
        detalhe={
          orcamentoParaReabrir
            ? `${orcamentoParaReabrir.fornecedorNome || "Fornecedor"}`
            : undefined
        }
        tipoConfirmacao="primario"
        labelConfirmar="Sim"
        labelCancelar="Não"
        processando={processandoAprovacao}
        onClose={() => setOrcamentoParaReabrir(null)}
        onConfirm={() => void confirmarReabrirLinkOrcamento()}
      />

      <ConfirmacaoExclusaoModal
        open={!!orcamentoParaExcluir}
        titulo="Excluir Orçamento"
        mensagem="Deseja realmente excluir esse orçamento?"
        aviso="Atenção!! O link público deixará de funcionar e o pedido será marcado como excluído."
        detalhe={
          orcamentoParaExcluir
            ? `Pedido #${orcamentoParaExcluir.numeroPedido} — ${orcamentoParaExcluir.fornecedorNome || "Fornecedor"}`
            : undefined
        }
        onClose={() => setOrcamentoParaExcluir(null)}
        onConfirm={() => void confirmarExclusao()}
      />
    </div>
  );
}
