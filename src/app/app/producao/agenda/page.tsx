"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, Printer, Search } from "lucide-react";
import { BadgeSegmentoOs } from "@/components/BadgeSegmentoOs";
import { ControleProducaoToolbar } from "@/components/ControleProducaoToolbar";
import { ImprimirOsModal } from "@/components/ImprimirOsModal";
import { Button, Input, Select } from "@/components/ui";
import { grupoOsTemMultiplosSegmentos } from "@/lib/trabalho-os-segmento";
import { formatDate, STATUS_TRABALHO } from "@/lib/utils";
import {
  caixaAgenda,
  colaboradorAgenda,
  etapaAtualAgenda,
  filtrarTrabalhosAgenda,
  prazoTextoAgenda,
  qtdAgenda,
  trabalhoAtrasadoAgenda,
  type TrabalhoAgenda,
} from "@/lib/agenda-producao";
import { prazoTrabalho } from "@/lib/controle-producao-prazos";

type Trabalho = TrabalhoAgenda & {
  segmentoFaturamento?: string | null;
  grupoOsId?: string | null;
  dentes?: string | null;
  escala?: string | null;
  cliente?: { nome?: string | null; cro?: string | null };
};

function chaveGrupoOs(trabalho: Trabalho) {
  return trabalho.grupoOsId || trabalho.id;
}

function isAtrasado(trabalho: Trabalho) {
  return trabalhoAtrasadoAgenda(trabalho);
}

function clienteNome(trabalho: Trabalho) {
  return trabalho.cliente?.nome || "";
}

function pacienteNome(trabalho: Trabalho) {
  return trabalho.paciente?.nome || "";
}

function prazoDate(trabalho: Trabalho) {
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

function prazoKey(trabalho: Trabalho) {
  const prazo = prazoDate(trabalho);
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

export default function AgendaPage() {
  const [trabalhos, setTrabalhos] = useState<Trabalho[]>([]);
  const [status, setStatus] = useState("");
  const [cliente, setCliente] = useState("");
  const [colaborador, setColaborador] = useState("");
  const [busca, setBusca] = useState("");
  const [filtroAgenda, setFiltroAgenda] = useState("todos");
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [imprimirOs, setImprimirOs] = useState<Trabalho | null>(null);

  async function load() {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (busca) params.set("q", busca);
    const res = await fetch(`/api/trabalhos?${params.toString()}`);
    const data = await res.json();
    setTrabalhos(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
  }, [status, busca]);

  const clientes = Array.from(new Set(trabalhos.map(clienteNome).filter(Boolean)));
  const baseFiltrada = useMemo(
    () => trabalhos.filter((trabalho) => (cliente ? clienteNome(trabalho) === cliente : true)),
    [trabalhos, cliente]
  );
  const atrasados = baseFiltrada.filter(isAtrasado);
  const diasAgenda = useMemo(() => semanaAgenda(semanaOffset), [semanaOffset]);
  const filtrados = useMemo(
    () => filtrarTrabalhosAgenda(baseFiltrada, filtroAgenda),
    [baseFiltrada, filtroAgenda]
  );

  function montarUrlImprimirAgenda() {
    const params = new URLSearchParams();
    params.set("filtro", filtroAgenda);
    if (status) params.set("status", status);
    if (cliente) params.set("cliente", cliente);
    if (busca) params.set("q", busca);
    return `/app/producao/agenda/imprimir?${params.toString()}`;
  }

  function countData(data: string, somenteAtrasado = false) {
    return baseFiltrada.filter((trabalho) => {
      if (prazoKey(trabalho) !== data) return false;
      return somenteAtrasado ? isAtrasado(trabalho) : !isAtrasado(trabalho);
    }).length;
  }

  function filtroClass(ativo: boolean, danger = false) {
    if (ativo) return danger ? "border-red-400 bg-red-500 text-white" : "border-primary-500 bg-primary-600 text-white";
    return danger
      ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50";
  }

  return (
    <div className="space-y-3 text-[11px] text-slate-700">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span>Produção</span>
        <span>/</span>
        <span className="font-medium text-slate-700">Agenda de Produção</span>
      </div>

      <div className="rounded border border-slate-200 bg-white p-3 shadow-sm">
        <ControleProducaoToolbar viewAtiva="agenda" />

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

        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_1fr_1.4fr_auto]">
          <Select label="Situação" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todas</option>
            {Object.entries(STATUS_TRABALHO).map(([key, value]) => (
              <option key={key} value={key}>{value.label}</option>
            ))}
          </Select>
          <Select label="Cliente" value={cliente} onChange={(e) => setCliente(e.target.value)}>
            <option value="">Todos</option>
            {clientes.map((nome) => (
              <option key={nome}>{nome}</option>
            ))}
          </Select>
          <Select label="Colaborador" value={colaborador} onChange={(e) => setColaborador(e.target.value)}>
            <option value="">Todos</option>
            <option>Sem colaborador</option>
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

      <div className="overflow-hidden rounded border border-slate-200 bg-white shadow-sm">
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
              {filtrados.map((trabalho) => {
                const atrasado = isAtrasado(trabalho);
                return (
                  <tr
                    key={trabalho.id}
                    className={`border-b border-slate-100 ${atrasado ? "bg-red-100/80 text-red-950" : "hover:bg-slate-50"}`}
                  >
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center">
                        {osBadge(trabalho.numeroOs)}
                        <BadgeSegmentoOs trabalho={trabalho} />
                      </span>
                    </td>
                    <td className="px-3 py-2">{caixaAgenda(trabalho.instrucoes)}</td>
                    <td className="px-3 py-2">{formatDate(trabalho.dataEntrada)}</td>
                    <td className="px-3 py-2">{prazoTextoAgenda(trabalho)}</td>
                    <td className="px-3 py-2">{qtdAgenda(trabalho.instrucoes)}</td>
                    <td className="px-3 py-2">{trabalho.tipoProtese}</td>
                    <td className="px-3 py-2">{clienteNome(trabalho)}</td>
                    <td className="px-3 py-2">{pacienteNome(trabalho)}</td>
                    <td className="px-3 py-2">{colaboradorAgenda(trabalho.instrucoes) || "-"}</td>
                    <td className="px-3 py-2">{etapaAtualAgenda(trabalho.instrucoes)}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-2 py-1 text-[10px] font-semibold ${STATUS_TRABALHO[trabalho.status]?.color || "bg-slate-100 text-slate-700"}`}>
                        {STATUS_TRABALHO[trabalho.status]?.label || trabalho.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-center gap-1">
                        <Link href={`/app/producao/controle?q=${trabalho.numeroOs}`} className="rounded p-1 text-slate-500 hover:bg-white hover:text-primary-700">
                          <Eye className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => setImprimirOs(trabalho)}
                          title="Imprimir OS"
                          className="rounded p-1 text-red-500 hover:bg-white hover:text-red-600"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-3 py-8 text-center text-slate-400">
                    Nenhuma OS encontrada na agenda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ImprimirOsModal
        open={!!imprimirOs}
        onClose={() => setImprimirOs(null)}
        trabalho={imprimirOs}
        multiplosSegmentos={
          imprimirOs
            ? grupoOsTemMultiplosSegmentos(
                trabalhos.filter((item) => chaveGrupoOs(item) === chaveGrupoOs(imprimirOs))
              )
            : false
        }
      />
    </div>
  );
}
