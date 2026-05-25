"use client";

import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  PackageCheck,
  Search,
  Users,
} from "lucide-react";
import { Button, Card, Input, Select, Table } from "@/components/ui";

type Row = {
  os: string;
  cliente: string;
  paciente: string;
  servico: string;
  status: string;
  prazo: string;
};

const rows: Row[] = [
  {
    os: "1001",
    cliente: "Dr. Carlos Silva",
    paciente: "Maria Oliveira",
    servico: "Coroa em zircônia",
    status: "Produção",
    prazo: "23/05/2026",
  },
  {
    os: "1002",
    cliente: "Clínica OdontoVida",
    paciente: "João Santos",
    servico: "Prótese total",
    status: "Prova",
    prazo: "30/05/2026",
  },
  {
    os: "1003",
    cliente: "Pedro Dentistas",
    paciente: "Ana Paula",
    servico: "Protocolo",
    status: "Finalizado",
    prazo: "02/06/2026",
  },
];

export function ProducaoModulePage({
  title,
  description,
  mode = "table",
}: {
  title: string;
  description: string;
  mode?: "table" | "agenda" | "kanban" | "financeiro" | "tv";
}) {
  return (
    <div className="space-y-4 text-sm text-slate-700">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/app" className="hover:text-primary-700">
          Início
        </Link>
        <span>/</span>
        <Link href="/app/producao" className="hover:text-primary-700">
          Produção
        </Link>
        <span>/</span>
        <span className="font-medium text-slate-700">{title}</span>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">{title}</h1>
            <p className="mt-1 text-xs text-slate-500">{description}</p>
          </div>
          <div className="flex gap-2">
            <Link href="/app/producao/os">
              <Button size="sm">
                <ClipboardList className="h-4 w-4" />
                Nova OS
              </Button>
            </Link>
            <Button size="sm" variant="outline">
              Imprimir
            </Button>
          </div>
        </div>
      </Card>

      {mode === "agenda" ? <AgendaView /> : null}
      {mode === "kanban" ? <KanbanView /> : null}
      {mode === "financeiro" ? <FinanceiroView /> : null}
      {mode === "tv" ? <TvView /> : null}
      {mode === "table" ? <TableView /> : null}
    </div>
  );
}

function TableView() {
  return (
    <Card>
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <Input placeholder="Buscar OS, cliente ou paciente" />
        <Select>
          <option>Status</option>
          <option>Pedido</option>
          <option>Produção</option>
          <option>Pendente</option>
          <option>Prova</option>
          <option>Cancelado</option>
          <option>Finalizado</option>
          <option>Saiu para Entrega</option>
          <option>Entregue</option>
        </Select>
        <Input type="date" />
        <Button variant="outline">
          <Search className="h-4 w-4" />
          Filtrar
        </Button>
      </div>
      <Table headers={["OS", "Cliente", "Paciente", "Serviço", "Status", "Prazo"]}>
        {rows.map((row) => (
          <tr key={row.os} className="hover:bg-slate-50">
            <td className="px-4 py-3 font-semibold text-primary-700">#{row.os}</td>
            <td className="px-4 py-3">{row.cliente}</td>
            <td className="px-4 py-3">{row.paciente}</td>
            <td className="px-4 py-3">{row.servico}</td>
            <td className="px-4 py-3">
              <span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">
                {row.status}
              </span>
            </td>
            <td className="px-4 py-3">{row.prazo}</td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}

function AgendaView() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {["Hoje", "Amanhã", "Semana"].map((col, index) => (
        <Card key={col} title={col}>
          <div className="space-y-3">
            {rows.slice(0, index + 1).map((row) => (
              <div key={row.os} className="rounded-lg border border-slate-100 p-3">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <CalendarDays className="h-4 w-4" />
                  {row.prazo}
                </div>
                <p className="mt-2 font-semibold">OS #{row.os}</p>
                <p className="text-xs text-slate-500">{row.servico}</p>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function KanbanView() {
  const columns = ["Pedido", "Produção", "Pendente", "Prova", "Finalizado"];
  return (
    <div className="grid gap-3 xl:grid-cols-5">
      {columns.map((column) => (
        <Card key={column} title={column}>
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={`${column}-${row.os}`} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <p className="font-semibold text-slate-800">OS #{row.os}</p>
                <p className="text-xs text-slate-500">{row.paciente}</p>
                <p className="mt-2 text-xs">{row.servico}</p>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function FinanceiroView() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Metric icon={Users} title="Colaboradores" value="8" />
      <Metric icon={CheckCircle2} title="Serviços finalizados" value="24" />
      <Metric icon={Clock} title="Comissões pendentes" value="R$ 1.280,00" />
      <div className="lg:col-span-3">
        <TableView />
      </div>
    </div>
  );
}

function TvView() {
  return (
    <div className="rounded-xl bg-slate-950 p-6 text-white">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Painel de Produção</h1>
        <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs">AO VIVO</span>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {rows.map((row) => (
          <div key={row.os} className="rounded-lg bg-slate-900 p-5">
            <p className="text-3xl font-bold text-sky-400">#{row.os}</p>
            <p className="mt-2 text-lg">{row.paciente}</p>
            <p className="text-sm text-slate-400">{row.servico}</p>
            <div className="mt-4 rounded bg-slate-800 px-3 py-2 text-sm">{row.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  title,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
}) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary-50 p-3 text-primary-600">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-slate-500">{title}</p>
          <p className="text-xl font-semibold text-slate-800">{value}</p>
        </div>
      </div>
    </Card>
  );
}
