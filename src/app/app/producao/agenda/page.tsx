"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Edit3, Eye, Printer, Search, Trash2 } from "lucide-react";
import { AgendaEditarOsModal } from "@/components/producao/AgendaEditarOsModal";
import { AgendaOsDetalheExpandido } from "@/components/producao/AgendaOsDetalheExpandido";
import { ConfirmacaoExclusaoModal } from "@/components/ConfirmacaoExclusaoModal";
import { ControleProducaoToolbar } from "@/components/ControleProducaoToolbar";
import { BarraConfigListagem } from "@/components/listagem/BarraConfigListagem";
import { ImprimirOsModal } from "@/components/ImprimirOsModal";
import { Button, Input, Select, SelectPesquisavel } from "@/components/ui";
import { useListagemPaginada } from "@/hooks/use-listagem-paginada";
import {
  agruparTrabalhosAgenda,
  caixaAgendaGrupo,
  colaboradorAgendaGrupo,
  etapaAtualAgendaGrupo,
  filtrarLinhasAgendaSomenteProducao,
  prazoTextoAgendaGrupo,
  qtdTextoAgendaGrupo,
  servicosTextoAgenda,
  type LinhaAgendaGrupoOs,
  type TrabalhoAgendaGrupo,
} from "@/lib/agenda-producao-grupo";
import { editIdPreferidoGrupo, osTemMultiplosItensImpressao } from "@/lib/trabalho-os-segmento";
import {
  TRABALHOS_ATUALIZADOS_EVENT,
  notificarTrabalhosAtualizados,
} from "@/lib/trabalhos-events";
import {
  filtrarTrabalhosAgenda,
  trabalhoAtrasadoAgenda,
} from "@/lib/agenda-producao";
import { prazoTrabalho } from "@/lib/controle-producao-prazos";
import {
  grupoOsEstaFaturado,
  MENSAGEM_OS_FATURADA_NAO_EXCLUI,
  type LancamentoFaturaOs,
} from "@/lib/os-faturamento";
import {
  compararDataIso,
  compararNumero,
  compararTextoBr,
} from "@/lib/listagem-config";
import { formatDate, STATUS_TRABALHO } from "@/lib/utils";

function clienteNome(trabalho: TrabalhoAgendaGrupo) {
  return trabalho.cliente?.nome || "";
}

function pacienteNome(trabalho: TrabalhoAgendaGrupo) {
  return trabalho.paciente?.nome || "";
}

function prazoDate(trabalho: TrabalhoAgendaGrupo) {
  return prazoTrabalho(trabalho, "lab");
}

function osBadge(numeroOs: number) {
  return (
    <span className="inline-flex min-w-9 items-center justify-center rounded bg-red-100 px-2 py-1 text-[13px] font-bold text-red-700">
      {numeroOs}
    </span>
  );
}

const filtrosDia = [
  { id: "1", label: "Seg" },
  { id: "2", label: "Ter" },
  { id: "3", label: "Qua" },
  { id: "4", label: "Qui" },
  { id: "5", label: "Sex" },
  { id: "6", label: "Sáb" },
  { id: "0", label: "Dom" },
];

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function prazoKeyLinha(linha: LinhaAgendaGrupoOs) {
  const prazo = prazoDate(linha.principal);
  return prazo ? dateKey(prazo) : "";
}

function formatDiaMes(date: Date) {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function semanaAgenda(semanaOffset: number) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const diaAtual = hoje.getDay();
  const diffSegunda = diaAtual === 0 ? 1 : 1 - diaAtual;
  const segunda = new Date(hoje);
  segunda.setDate(hoje.getDate() + diffSegunda + semanaOffset * 7);

  return filtrosDia.map((dia, index) => {
    const date = new Date(segunda);
    date.setDate(segunda.getDate() + index);
    return { ...dia, date, key: dateKey(date) };
  });
}

function isAtrasadoLinha(linha: LinhaAgendaGrupoOs) {
  return trabalhoAtrasadoAgenda(linha.principal);
}

function prazoOrdenacaoLinha(linha: LinhaAgendaGrupoOs) {
  const prazo = prazoDate(linha.principal);
  return prazo ? prazo.getTime() : Number.MAX_SAFE_INTEGER;
}

