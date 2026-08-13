"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  Loader2,
  Pencil,
  Trash2,
  Ban,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui";
import { ConfirmacaoExclusaoModal } from "@/components/ConfirmacaoExclusaoModal";
import { PaginacaoLista } from "@/components/listagem/PaginacaoLista";
import { useI18n } from "@/components/i18n-provider";
import type { MessageKey } from "@/lib/i18n";
import { cobrancaAsaasPermiteSegundaVia } from "@/lib/asaas-cobranca-status";
import { formatMoedaContaBancaria } from "@/lib/i18n/conta-bancaria-i18n";
import { cn } from "@/lib/utils";

const LINHAS_POR_PAGINA = 20;

type BoletoItem = {
  id: string;
  status: string;
  valor: number;
  vencimento: string;
  clienteNome: string | null;
  numeroOs: string | number | null;
  descricao: string;
  bankSlipUrl: string | null;
  invoiceUrl: string | null;
  linhaDigitavel: string | null;
  interest: number | null;
  fine: number | null;
  editavel: boolean;
};

type Props = {
  onMensagem?: (texto: string, tipo: "sucesso" | "erro") => void;
};

const labelClass = "mb-1 block text-[11px] font-medium text-slate-600";
const inputClass =
  "h-9 w-full rounded border border-slate-300 bg-white px-2.5 text-[12px] text-slate-800 outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]";

