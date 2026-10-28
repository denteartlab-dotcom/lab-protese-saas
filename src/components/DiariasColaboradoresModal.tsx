"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Printer, Wallet } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Button, Modal } from "@/components/ui";
import {
  formatValorMonetarioInput,
  formatarValorMonetarioBr,
  parseValorNumericoBr,
} from "@/lib/colaborador-remuneracao";
import {
  aplicarValorManualLancamento,
  atualizarConfigERecalcular,
  carregarColaboradoresDiaria,
  celulasCalendarioMes,
  criarLancamentoDiaria,
  dataHojeKey,
  duracaoHorasEntre,
  duracoesEfetivas,
  ENTRADA_TARDE_PADRAO,
  formatarHoraDigitada,
  formatarHorasDecimais,
  garantirConfigColaborador,
  HORAS_TURNO_PADRAO,
  horarioLancamentoPadrao,
  horarioPorDuracao,
  horaTextoValida,
  INTERVALO_HORAS_PADRAO,
  limitarDuracaoHoras,
  limitarHoraNoPeriodo,
  chaveMesAtual,
  lancamentoDoDia,
  lancamentosDoMes,
  lerDiariasColaboradores,
  limparLancamentosMes,
  preencherMesComJornada,
  recalcularLancamento,
  removerLancamentoDia,
  resumoDiariasMes,
  SAIDA_MANHA_PADRAO,
  salvarDiariasColaboradores,
  turnosAtivosLancamento,
  sincronizarDiariasStoreNoCadastro,
  sugerirValorDiaria,
  textoHorarioLancamento,
  textoIntervaloLancamento,
  upsertLancamento,
  type ColaboradorDiariaOrigem,
  type ConfigDiariaColaborador,
  type DiariasStore,
  type LancamentoDiaria,
} from "@/lib/diarias-colaboradores";
import { sincronizarDespesasDiariasColaboradores } from "@/lib/despesa-diaria-colaborador";
import { imprimirNotasPagamentoDiarias } from "@/lib/imprimir-nota-diarias";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const HORA_DIA_MIN = "00:00";
const HORA_DIA_MAX = "23:59";

const DIAS_CABECALHO: MessageKey[] = [
  "producao.agenda.dia.seg",
  "producao.agenda.dia.ter",
  "producao.agenda.dia.qua",
  "producao.agenda.dia.qui",
  "producao.agenda.dia.sex",
  "producao.agenda.dia.sab",
  "producao.agenda.dia.dom",
];

type Props = {
  open: boolean;
  onClose: () => void;
};

function CampoHoraTexto({
  label,
  value,
  onChange,
  placeholder,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  min: string;
  max: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-600">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        maxLength={5}
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          const formatado = formatarHoraDigitada(event.target.value, value);
          onChange(formatado);
          const el = event.target;
          const fim = formatado.length;
          requestAnimationFrame(() => el.setSelectionRange(fim, fim));
        }}
        onBlur={() => onChange(limitarHoraNoPeriodo(horaTextoValida(value), min, max))}
        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500"
      />
    </label>
  );
}

function CampoDuracao({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const [texto, setTexto] = useState(() => String(value));
  const focado = useRef(false);

  useEffect(() => {
    if (focado.current) return;
    setTexto(String(value));
  }, [value]);

  function publicar(bruto: string) {
    const numero = Number(bruto.replace(",", "."));
    if (!Number.isFinite(numero)) return;
    const limitado = Math.min(max, Math.max(min, numero));
    onChange(limitado);
    return limitado;
  }

  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-600">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={0.5}
        value={texto}
        onFocus={() => {
          focado.current = true;
        }}
        onBlur={() => {
          focado.current = false;
          const limitado = publicar(texto);
          setTexto(String(limitado ?? value));
        }}
        onChange={(event) => {
          const bruto = event.target.value;
          setTexto(bruto);
          if (!bruto || bruto === "-" || bruto.endsWith(".") || bruto.endsWith(",")) return;
          publicar(bruto);
        }}
        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500"
      />
    </label>
  );
}