type CampoOrdenacaoAgenda = "numeroOs" | "dataEntrada" | "prazo" | "cliente" | "paciente";

const OPCOES_ORDENACAO_AGENDA = [
  { valor: "numeroOs" as const, label: "Num OS" },
  { valor: "dataEntrada" as const, label: "Entrada" },
  { valor: "prazo" as const, label: "Prazo" },
  { valor: "cliente" as const, label: "Cliente" },
  { valor: "paciente" as const, label: "Paciente" },
];

const COMPARADORES_AGENDA: Record<
  CampoOrdenacaoAgenda,
  (a: LinhaAgendaGrupoOs, b: LinhaAgendaGrupoOs) => number
> = {
  numeroOs: (a, b) => compararNumero(a.principal.numeroOs, b.principal.numeroOs),
  dataEntrada: (a, b) =>
    compararDataIso(a.principal.dataEntrada, b.principal.dataEntrada),
  prazo: (a, b) => compararNumero(prazoOrdenacaoLinha(a), prazoOrdenacaoLinha(b)),
  cliente: (a, b) => compararTextoBr(clienteNome(a.principal), clienteNome(b.principal)),
  paciente: (a, b) => compararTextoBr(pacienteNome(a.principal), pacienteNome(b.principal)),
};

export default function AgendaPage() {
  const [trabalhos, setTrabalhos] = useState<TrabalhoAgendaGrupo[]>([]);
  const [lancamentosFatura, setLancamentosFatura] = useState<LancamentoFaturaOs[]>([]);
  const [cliente, setCliente] = useState("");
  const [colaborador, setColaborador] = useState("");
  const [busca, setBusca] = useState("");
  const [filtroAgenda, setFiltroAgenda] = useState("todos");
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [imprimirOs, setImprimirOs] = useState<TrabalhoAgendaGrupo | null>(null);
  const [osAberta, setOsAberta] = useState<string | null>(null);
  const [osExcluindo, setOsExcluindo] = useState<LinhaAgendaGrupoOs | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [anexoAberto, setAnexoAberto] = useState<{
    name: string;
    type: string;
    url: string;
  } | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("status", "producao");
    if (busca) params.set("q", busca);
    const res = await fetch(`/api/trabalhos?${params.toString()}`);
    const data = await res.json();
    setTrabalhos(Array.isArray(data) ? data : []);
  }, [busca]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    function onTrabalhosAtualizados() {
      void load();
    }
    window.addEventListener(TRABALHOS_ATUALIZADOS_EVENT, onTrabalhosAtualizados);
    return () =>
      window.removeEventListener(TRABALHOS_ATUALIZADOS_EVENT, onTrabalhosAtualizados);
  }, [load]);

  useEffect(() => {
    fetch("/api/financeiro?tipo=receita", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { lancamentos: [] }))
      .then((data) =>
        setLancamentosFatura(Array.isArray(data?.lancamentos) ? data.lancamentos : [])
      )
      .catch(() => setLancamentosFatura([]));
  }, []);

  const linhasAgrupadas = useMemo(
    () => filtrarLinhasAgendaSomenteProducao(agruparTrabalhosAgenda(trabalhos)),
    [trabalhos]
  );

  const clientes = Array.from(
    new Set(trabalhos.map(clienteNome).filter(Boolean))
  );

  const baseFiltrada = useMemo(() => {
    return linhasAgrupadas.filter((linha) => {
      if (cliente && clienteNome(linha.principal) !== cliente) return false;
      if (colaborador) {
        const colab = colaboradorAgendaGrupo(linha);
        if (colaborador === "Sem colaborador") {
          if (colab.trim()) return false;
        } else if (!colab.toLowerCase().includes(colaborador.toLowerCase())) {
          return false;
        }
      }
      return true;
    });
  }, [linhasAgrupadas, cliente, colaborador]);

  const atrasados = baseFiltrada.filter(isAtrasadoLinha);
  const diasAgenda = useMemo(() => semanaAgenda(semanaOffset), [semanaOffset]);

  const filtrados = useMemo(() => {
    if (filtroAgenda === "atrasados") {
      return baseFiltrada.filter(isAtrasadoLinha);
    }
    if (filtroAgenda.startsWith("data-")) {
      const data = filtroAgenda.replace("data-", "");
      return baseFiltrada.filter((linha) => prazoKeyLinha(linha) === data);
    }
    if (filtroAgenda === "todos") return baseFiltrada;
    return filtrarTrabalhosAgenda(
      baseFiltrada.map((l) => l.principal),
      filtroAgenda
    )
      .map((t) => baseFiltrada.find((l) => l.principal.id === t.id))
      .filter(Boolean) as LinhaAgendaGrupoOs[];
  }, [baseFiltrada, filtroAgenda]);

  const listagem = useListagemPaginada<LinhaAgendaGrupoOs, CampoOrdenacaoAgenda>({
    storageKey: "agenda-producao",
    itens: filtrados,
    padrao: {
      ordenarPor: "prazo",
      direcao: "asc",
      porPagina: 50,
    },
    comparadores: COMPARADORES_AGENDA,
  });

  function montarUrlImprimirAgenda() {
    const params = new URLSearchParams();
    params.set("filtro", filtroAgenda);
    params.set("status", "producao");
    if (cliente) params.set("cliente", cliente);
    if (busca) params.set("q", busca);
    return `/app/producao/agenda/imprimir?${params.toString()}`;
  }

  function countData(data: string, somenteAtrasado = false) {
    return baseFiltrada.filter((linha) => {
      if (prazoKeyLinha(linha) !== data) return false;
      return somenteAtrasado ? isAtrasadoLinha(linha) : !isAtrasadoLinha(linha);
    }).length;
  }

  function editIdLinha(linha: LinhaAgendaGrupoOs) {
    return (
      editIdPreferidoGrupo(linha.grupoCompleto) || linha.principal.id
    );
  }

  function linhaGrupoFaturada(linha: LinhaAgendaGrupoOs) {
    return grupoOsEstaFaturado(linha.principal, trabalhos, lancamentosFatura);
  }

  function abrirEdicao(linha: LinhaAgendaGrupoOs) {
    setEditandoId(editIdLinha(linha));
  }

  function fecharEdicao() {
    setEditandoId(null);
    void load();
  }

  async function confirmarExclusaoOs() {
    const linha = osExcluindo;
    if (!linha) return;
    if (linhaGrupoFaturada(linha)) {
      window.alert(MENSAGEM_OS_FATURADA_NAO_EXCLUI);
      setOsExcluindo(null);
      return;
    }
    const id = editIdLinha(linha);
    setOsExcluindo(null);
    if (osAberta === linha.chaveGrupo) setOsAberta(null);
    try {
      const res = await fetch(`/api/trabalhos/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(
          typeof data.error === "string" ? data.error : MENSAGEM_OS_FATURADA_NAO_EXCLUI
        );
      } else {
        notificarTrabalhosAtualizados({ trabalhoId: id });
      }
    } catch {
      window.alert("Não foi possível excluir a ordem de serviço.");
    }
    void load();
  }

  return (
    <div className="space-y-3 text-[11px] text-slate-700">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span>Produção</span>
        <span>/</span>
        <span className="font-medium text-slate-700">Agenda de Produção</span>
      </div>

      <div className="rounded border border-slate-200 bg-white p-3 shadow-sm">
        <ControleProducaoToolbar viewAtiva="agenda" somenteNavegacao />

        <div className="mt-2">
          <Link href={montarUrlImprimirAgenda()} target="_blank" rel="noopener noreferrer">
            <Button
              type="button"
              size="sm"
              className="gap-1.5 bg-[#4a90d9] text-white hover:bg-[#3d7fc4]"
            >
              <Printer className="h-4 w-4" />
              Imprimir Agenda
            </Button>
          </Link>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_1.4fr_auto]">
          <SelectPesquisavel
            label="Cliente"
            value={cliente}
            onChange={setCliente}
            placeholder="Todos"
            options={[
              { value: "", label: "Todos" },
              ...clientes.map((nome) => ({ value: nome, label: nome })),
            ]}
          />
          <Select label="Colaborador" value={colaborador} onChange={(e) => setColaborador(e.target.value)}>
            <option value="">Todos</option>
            <option value="Sem colaborador">Sem colaborador</option>
          </Select>
          <Input
            label="Busca"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="OS, cliente, paciente, dentista ou parceiro"
          />
          <Button className="mt-6" size="sm" onClick={load}>
            <Search className="h-4 w-4" />
            Buscar
          </Button>
        </div>

        <div className="mt-3 flex items-stretch justify-center overflow-x-auto rounded border border-slate-400 bg-white text-[10px]">
          <button
            type="button"
            onClick={() => {
              setSemanaOffset((offset) => offset - 1);
              setFiltroAgenda("todos");
            }}
            className="min-w-12 border-r border-slate-400 px-3 py-2 text-lg text-slate-500 hover:bg-slate-50"
            title="Semana anterior"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setFiltroAgenda("todos")}
            className={`min-w-20 border-r border-slate-200 px-3 py-2 text-center ${
              filtroAgenda === "todos" ? "bg-primary-50" : "hover:bg-slate-50"
            }`}
          >
            <span className="block text-slate-500">Todos</span>
            <span className="mt-1 inline-flex min-w-6 items-center justify-center rounded bg-primary-600 px-1.5 py-0.5 font-bold text-white">
              {baseFiltrada.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setFiltroAgenda("atrasados")}
            className={`min-w-20 border-r border-slate-200 px-3 py-2 text-center ${
              filtroAgenda === "atrasados" ? "bg-red-50" : "hover:bg-slate-50"
            }`}
          >
            <span className="block text-slate-500">Atrasados</span>
            <span className="mt-1 inline-flex min-w-6 items-center justify-center rounded bg-red-500 px-1.5 py-0.5 font-bold text-white">
              {atrasados.length}
            </span>
          </button>
          {diasAgenda.map((dia) => {
            const emDia = countData(dia.key);
            const vencidos = countData(dia.key, true);
            const ativo = filtroAgenda === `data-${dia.key}`;
            return (
              <button
                key={dia.key}
                type="button"
                onClick={() => setFiltroAgenda(`data-${dia.key}`)}
                className={`min-w-20 border-r border-slate-200 px-3 py-2 text-center ${
                  ativo ? "bg-primary-50" : "hover:bg-slate-50"
                }`}
              >
                <span className={`block font-semibold ${ativo ? "text-primary-700" : "text-slate-500"}`}>
                  {dia.label}
                </span>
                <span className={ativo ? "block text-primary-600" : "block text-slate-400"}>
                  {formatDiaMes(dia.date)}
                </span>
                <span className="mt-1 inline-flex items-center gap-1">
                  {emDia > 0 && (
                    <span className="inline-flex min-w-6 items-center justify-center rounded bg-primary-600 px-1.5 py-0.5 font-bold text-white">
                      {emDia}
                    </span>
                  )}
                  {vencidos > 0 && (
                    <span className="inline-flex min-w-6 items-center justify-center rounded bg-red-500 px-1.5 py-0.5 font-bold text-white">
                      {vencidos}
                    </span>
                  )}
                  {vencidos === 0 && emDia === 0 && (
                    <span className="inline-flex min-w-6 items-center justify-center rounded bg-slate-400 px-1.5 py-0.5 font-bold text-white">
                      0
                    </span>
                  )}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setSemanaOffset((offset) => offset + 1);
              setFiltroAgenda("todos");
            }}
            className="min-w-12 px-3 py-2 text-lg text-slate-500 hover:bg-slate-50"
            title="Próxima semana"
          >
            ›
          </button>
        </div>
      </div>

      <BarraConfigListagem
        varianteGear="controle"
        configAberto={listagem.configAberto}
        onToggleConfig={() =>
          listagem.configAberto ? listagem.fecharConfig() : listagem.abrirConfig()
        }
        onFecharConfig={listagem.fecharConfig}
        rascunho={listagem.rascunho}
        opcoesOrdenacao={OPCOES_ORDENACAO_AGENDA}
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
          <table className="w-full min-w-[1050px] text-[11px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="px-3 py-2 text-left font-semibold uppercase">OS</th>
                <th className="px-3 py-2 text-left font-semibold uppercase">Caixa</th>
                <th className="px-3 py-2 text-left font-semibold uppercase">Entrada</th>
                <th className="px-3 py-2 text-left font-semibold uppercase">Prazo</th>
                <th className="px-3 py-2 text-left font-semibold uppercase">Qtd</th>
                <th className="px-3 py-2 text-left font-semibold uppercase">Serviço</th>
                <th className="px-3 py-2 text-left font-semibold uppercase">Cliente</th>
                <th className="px-3 py-2 text-left font-semibold uppercase">Paciente</th>
                <th className="px-3 py-2 text-left font-semibold uppercase">Colaborador</th>
                <th className="px-3 py-2 text-left font-semibold uppercase">Etapas</th>
                <th className="px-3 py-2 text-left font-semibold uppercase">Situação</th>
                <th className="px-3 py-2 text-center font-semibold uppercase">Opções</th>
              </tr>
            </thead>
            <tbody>
              {listagem.itensPagina.map((linha) => {
                const { principal } = linha;
                const atrasado = isAtrasadoLinha(linha);
                const expandida = osAberta === linha.chaveGrupo;
                return (
                  <Fragment key={linha.chaveGrupo}>
                    <tr
                      className={`border-b border-slate-100 ${atrasado ? "bg-red-100/80 text-red-950" : "hover:bg-slate-50"}`}
                    >
                      <td className="px-3 py-2">{osBadge(principal.numeroOs)}</td>
                      <td className="px-3 py-2">{caixaAgendaGrupo(linha)}</td>
                      <td className="px-3 py-2">{formatDate(principal.dataEntrada)}</td>
                      <td className="px-3 py-2">{prazoTextoAgendaGrupo(linha)}</td>
                      <td className="px-3 py-2">{qtdTextoAgendaGrupo(linha)}</td>
                      <td className="px-3 py-2">{servicosTextoAgenda(linha)}</td>
                      <td className="px-3 py-2">{clienteNome(principal)}</td>
                      <td className="px-3 py-2">{pacienteNome(principal)}</td>
                      <td className="px-3 py-2">{colaboradorAgendaGrupo(linha)}</td>
                      <td className="px-3 py-2">{etapaAtualAgendaGrupo(linha)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded px-2 py-1 text-[10px] font-semibold ${STATUS_TRABALHO[principal.status]?.color || "bg-slate-100 text-slate-700"}`}
                        >
                          {STATUS_TRABALHO[principal.status]?.label || principal.status}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setOsAberta(expandida ? null : linha.chaveGrupo)
                            }
                            title="Ver detalhes"
                            className={`rounded p-1 hover:bg-white ${
                              expandida
                                ? "text-primary-700"
                                : "text-slate-500 hover:text-primary-700"
                            }`}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => abrirEdicao(linha)}
                            title="Editar OS"
                            className="rounded p-1 text-slate-500 hover:bg-white hover:text-primary-700"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setImprimirOs(principal)}
                            title="Imprimir OS"
                            className="rounded p-1 text-red-500 hover:bg-white hover:text-red-600"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (linhaGrupoFaturada(linha)) {
                                window.alert(MENSAGEM_OS_FATURADA_NAO_EXCLUI);
                                return;
                              }
                              setOsExcluindo(linha);
                            }}
                            title="Excluir OS"
                            className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandida && (
                      <tr>
                        <td colSpan={12} className="bg-slate-50 p-0">
                          <AgendaOsDetalheExpandido
                            linha={linha}
                            anexoAberto={anexoAberto}
                            onAnexoAberto={setAnexoAberto}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {listagem.totalItens === 0 && (
                <tr>
                  <td colSpan={12} className="px-3 py-8 text-center text-slate-400">
                    Nenhuma OS em produção encontrada na agenda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </BarraConfigListagem>

      <ConfirmacaoExclusaoModal
        open={!!osExcluindo}
        titulo="Excluir Ordem de Serviço"
        mensagem="Deseja realmente excluir essa Ordem de Serviço?"
        aviso="Atenção!! Todas as comissões serão excluídas exceto comissões já faturadas. Se a OS já foi faturada em Contas a Receber, exclua o lançamento no Financeiro antes."
        onClose={() => setOsExcluindo(null)}
        onConfirm={confirmarExclusaoOs}
      />

      <ImprimirOsModal
        open={!!imprimirOs}
        onClose={() => setImprimirOs(null)}
        trabalho={imprimirOs}
        multiplosSegmentos={
          imprimirOs ? osTemMultiplosItensImpressao(trabalhos, imprimirOs.numeroOs) : false
        }
      />

      {editandoId && (
        <AgendaEditarOsModal trabalhoId={editandoId} onClose={fecharEdicao} />
      )}
    </div>
  );
}
