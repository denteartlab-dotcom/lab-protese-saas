"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Wallet } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Button, CampoHoraBr, Modal } from "@/components/ui";
import { formatValorMonetarioInput, formatarValorMonetarioBr } from "@/lib/colaborador-remuneracao";
import {
  atualizarConfigERecalcular,
  carregarColaboradoresDiaria,
  celulasCalendarioMes,
  criarLancamentoDiaria,
  dataHojeKey,
  garantirConfigColaborador,
  horarioPadraoDoDia,
  chaveMesAtual,
  lancamentoDoDia,
  lerDiariasColaboradores,
  limparLancamentosMes,
  preencherMesComJornada,
  removerLancamentoDia,
  resumoDiariasMes,
  salvarDiariasColaboradores,
  sugerirValorDiaria,
  upsertLancamento,
  formatarHorasDecimais,
  type ColaboradorDiariaOrigem,
  type DiariasStore,
  type LancamentoDiaria,
} from "@/lib/diarias-colaboradores";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const DIAS_CABECALHO: MessageKey[] = [
  "producao.agenda.dia.seg",
  "producao.agenda.dia.ter",
  "producao.agenda.dia.qua",
  "producao.agenda.dia.qui",
  "producao.agenda.dia.sex",
  "producao.agenda.dia.sab",
  "producao.agenda.dia.dom",
];

const INTERVALOS = [0, 30, 60, 90, 120];

type Props = {
  open: boolean;
  onClose: () => void;
};