function DuracaoTurnosConfig({
  config,
  carga,
  data,
  labelManha,
  labelTarde,
  labelIntervalo,
  ajuda,
  onChange,
}: {
  config: ConfigDiariaColaborador;
  carga: ColaboradorDiariaOrigem["cargaHoraria"];
  data: string;
  labelManha: string;
  labelTarde: string;
  labelIntervalo: string;
  ajuda: string;
  onChange: (parcial: {
    horasTurnoManha?: number;
    horasTurnoTarde?: number;
    intervaloHoras?: number;
  }) => void;
}) {
  const duracao = duracoesEfetivas(config, carga, data);
  return (
    <div className="space-y-2">
      <CampoDuracao
        label={labelManha}
        value={duracao.horasTurnoManha}
        min={0.5}
        max={12}
        onChange={(horasTurnoManha) => onChange({ horasTurnoManha })}
      />
      <CampoDuracao
        label={labelTarde}
        value={duracao.horasTurnoTarde}
        min={0.5}
        max={12}
        onChange={(horasTurnoTarde) => onChange({ horasTurnoTarde })}
      />
      <CampoDuracao
        label={labelIntervalo}
        value={duracao.intervaloHoras}
        min={0}
        max={6}
        onChange={(intervaloHoras) => onChange({ intervaloHoras })}
      />
      <p className="text-[11px] leading-snug text-slate-400">{ajuda}</p>
    </div>
  );
}

function ToggleCalculoHoras({
  checked,
  onChange,
  titulo,
  ajuda,
}: {
  checked: boolean;
  onChange: (ativo: boolean) => void;
  titulo: string;
  ajuda: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex w-full items-center gap-4 rounded-xl border px-4 py-3 text-left transition",
        checked ? "border-[#4cae4c] bg-[#f3fbf3]" : "border-slate-200 bg-white hover:border-slate-300"
      )}
    >
      <span
        className={cn(
          "relative h-9 w-16 shrink-0 rounded-full transition-colors",
          checked ? "bg-[#4cae4c]" : "bg-slate-300"
        )}
      >
        <span
          className={cn(
            "absolute top-1 h-7 w-7 rounded-full bg-white shadow transition-transform",
            checked ? "left-8" : "left-1"
          )}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold text-slate-800">{titulo}</span>
        <span className="block text-[12px] leading-snug text-slate-500">{ajuda}</span>
      </span>
    </button>
  );
}

function ToggleTurno({
  checked,
  onChange,
  label,
  faixa,
}: {
  checked: boolean;
  onChange: (ativo: boolean) => void;
  label: string;
  faixa: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-[#4cae4c]" : "bg-slate-300"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked ? "left-[22px]" : "left-0.5"
          )}
        />
      </button>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-slate-800">{label}</span>
        <span className="block text-[11px] text-slate-500">{faixa}</span>
      </span>
    </div>
  );
}

