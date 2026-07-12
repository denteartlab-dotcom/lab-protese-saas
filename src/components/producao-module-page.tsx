"use client";

import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Search,
  Users,
} from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
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
  const { t } = useI18n();

  function TableView() {
    return (
      <Card>
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <Input placeholder={t("producao.module.buscarPlaceholder")} />
          <Select>
            <option>{t("relatorio.filtro.status")}</option>
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
            {t("producao.module.filtrar")}
          </Button>
        </div>
        <Table
          headers={[
            t("relatorio.comum.os"),
            t("relatorio.comum.cliente"),
            t("relatorio.comum.paciente"),
            t("relatorio.comum.servico"),
            t("relatorio.filtro.status"),
            t("producao.module.colunaPrazo"),
          ]}
        >
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
    const colunas = [
      t("producao.module.hoje"),
      t("producao.module.amanha"),
      t("producao.module.semana"),
    ];
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        {colunas.map((col, index) => (
          <Card key={col} title={col}>
            <div className="space-y-3">
              {rows.slice(0, index + 1).map((row) => (
                <div key={row.os} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <CalendarDays className="h-4 w-4" />
                    {row.prazo}
                  </div>
                  <p className="mt-2 font-semibold">
                    {t("relatorio.comum.os")} #{row.os}
                  </p>
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
                  <p className="font-semibold text-slate-800">
                    {t("relatorio.comum.os")} #{row.os}
                  </p>
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
        <Metric icon={Users} title={t("producao.module.colaboradores")} value="8" />
        <Metric icon={CheckCircle2} title={t("producao.module.servicosFinalizados")} value="24" />
        <Metric icon={Clock} title={t("producao.module.comissoesPendentes")} value="R$ 1.280,00" />
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
          <h1 className="text-2xl font-bold">{t("producao.module.painelTitulo")}</h1>
          <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs">{t("producao.module.aoVivo")}</span>
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

  return (
    <div className="space-y-4 text-sm text-slate-700">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/app" className="hover:text-primary-700">
          {t("producao.module.inicio")}
        </Link>
        <span>/</span>
        <Link href="/app/producao" className="hover:text-primary-700">
          {t("producao.module.producao")}
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
                {t("producao.module.novaOs")}
              </Button>
            </Link>
            <Button size="sm" variant="outline">
              {t("producao.module.imprimir")}
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
