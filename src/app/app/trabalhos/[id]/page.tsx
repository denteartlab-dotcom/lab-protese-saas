"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Button, Card, Select, Badge } from "@/components/ui";
import { notificarTrabalhosAtualizados } from "@/lib/trabalhos-events";
import {
  formatCurrency,
  formatDate,
  STATUS_TRABALHO,
} from "@/lib/utils";

type Trabalho = {
  id: string;
  numeroOs: number;
  tipoProtese: string;
  dentes?: string | null;
  cor?: string | null;
  material?: string | null;
  escala?: string | null;
  status: string;
  valor: number;
  dataEntrada: string;
  dataPrevista?: string | null;
  dataEntrega?: string | null;
  observacoes?: string | null;
  instrucoes?: string | null;
  cliente: { nome: string; cro?: string | null; telefone?: string | null };
  paciente: { nome: string };
};

export default function TrabalhoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [t, setT] = useState<Trabalho | null>(null);

  async function load() {
    const res = await fetch(`/api/trabalhos/${id}`);
    setT(await res.json());
  }

  useEffect(() => {
    load();
  }, [id]);

  async function updateStatus(status: string) {
    const res = await fetch(`/api/trabalhos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) notificarTrabalhosAtualizados({ trabalhoId: id });
    load();
  }

  if (!t) return <p>Carregando...</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/app/trabalhos"
          className="inline-flex items-center gap-2 text-sm text-slate-600"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <Link href={`/app/trabalhos/${id}/imprimir`} target="_blank">
          <Button>
            <Printer className="h-4 w-4" /> Imprimir OS
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          OS
          <span className="inline-flex min-w-10 items-center justify-center rounded bg-slate-100 px-2 py-1 text-lg font-semibold text-slate-600">
            {t.numeroOs}
          </span>
        </h1>
        <Badge className={STATUS_TRABALHO[t.status]?.color}>
          {STATUS_TRABALHO[t.status]?.label}
        </Badge>
      </div>

      <Card title="Status do trabalho">
        <Select
          label="Alterar status"
          value={t.status}
          onChange={(e) => updateStatus(e.target.value)}
        >
          {Object.entries(STATUS_TRABALHO).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </Select>
      </Card>

      <Card title="Dados da OS">
        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-slate-500">Cliente</dt>
            <dd className="font-medium">{t.cliente.nome}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Paciente</dt>
            <dd className="font-medium">{t.paciente.nome}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Tipo</dt>
            <dd>{t.tipoProtese}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Valor</dt>
            <dd className="font-semibold text-primary-700">
              {formatCurrency(t.valor)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Dentes</dt>
            <dd>{t.dentes || ""}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Cor / Material</dt>
            <dd>
              {[t.cor, t.material].filter(Boolean).join(" · ") || ""}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Entrada</dt>
            <dd>{formatDate(t.dataEntrada)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Previsão</dt>
            <dd>{formatDate(t.dataPrevista)}</dd>
          </div>
          {t.instrucoes && (
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Instruções</dt>
              <dd className="mt-1 whitespace-pre-wrap">{t.instrucoes}</dd>
            </div>
          )}
          {t.observacoes && (
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Observações</dt>
              <dd className="mt-1 whitespace-pre-wrap">{t.observacoes}</dd>
            </div>
          )}
        </dl>
      </Card>
    </div>
  );
}