/** Formata percentual BR com 2 casas (ex.: digitar 5 → 0,05). */
function formatarPercentualInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 6);
  if (!digits) return "";
  const n = Number(digits) / 100;
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatarPercentualExibicao(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function parsePercentualBr(value: string): number {
  const cleaned = value.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function percentualParaInput(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return formatarPercentualInput("0");
  }
  const centesimos = Math.round(value * 100);
  return formatarPercentualInput(String(centesimos));
}

function rotuloStatus(
  status: string,
  t: (key: MessageKey, params?: Record<string, string | number>) => string
) {
  const s = status.toUpperCase();
  if (s === "PENDING") return t("financeiro.conta.digital.boletos.status.pending");
  if (s === "OVERDUE") return t("financeiro.conta.digital.boletos.status.overdue");
  if (s === "RECEIVED" || s === "CONFIRMED" || s === "RECEIVED_IN_CASH") {
    return t("financeiro.conta.digital.boletos.status.paid");
  }
  if (s === "DELETED") return t("financeiro.conta.digital.boletos.status.deleted");
  return status;
}

export function BoletosAsaasContaDigital({ onMensagem }: Props) {
  const { t, locale } = useI18n();
  const money = useCallback(
    (value: number) => formatMoedaContaBancaria(value, locale),
    [locale]
  );

  const [boletos, setBoletos] = useState<BoletoItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [statusFiltro, setStatusFiltro] = useState("");
  const [busca, setBusca] = useState("");
  const [vencimentoDe, setVencimentoDe] = useState("");
  const [vencimentoAte, setVencimentoAte] = useState("");
  const [editando, setEditando] = useState<BoletoItem | null>(null);
  const [boletoCancelar, setBoletoCancelar] = useState<BoletoItem | null>(null);
  const [formDueDate, setFormDueDate] = useState("");
  const [formInterest, setFormInterest] = useState("");
  const [formFine, setFormFine] = useState("");
  const [pagina, setPagina] = useState(1);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const sp = new URLSearchParams();
      if (statusFiltro) sp.set("status", statusFiltro);
      if (busca.trim()) sp.set("busca", busca.trim());
      if (vencimentoDe) sp.set("vencimentoDe", vencimentoDe);
      if (vencimentoAte) sp.set("vencimentoAte", vencimentoAte);
      sp.set("limit", "500");
      const res = await fetch(`/api/asaas/boletos?${sp.toString()}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as { boletos?: BoletoItem[]; error?: string };
      if (!res.ok) {
        throw new Error(data.error || t("financeiro.conta.digital.boletos.erroCarregar"));
      }
      setBoletos(data.boletos || []);
      setPagina(1);
    } catch (err) {
      onMensagem?.(
        err instanceof Error
          ? err.message
          : t("financeiro.conta.digital.boletos.erroCarregar"),
        "erro"
      );
    } finally {
      setCarregando(false);
    }
  }, [statusFiltro, busca, vencimentoDe, vencimentoAte, onMensagem, t]);

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- busca intencional só no refresh
  }, [statusFiltro, vencimentoDe, vencimentoAte]);

  const totalPaginas = Math.max(1, Math.ceil(boletos.length / LINHAS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const boletosPagina = useMemo(() => {
    const inicio = (paginaAtual - 1) * LINHAS_POR_PAGINA;
    return boletos.slice(inicio, inicio + LINHAS_POR_PAGINA);
  }, [boletos, paginaAtual]);
  const inicioExibido =
    boletos.length === 0 ? 0 : (paginaAtual - 1) * LINHAS_POR_PAGINA + 1;
  const fimExibido = Math.min(paginaAtual * LINHAS_POR_PAGINA, boletos.length);

  function abrirEdicao(boleto: BoletoItem) {
    setEditando(boleto);
    setFormDueDate(boleto.vencimento?.slice(0, 10) || "");
    setFormInterest(percentualParaInput(boleto.interest));
    setFormFine(percentualParaInput(boleto.fine));
  }

  async function salvarEdicao() {
    if (!editando) return;
    setProcessandoId(editando.id);
    try {
      const res = await fetch(`/api/asaas/boletos/${encodeURIComponent(editando.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dueDate: formDueDate || undefined,
          interest: parsePercentualBr(formInterest),
          fine: parsePercentualBr(formFine),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || t("financeiro.conta.digital.boletos.erroAtualizar"));
      }
      onMensagem?.(t("financeiro.conta.digital.boletos.sucessoAtualizar"), "sucesso");
      setEditando(null);
      await carregar();
    } catch (err) {
      onMensagem?.(
        err instanceof Error
          ? err.message
          : t("financeiro.conta.digital.boletos.erroAtualizar"),
        "erro"
      );
    } finally {
      setProcessandoId(null);
    }
  }

  async function removerJurosMulta(boleto: BoletoItem) {
    if (!boleto.editavel) return;
    setProcessandoId(boleto.id);
    try {
      const res = await fetch(`/api/asaas/boletos/${encodeURIComponent(boleto.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removerJurosMulta: true }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || t("financeiro.conta.digital.boletos.erroAtualizar"));
      }
      onMensagem?.(t("financeiro.conta.digital.boletos.sucessoRemoverJuros"), "sucesso");
      await carregar();
    } catch (err) {
      onMensagem?.(
        err instanceof Error
          ? err.message
          : t("financeiro.conta.digital.boletos.erroAtualizar"),
        "erro"
      );
    } finally {
      setProcessandoId(null);
    }
  }

  async function confirmarCancelarBoleto() {
    if (!boletoCancelar?.editavel) return;
    const boleto = boletoCancelar;
    setProcessandoId(boleto.id);
    try {
      const res = await fetch(`/api/asaas/boletos/${encodeURIComponent(boleto.id)}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || t("financeiro.conta.digital.boletos.erroCancelar"));
      }
      onMensagem?.(t("financeiro.conta.digital.boletos.sucessoCancelar"), "sucesso");
      await carregar();
    } catch (err) {
      onMensagem?.(
        err instanceof Error
          ? err.message
          : t("financeiro.conta.digital.boletos.erroCancelar"),
        "erro"
      );
    } finally {
      setProcessandoId(null);
    }
  }

  const linkBoleto = (b: BoletoItem) => b.bankSlipUrl || b.invoiceUrl;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="min-w-[140px] flex-1">
          <label className={labelClass}>{t("financeiro.conta.digital.boletos.filtroBusca")}</label>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className={inputClass}
            placeholder={t("financeiro.conta.digital.boletos.placeholderBusca")}
          />
        </div>
        <div className="w-[150px]">
          <label className={labelClass}>{t("financeiro.conta.digital.boletos.filtroStatus")}</label>
          <select
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value)}
            className={inputClass}
          >
            <option value="">{t("financeiro.conta.digital.boletos.statusTodos")}</option>
            <option value="PENDING">{t("financeiro.conta.digital.boletos.status.pending")}</option>
            <option value="OVERDUE">{t("financeiro.conta.digital.boletos.status.overdue")}</option>
            <option value="RECEIVED">{t("financeiro.conta.digital.boletos.status.paid")}</option>
            <option value="DELETED">{t("financeiro.conta.digital.boletos.status.deleted")}</option>
          </select>
        </div>
        <div className="w-[140px]">
          <label className={labelClass}>{t("financeiro.conta.digital.boletos.vencimentoDe")}</label>
          <input
            type="date"
            value={vencimentoDe}
            onChange={(e) => setVencimentoDe(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="w-[140px]">
          <label className={labelClass}>{t("financeiro.conta.digital.boletos.vencimentoAte")}</label>
          <input
            type="date"
            value={vencimentoAte}
            onChange={(e) => setVencimentoAte(e.target.value)}
            className={inputClass}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-9 gap-1.5 text-[12px]"
          onClick={() => void carregar()}
          disabled={carregando}
        >
          {carregando ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {t("financeiro.conta.digital.boletos.atualizar")}
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-[12px]">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] text-slate-500">
            <tr>
              <th className="px-3 py-2">{t("financeiro.conta.digital.boletos.col.cliente")}</th>
              <th className="px-3 py-2 text-right">{t("financeiro.conta.digital.boletos.col.valor")}</th>
              <th className="px-3 py-2">{t("financeiro.conta.digital.boletos.col.vencimento")}</th>
              <th className="px-3 py-2">{t("financeiro.conta.digital.boletos.col.status")}</th>
              <th className="px-3 py-2 text-right">{t("financeiro.conta.digital.boletos.col.juros")}</th>
              <th className="px-3 py-2 text-right">{t("financeiro.conta.digital.boletos.col.multa")}</th>
              <th className="px-3 py-2 text-right">{t("financeiro.conta.digital.boletos.col.acoes")}</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("financeiro.conta.digital.boletos.carregando")}
                  </span>
                </td>
              </tr>
            ) : boletos.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  {t("financeiro.conta.digital.boletos.vazio")}
                </td>
              </tr>
            ) : (
              boletosPagina.map((b) => {
                const busy = processandoId === b.id;
                const href =
                  cobrancaAsaasPermiteSegundaVia(b.status) ? linkBoleto(b) : null;
                return (
                  <tr key={b.id} className="border-b border-slate-100">
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-800">
                        {b.clienteNome || t("financeiro.conta.digital.boletos.semCliente")}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {b.numeroOs != null
                          ? t("financeiro.conta.digital.boletos.os", {
                              os: String(b.numeroOs),
                            })
                          : b.descricao.slice(0, 60)}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {money(b.valor)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{b.vencimento}</td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          b.status === "OVERDUE"
                            ? "border-red-200 bg-red-50 text-red-700"
                            : b.editavel
                              ? "border-amber-200 bg-amber-50 text-amber-800"
                              : b.status === "DELETED"
                                ? "border-slate-200 bg-slate-50 text-slate-600"
                                : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        )}
                      >
                        {rotuloStatus(b.status, t)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatarPercentualExibicao(b.interest)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatarPercentualExibicao(b.fine)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            title={t("financeiro.conta.digital.boletos.verBoleto")}
                            className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-[#4a90d9]"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                        {b.editavel ? (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              title={t("financeiro.conta.digital.boletos.editar")}
                              onClick={() => abrirEdicao(b)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-[#4a90d9] disabled:opacity-40"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              title={t("financeiro.conta.digital.boletos.removerJurosMulta")}
                              onClick={() => void removerJurosMulta(b)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-amber-700 disabled:opacity-40"
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              title={t("financeiro.conta.digital.boletos.cancelar")}
                              onClick={() => setBoletoCancelar(b)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                            >
                              {busy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {!carregando && boletos.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/80 px-3 py-1">
            <p className="px-2 text-[11px] text-slate-500">
              {t("financeiro.conta.digital.boletos.paginacaoResumo", {
                inicio: inicioExibido,
                fim: fimExibido,
                total: boletos.length,
              })}
            </p>
            <PaginacaoLista
              pagina={paginaAtual}
              totalPaginas={totalPaginas}
              onPagina={setPagina}
              className="border-t-0 py-2"
            />
          </div>
        ) : null}
      </div>

      {editando ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
            <h4 className="text-[14px] font-semibold text-slate-800">
              {t("financeiro.conta.digital.boletos.modalTitulo")}
            </h4>
            <p className="mt-1 text-[11px] text-slate-500">
              {editando.clienteNome || editando.descricao}
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className={labelClass}>
                  {t("financeiro.conta.digital.boletos.campoVencimento")}
                </label>
                <input
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>
                  {t("financeiro.conta.digital.boletos.campoJuros")}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formInterest}
                  onChange={(e) => setFormInterest(formatarPercentualInput(e.target.value))}
                  className={inputClass}
                  placeholder={t("financeiro.conta.digital.boletos.placeholderPercentual")}
                />
              </div>
              <div>
                <label className={labelClass}>
                  {t("financeiro.conta.digital.boletos.campoMulta")}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formFine}
                  onChange={(e) => setFormFine(formatarPercentualInput(e.target.value))}
                  className={inputClass}
                  placeholder={t("financeiro.conta.digital.boletos.placeholderPercentual")}
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-9 text-[12px]"
                onClick={() => setEditando(null)}
                disabled={processandoId === editando.id}
              >
                {t("financeiro.conta.digital.boletos.cancelarModal")}
              </Button>
              <Button
                type="button"
                className="h-9 bg-[#4a90d9] text-[12px] text-white hover:bg-[#3d7fc4]"
                onClick={() => void salvarEdicao()}
                disabled={processandoId === editando.id}
              >
                {processandoId === editando.id ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : null}
                {t("financeiro.conta.digital.boletos.salvar")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmacaoExclusaoModal
        open={boletoCancelar !== null}
        titulo={t("financeiro.conta.digital.boletos.cancelarTitulo")}
        mensagem={t("financeiro.conta.digital.boletos.confirmarCancelar")}
        aviso={
          boletoCancelar
            ? t("financeiro.conta.digital.boletos.cancelarDetalhe", {
                cliente:
                  boletoCancelar.clienteNome ||
                  t("financeiro.conta.digital.boletos.semCliente"),
                valor: money(boletoCancelar.valor),
              })
            : undefined
        }
        onClose={() => setBoletoCancelar(null)}
        onConfirm={confirmarCancelarBoleto}
        processando={Boolean(boletoCancelar && processandoId === boletoCancelar.id)}
        labelConfirmar={t("financeiro.conta.digital.boletos.simCancelar")}
        labelCancelar={t("financeiro.conta.digital.boletos.nao")}
      />
    </div>
  );
}