function ValorDiariaEditavel({
  valor,
  onChange,
  titulo,
}: {
  valor: number;
  onChange: (valor: number) => void;
  titulo: string;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState("0,00");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editando) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editando]);

  function confirmar() {
    onChange(parseValorNumericoBr(texto));
    setEditando(false);
  }

  if (!editando) {
    return (
      <button
        type="button"
        title={titulo}
        onClick={() => {
          setTexto(formatValorMonetarioInput(String(Math.round((Number(valor) || 0) * 100))));
          setEditando(true);
        }}
        className="text-left text-[13px] font-medium text-blue-700 hover:underline"
      >
        {formatarValorMonetarioBr(valor)}
      </button>
    );
  }

  return (
    <div className="flex h-9 max-w-[160px] overflow-hidden rounded-lg border border-blue-400 bg-white">
      <span className="flex w-10 shrink-0 items-center justify-center border-r border-slate-200 text-[12px] text-slate-500">
        R$
      </span>
      <input
        ref={inputRef}
        value={texto}
        onChange={(event) => setTexto(formatValorMonetarioInput(event.target.value))}
        onBlur={confirmar}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            confirmar();
          }
          if (event.key === "Escape") setEditando(false);
        }}
        className="w-full px-2 text-[13px] text-slate-800 outline-none"
      />
    </div>
  );
}

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
  const [imprimindo, setImprimindo] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    const lista = carregarColaboradoresDiaria();
    let atual = lerDiariasColaboradores();
    for (const colaborador of lista) {
      atual = garantirConfigColaborador(atual, colaborador);
    }
    atual = {
      ...atual,
      lancamentos: atual.lancamentos.map((lancamento) => {
        const cfg = atual.configs[lancamento.colaboradorId];
        return cfg ? recalcularLancamento(lancamento, cfg) : lancamento;
      }),
    };
    setColaboradores(lista);
    setStore(atual);
    setColaboradorId((id) => (lista.some((item) => item.id === id) ? id : lista[0]?.id || ""));
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
          horarioLancamentoPadrao(cfg, colaborador.cargaHoraria, data)
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

  function alterarHorario(
    campo: "entrada" | "saidaManha" | "entradaTarde" | "saida",
    valor: string
  ) {
    if (!lancamento || !colaborador || !config) return;
    const turnos = turnosAtivosLancamento(lancamento);
    const horario = horarioLancamentoPadrao(config, colaborador.cargaHoraria, lancamento.data);
    const proximo = {
      turnoManha: turnos.manha,
      turnoTarde: turnos.tarde,
      entrada: campo === "entrada" ? valor : lancamento.entrada || horario.entrada,
      saidaManha: campo === "saidaManha" ? valor : lancamento.saidaManha || horario.saidaManha,
      entradaTarde: campo === "entradaTarde" ? valor : lancamento.entradaTarde || horario.entradaTarde,
      saida: campo === "saida" ? valor : lancamento.saida || horario.saida,
    };
    const intervalo = duracaoHorasEntre(proximo.saidaManha, proximo.entradaTarde);
    alterarLancamento({
      ...proximo,
      intervaloMinutos: Math.round(intervalo * 60),
      ...(lancamento.calcularPorHora ? { valorManual: false } : {}),
    });
  }

  function alterarDuracaoDia(parcial: {
    horasManha?: number;
    horasTarde?: number;
    intervaloHoras?: number;
  }) {
    if (!lancamento || !colaborador || !config) return;
    const turnos = turnosAtivosLancamento(lancamento);
    const atual = duracoesEfetivas(config, colaborador.cargaHoraria, lancamento.data);
    const manhaMedida = duracaoHorasEntre(lancamento.entrada, lancamento.saidaManha);
    const tardeMedida = duracaoHorasEntre(lancamento.entradaTarde, lancamento.saida);
    const intervaloMedido =
      horaTextoValida(lancamento.saidaManha || "") && horaTextoValida(lancamento.entradaTarde || "")
        ? duracaoHorasEntre(lancamento.saidaManha, lancamento.entradaTarde)
        : atual.intervaloHoras;
    const horasManha = limitarDuracaoHoras(
      parcial.horasManha ?? (manhaMedida > 0 ? manhaMedida : atual.horasTurnoManha),
      0.5,
      12,
      HORAS_TURNO_PADRAO
    );
    const horasTarde = limitarDuracaoHoras(
      parcial.horasTarde ?? (tardeMedida > 0 ? tardeMedida : atual.horasTurnoTarde),
      0.5,
      12,
      HORAS_TURNO_PADRAO
    );
    const intervaloHoras = limitarDuracaoHoras(
      parcial.intervaloHoras ?? intervaloMedido,
      0,
      6,
      INTERVALO_HORAS_PADRAO
    );
    const horario = horarioPorDuracao(
      lancamento.entrada || horarioLancamentoPadrao(config, colaborador.cargaHoraria, lancamento.data).entrada,
      horasManha,
      horasTarde,
      intervaloHoras
    );
    alterarLancamento({
      ...horario,
      turnoManha: turnos.manha,
      turnoTarde: turnos.tarde,
      intervaloMinutos: Math.round(intervaloHoras * 60),
      ...(lancamento.calcularPorHora ? { valorManual: false } : {}),
    });
  }

  function alterarDuracaoConfig(parcial: {
    horasTurnoManha?: number;
    horasTurnoTarde?: number;
    intervaloHoras?: number;
  }) {
    if (!config || !colaborador) return;
    const atual = duracoesEfetivas(config, colaborador.cargaHoraria, diaSelecionado);
    setStore((storeAtual) =>
      atualizarConfigERecalcular(storeAtual, {
        ...config,
        horasTurnoManha: limitarDuracaoHoras(
          parcial.horasTurnoManha ?? atual.horasTurnoManha,
          0.5,
          12,
          HORAS_TURNO_PADRAO
        ),
        horasTurnoTarde: limitarDuracaoHoras(
          parcial.horasTurnoTarde ?? atual.horasTurnoTarde,
          0.5,
          12,
          HORAS_TURNO_PADRAO
        ),
        intervaloHoras: limitarDuracaoHoras(
          parcial.intervaloHoras ?? atual.intervaloHoras,
          0,
          6,
          INTERVALO_HORAS_PADRAO
        ),
      })
    );
  }

  function alternarCalculoPorHora(ativo: boolean) {
    if (!lancamento) return;
    alterarLancamento({ calcularPorHora: ativo, valorManual: false });
  }

  function alternarTurno(periodo: "manha" | "tarde", ativo: boolean) {
    if (!lancamento) return;
    const atual = turnosAtivosLancamento(lancamento);
    const horario = horarioLancamentoPadrao(
      config,
      colaborador?.cargaHoraria,
      lancamento.data
    );
    if (periodo === "manha") {
      const semManha = !horaTextoValida(lancamento.entrada) || !horaTextoValida(lancamento.saidaManha || "");
      alterarLancamento({
        turnoManha: ativo,
        turnoTarde: atual.tarde,
        entrada: ativo && semManha ? horario.entrada : lancamento.entrada,
        saidaManha: ativo && semManha ? horario.saidaManha : lancamento.saidaManha || horario.saidaManha,
      });
      return;
    }
    const semTarde =
      !horaTextoValida(lancamento.entradaTarde || "") || !horaTextoValida(lancamento.saida);
    alterarLancamento({
      turnoTarde: ativo,
      turnoManha: atual.manha,
      entradaTarde: ativo && semTarde ? horario.entradaTarde : lancamento.entradaTarde || horario.entradaTarde,
      saida: ativo && semTarde ? horario.saida : lancamento.saida || horario.saida,
    });
  }

  async function gravar() {
    setSalvando(true);
    setSalvoMsg("");
    try {
      const persistido = salvarDiariasColaboradores(store);
      sincronizarDiariasStoreNoCadastro(persistido);
      const resultado = await sincronizarDespesasDiariasColaboradores(persistido);
      setStore(resultado.store);
      setSalvoMsg(
        resultado.pagas.length > 0
          ? t("producao.diarias.salvoDespesaPaga")
          : t("producao.diarias.salvoComDespesa")
      );
    } catch (err) {
      console.error("despesa diaria colaborador", err);
      window.alert(t("producao.diarias.erroDespesa"));
      setSalvoMsg(t("producao.diarias.salvo"));
    } finally {
      setSalvando(false);
    }
  }

  async function imprimirNota() {
    if (!colaborador || !config) return;
    const lancamentos = lancamentosDoMes(store, colaborador.id, ano, mes);
    if (lancamentos.length === 0) {
      window.alert(t("producao.diarias.semLancamentosImprimir"));
      return;
    }
    const totais = resumoDiariasMes(store, colaborador.id, ano, mes);
    setImprimindo(true);
    try {
      await imprimirNotasPagamentoDiarias(
        [
          {
            colaboradorId: colaborador.id,
            colaboradorNome: colaborador.nome,
            valorDiaria: config.valorDiaria,
            horasJornada: config.horasJornada,
            ...totais,
            lancamentos,
            ano,
            mes,
          },
        ],
        locale
      );
    } catch {
      window.alert(t("producao.diarias.erroImprimir"));
    } finally {
      setImprimindo(false);
    }
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
              {config && colaborador ? (
                <DuracaoTurnosConfig
                  config={config}
                  carga={colaborador.cargaHoraria}
                  data={diaSelecionado}
                  labelManha={t("producao.diarias.horasTurnoManha")}
                  labelTarde={t("producao.diarias.horasTurnoTarde")}
                  labelIntervalo={t("producao.diarias.intervaloHoras")}
                  ajuda={t("producao.diarias.duracaoProximosDias")}
                  onChange={alterarDuracaoConfig}
                />
              ) : null}
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
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {t("producao.diarias.colaboradores")}
              </label>
              <p className="mb-2 text-[11px] leading-snug text-slate-400">
                {t("producao.diarias.somenteDiaria")}
              </p>
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
                        <span className="mt-0.5 whitespace-pre-line text-[9px] leading-tight text-blue-700">
                          {textoHorarioLancamento(item)}
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
                <div className="space-y-3">
                  {(() => {
                    const turnos = turnosAtivosLancamento(lancamento);
                    const porHora = lancamento.calcularPorHora === true;
                    return (
                      <>
                        <ToggleCalculoHoras
                          checked={porHora}
                          onChange={alternarCalculoPorHora}
                          titulo={t("producao.diarias.calcularPorHora")}
                          ajuda={
                            porHora
                              ? t("producao.diarias.calcularPorHoraOn")
                              : t("producao.diarias.calcularPorHoraOff")
                          }
                        />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <ToggleTurno
                            checked={turnos.manha}
                            onChange={(ativo) => alternarTurno("manha", ativo)}
                            label={t("producao.diarias.turnoManha")}
                            faixa={
                              turnos.manha && lancamento.entrada && lancamento.saidaManha
                                ? `${lancamento.entrada}–${lancamento.saidaManha}`
                                : formatarHorasDecimais(
                                    duracoesEfetivas(config, colaborador.cargaHoraria, lancamento.data)
                                      .horasTurnoManha
                                  )
                            }
                          />
                          <ToggleTurno
                            checked={turnos.tarde}
                            onChange={(ativo) => alternarTurno("tarde", ativo)}
                            label={t("producao.diarias.turnoTarde")}
                            faixa={
                              turnos.tarde && lancamento.entradaTarde && lancamento.saida
                                ? `${lancamento.entradaTarde}–${lancamento.saida}`
                                : formatarHorasDecimais(
                                    duracoesEfetivas(config, colaborador.cargaHoraria, lancamento.data)
                                      .horasTurnoTarde
                                  )
                            }
                          />
                        </div>
                        {turnos.manha || turnos.tarde ? (
                          <div className="grid gap-3 sm:grid-cols-3">
                            {turnos.manha ? (
                              <CampoDuracao
                                label={t("producao.diarias.horasTurnoManha")}
                                value={
                                  duracaoHorasEntre(lancamento.entrada, lancamento.saidaManha) ||
                                  duracoesEfetivas(config, colaborador.cargaHoraria, lancamento.data)
                                    .horasTurnoManha
                                }
                                min={0.5}
                                max={12}
                                onChange={(horasManha) => alterarDuracaoDia({ horasManha })}
                              />
                            ) : null}
                            {turnos.manha && turnos.tarde ? (
                              <CampoDuracao
                                label={t("producao.diarias.intervaloHoras")}
                                value={duracaoHorasEntre(lancamento.saidaManha, lancamento.entradaTarde)}
                                min={0}
                                max={6}
                                onChange={(intervaloHoras) => alterarDuracaoDia({ intervaloHoras })}
                              />
                            ) : null}
                            {turnos.tarde ? (
                              <CampoDuracao
                                label={t("producao.diarias.horasTurnoTarde")}
                                value={
                                  duracaoHorasEntre(lancamento.entradaTarde, lancamento.saida) ||
                                  duracoesEfetivas(config, colaborador.cargaHoraria, lancamento.data)
                                    .horasTurnoTarde
                                }
                                min={0.5}
                                max={12}
                                onChange={(horasTarde) => alterarDuracaoDia({ horasTarde })}
                              />
                            ) : null}
                          </div>
                        ) : null}
                        {turnos.manha ? (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <CampoHoraTexto
                              label={t("producao.diarias.entradaManha")}
                              value={lancamento.entrada || ""}
                              placeholder="08:00"
                              min={HORA_DIA_MIN}
                              max={HORA_DIA_MAX}
                              onChange={(value) => alterarHorario("entrada", value)}
                            />
                            <CampoHoraTexto
                              label={t("producao.diarias.saidaManha")}
                              value={lancamento.saidaManha || SAIDA_MANHA_PADRAO}
                              placeholder="12:00"
                              min={HORA_DIA_MIN}
                              max={HORA_DIA_MAX}
                              onChange={(value) => alterarHorario("saidaManha", value)}
                            />
                          </div>
                        ) : null}
                        {turnos.tarde ? (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <CampoHoraTexto
                              label={t("producao.diarias.entradaTarde")}
                              value={lancamento.entradaTarde || ENTRADA_TARDE_PADRAO}
                              placeholder="13:00"
                              min={HORA_DIA_MIN}
                              max={HORA_DIA_MAX}
                              onChange={(value) => alterarHorario("entradaTarde", value)}
                            />
                            <CampoHoraTexto
                              label={t("producao.diarias.saidaTarde")}
                              value={lancamento.saida || ""}
                              placeholder="17:00"
                              min={HORA_DIA_MIN}
                              max={HORA_DIA_MAX}
                              onChange={(value) => alterarHorario("saida", value)}
                            />
                          </div>
                        ) : null}
                        {!turnos.manha && !turnos.tarde ? (
                          <p className="text-[12px] text-slate-500">
                            {t("producao.diarias.selecioneTurno")}
                          </p>
                        ) : null}
                        {turnos.manha && turnos.tarde ? (
                          <p className="text-[12px] text-slate-500">
                            {t("producao.diarias.intervalo")}:{" "}
                            {textoIntervaloLancamento({
                              saidaManha: lancamento.saidaManha || SAIDA_MANHA_PADRAO,
                              entradaTarde: lancamento.entradaTarde || ENTRADA_TARDE_PADRAO,
                            }) || "—"}
                            {porHora ? "" : `. ${t("producao.diarias.intervaloNaoDesconta")}`}
                          </p>
                        ) : null}
                      </>
                    );
                  })()}
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <div>
                      <p className="text-[12px] text-slate-500">{t("producao.diarias.horas")}</p>
                      <p className="text-[18px] font-semibold text-slate-800">
                        {formatarHorasDecimais(lancamento.horas)}
                      </p>
                      <ValorDiariaEditavel
                        key={`${lancamento.id}-${diaSelecionado}`}
                        valor={lancamento.valor}
                        titulo={t("producao.diarias.editarValor")}
                        onChange={(valor) =>
                          alterarLancamento(aplicarValorManualLancamento(lancamento, valor))
                        }
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          if (!colaborador) return;
                          setStore((atual) =>
                            removerLancamentoDia(atual, colaborador.id, diaSelecionado)
                          );
                        }}
                      >
                        {t("producao.diarias.removerDia")}
                      </Button>
                    </div>
                  </div>
                  <label className="block">
                    <span className="mb-1 block text-[12px] text-slate-500">
                      {t("producao.diarias.observacao")}
                    </span>
                    <input
                      value={lancamento.observacao || ""}
                      onChange={(e) => alterarLancamento({ observacao: e.target.value })}
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-[13px] outline-none focus:border-blue-500"
                    />
                  </label>
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
            <Button
              type="button"
              variant="outline"
              disabled={!colaborador || imprimindo}
              onClick={() => void imprimirNota()}
            >
              <span className="inline-flex items-center gap-1">
                <Printer className="h-4 w-4" />
                {t("producao.diarias.imprimirNota")}
              </span>
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancelar")}
            </Button>
            <Button
              type="button"
              onClick={() => void gravar()}
              disabled={!colaborador || salvando}
            >
              {salvando ? t("common.salvando") : t("producao.diarias.gravar")}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