export function DiariasColaboradoresModal({ open, onClose }: Props) {
  const { t, locale } = useI18n();
  const hojeKey = dataHojeKey();
  const mesInicial = chaveMesAtual();
  const [store, setStore] = useState<DiariasStore>(() => lerDiariasColaboradores());
  const [colaboradores, setColaboradores] = useState<ColaboradorDiariaOrigem[]>([]);
  const [colaboradorId, setColaboradorId] = useState("");
  const [busca, setBusca] = useState("");
  const [ano, setAno] = useState(mesInicial.ano);
  const [mes, setMes] = useState(mesInicial.mes);
  const [diaSelecionado, setDiaSelecionado] = useState(hojeKey);
  const [salvoMsg, setSalvoMsg] = useState("");

  useEffect(() => {
    if (!open) return;
    const lista = carregarColaboradoresDiaria();
    let atual = lerDiariasColaboradores();
    for (const colaborador of lista) {
      atual = garantirConfigColaborador(atual, colaborador);
    }
    setColaboradores(lista);
    setStore(atual);
    setColaboradorId((id) => id || lista[0]?.id || "");
    setBusca("");
    setSalvoMsg("");
    const vigente = chaveMesAtual();
    setAno(vigente.ano);
    setMes(vigente.mes);
    setDiaSelecionado(dataHojeKey());
  }, [open]);

  const colaborador = colaboradores.find((item) => item.id === colaboradorId) || null;
  const config = colaborador ? store.configs[colaborador.id] : null;
  const celulas = useMemo(() => celulasCalendarioMes(ano, mes), [ano, mes]);
  const resumo = colaborador ? resumoDiariasMes(store, colaborador.id, ano, mes) : { dias: 0, horas: 0, valor: 0 };
  const lancamento = colaborador && config ? lancamentoDoDia(store, colaborador.id, diaSelecionado) : null;

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return colaboradores;
    return colaboradores.filter((item) => item.nome.toLowerCase().includes(termo));
  }, [busca, colaboradores]);

  const nomeMes = useMemo(() => {
    const tag = locale === "en" ? "en-US" : locale === "es" ? "es-ES" : "pt-BR";
    const texto = new Date(ano, mes - 1, 1).toLocaleDateString(tag, {
      month: "long",
      year: "numeric",
    });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }, [ano, locale, mes]);

  function selecionarColaborador(id: string) {
    const item = colaboradores.find((colab) => colab.id === id);
    if (!item) return;
    setStore((atual) => garantirConfigColaborador(atual, item));
    setColaboradorId(id);
  }

  function mudarMes(delta: number) {
    const data = new Date(ano, mes - 1 + delta, 1);
    setAno(data.getFullYear());
    setMes(data.getMonth() + 1);
  }

  function irParaHoje() {
    const vigente = chaveMesAtual();
    setAno(vigente.ano);
    setMes(vigente.mes);
    setDiaSelecionado(dataHojeKey());
  }

  function clicarDia(data: string) {
    if (!colaborador || !config) return;
    setDiaSelecionado(data);
    setStore((atual) => {
      if (lancamentoDoDia(atual, colaborador.id, data)) return atual;
      const cfg = atual.configs[colaborador.id] || config;
      return upsertLancamento(
        atual,
        criarLancamentoDiaria(
          colaborador.id,
          data,
          cfg,
          horarioPadraoDoDia(colaborador.cargaHoraria, data)
        )
      );
    });
  }

  function alterarLancamento(parcial: Partial<LancamentoDiaria>) {
    if (!colaborador || !lancamento || !config) return;
    setStore((atual) =>
      upsertLancamento(atual, {
        ...lancamento,
        ...parcial,
      })
    );
  }

  function gravar() {
    salvarDiariasColaboradores(store);
    setSalvoMsg(t("producao.diarias.salvo"));
  }

  return (
    <Modal open={open} onClose={onClose} title={t("producao.diarias.titulo")} size="smart">
      <div className="-mx-6 -my-4 flex min-h-[min(72vh,760px)] flex-col">
        <p className="border-b border-slate-100 px-6 py-2 text-[13px] text-slate-500">
          {t("producao.diarias.subtitulo")}
        </p>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col border-b border-slate-200 lg:border-b-0 lg:border-r">
            <div className="space-y-3 border-b border-slate-100 p-4">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {t("producao.diarias.configuracao")}
              </label>
              <div>
                <span className="mb-1 block text-[12px] text-slate-500">
                  {t("producao.diarias.valorDiaria")}
                </span>
                <input
                  value={config?.valorDiaria || "0,00"}
                  disabled={!config}
                  onChange={(e) => {
                    if (!config) return;
                    setStore((atual) =>
                      atualizarConfigERecalcular(atual, {
                        ...config,
                        valorDiaria: formatValorMonetarioInput(e.target.value),
                      })
                    );
                  }}
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-[14px] outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <span className="mb-1 block text-[12px] text-slate-500">
                  {t("producao.diarias.jornada")}
                </span>
                <input
                  type="number"
                  min={0.5}
                  max={24}
                  step={0.5}
                  value={config?.horasJornada ?? 8}
                  disabled={!config}
                  onChange={(e) => {
                    if (!config) return;
                    setStore((atual) =>
                      atualizarConfigERecalcular(atual, {
                        ...config,
                        horasJornada: Number(e.target.value) || 8,
                      })
                    );
                  }}
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-[14px] outline-none focus:border-blue-500"
                />
              </div>
              <button
                type="button"
                disabled={!colaborador}
                onClick={() => {
                  if (!colaborador || !config) return;
                  setStore((atual) =>
                    atualizarConfigERecalcular(atual, {
                      ...config,
                      valorDiaria: sugerirValorDiaria(colaborador.valorSalario),
                    })
                  );
                }}
                className="text-[12px] font-medium text-blue-600 hover:underline disabled:text-slate-400"
              >
                {t("producao.diarias.sugerirSalario")}
              </button>
            </div>

            <div className="p-4 pb-2">
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {t("producao.diarias.colaboradores")}
              </label>
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder={t("producao.diarias.buscar")}
                className="h-9 w-full rounded-lg border border-slate-300 px-3 text-[13px] outline-none focus:border-blue-500"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
              {filtrados.length === 0 ? (
                <p className="px-2 py-6 text-center text-[13px] text-slate-400">
                  {t("producao.diarias.semColaboradores")}
                </p>
              ) : (
                filtrados.map((item) => {
                  const total = resumoDiariasMes(store, item.id, ano, mes);
                  const ativo = item.id === colaboradorId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selecionarColaborador(item.id)}
                      className={cn(
                        "mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left",
                        ativo ? "bg-blue-50 text-blue-800" : "hover:bg-slate-50"
                      )}
                    >
                      <span className="truncate text-[13px] font-medium">{item.nome}</span>
                      <span
                        className={cn(
                          "ml-2 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          ativo ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                        )}
                      >
                        {t("producao.diarias.dias", { n: total.dias })}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <section className="flex min-h-0 flex-col p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => mudarMes(-1)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                  aria-label={t("producao.diarias.mesAnterior")}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h3 className="min-w-[180px] text-center text-[16px] font-semibold capitalize text-slate-800">
                  {nomeMes}
                </h3>
                <button
                  type="button"
                  onClick={() => mudarMes(1)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                  aria-label={t("producao.diarias.proximoMes")}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={irParaHoje}>
                  {t("producao.diarias.hoje")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!colaborador}
                  onClick={() => {
                    if (!colaborador) return;
                    setStore((atual) =>
                      preencherMesComJornada(atual, colaborador.id, ano, mes, colaborador.cargaHoraria)
                    );
                  }}
                >
                  {t("producao.diarias.marcarJornada")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!colaborador}
                  onClick={() => {
                    if (!colaborador) return;
                    setStore((atual) => limparLancamentosMes(atual, colaborador.id, ano, mes));
                  }}
                >
                  {t("producao.diarias.limparMes")}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {DIAS_CABECALHO.map((chave) => (
                <span key={chave} className="py-1">
                  {t(chave)}
                </span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {celulas.map((data, indice) => {
                if (!data) {
                  return <div key={`vazio-${indice}`} className="min-h-[72px] rounded-lg bg-slate-50" />;
                }
                const item = colaborador ? lancamentoDoDia(store, colaborador.id, data) : null;
                const selecionado = data === diaSelecionado;
                const hoje = data === hojeKey;
                const diaNum = Number(data.slice(-2));
                return (
                  <button
                    key={data}
                    type="button"
                    disabled={!colaborador}
                    onClick={() => clicarDia(data)}
                    className={cn(
                      "flex min-h-[72px] flex-col rounded-lg border px-1.5 py-1.5 text-left transition",
                      item
                        ? "border-blue-200 bg-blue-50 hover:bg-blue-100"
                        : "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50",
                      selecionado && "ring-2 ring-blue-500",
                      hoje && !selecionado && "border-blue-400"
                    )}
                  >
                    <span
                      className={cn(
                        "text-[12px] font-semibold",
                        item ? "text-blue-800" : "text-slate-600",
                        hoje && "text-blue-600"
                      )}
                    >
                      {diaNum}
                    </span>
                    {item ? (
                      <>
                        <span className="mt-0.5 text-[10px] text-blue-700">
                          {item.entrada}–{item.saida}
                        </span>
                        <span className="text-[11px] font-semibold text-blue-900">
                          {formatarValorMonetarioBr(item.valor)}
                        </span>
                      </>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              {!colaborador ? (
                <p className="text-[13px] text-slate-500">{t("producao.diarias.semColaboradores")}</p>
              ) : !lancamento ? (
                <p className="text-[13px] text-slate-500">{t("producao.diarias.diaLivre")}</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <CampoHoraBr
                    label={t("producao.diarias.entrada")}
                    value={lancamento.entrada}
                    onChange={(value) => alterarLancamento({ entrada: value })}
                    calendarZIndex={90}
                  />
                  <CampoHoraBr
                    label={t("producao.diarias.saida")}
                    value={lancamento.saida}
                    onChange={(value) => alterarLancamento({ saida: value })}
                    calendarZIndex={90}
                  />
                  <label className="block text-sm">
                    <span className="mb-1 block text-slate-600">{t("producao.diarias.intervalo")}</span>
                    <select
                      value={lancamento.intervaloMinutos}
                      onChange={(e) =>
                        alterarLancamento({ intervaloMinutos: Number(e.target.value) || 0 })
                      }
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                    >
                      {INTERVALOS.map((minutos) => (
                        <option key={minutos} value={minutos}>
                          {t("producao.diarias.minutos", { n: minutos })}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex flex-col justify-end">
                    <p className="text-[12px] text-slate-500">{t("producao.diarias.horas")}</p>
                    <p className="text-[18px] font-semibold text-slate-800">
                      {formatarHorasDecimais(lancamento.horas)}
                    </p>
                    <p className="text-[13px] font-medium text-blue-700">
                      {formatarValorMonetarioBr(lancamento.valor)}
                    </p>
                  </div>
                  <label className="block sm:col-span-2 lg:col-span-3">
                    <span className="mb-1 block text-[12px] text-slate-500">
                      {t("producao.diarias.observacao")}
                    </span>
                    <input
                      value={lancamento.observacao || ""}
                      onChange={(e) => alterarLancamento({ observacao: e.target.value })}
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-[13px] outline-none focus:border-blue-500"
                    />
                  </label>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        if (!colaborador) return;
                        setStore((atual) => removerLancamentoDia(atual, colaborador.id, diaSelecionado));
                      }}
                    >
                      {t("producao.diarias.removerDia")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700">
              <Wallet className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {t("producao.diarias.totalMes")}
              </p>
              <p className="text-[15px] font-semibold text-slate-800">
                {t("producao.diarias.dias", { n: resumo.dias })} · {formatarHorasDecimais(resumo.horas)} ·{" "}
                {formatarValorMonetarioBr(resumo.valor)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {salvoMsg ? <span className="text-[13px] text-emerald-600">{salvoMsg}</span> : null}
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancelar")}
            </Button>
            <Button type="button" onClick={gravar} disabled={!colaborador}>
              {t("producao.diarias.gravar")}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
