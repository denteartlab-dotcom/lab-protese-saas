"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { LinkImprimirOs } from "@/components/LinkImprimirOs";
import { useI18n } from "@/components/i18n-provider";
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
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const [trabalho, setTrabalho] = useState<Trabalho | null>(null);

  async function load() {
    const res = await fetch(`/api/trabalhos/${id}`);
    setTrabalho(await res.json());
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

  if (!trabalho) return <p>{t("cadastros.comum.carregando")}</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/app/trabalhos"
          className="inline-flex items-center gap-2 text-sm text-slate-600"
        >
          <ArrowLeft className="h-4 w-4" /> {t("cadastros.trabalhos.voltar")}
        </Link>
        <LinkImprimirOs trabalho={trabalho}>
          <Button type="button">
            <Printer className="h-4 w-4" /> {t("cadastros.trabalhos.imprimirOs")}
          </Button>
        </LinkImprimirOs>
      </div>

      <div className="flex items-center gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          {t("relatorio.comum.os")}
          <span className="inline-flex min-w-10 items-center justify-center rounded bg-slate-100 px-2 py-1 text-lg font-semibold text-slate-600">
            {trabalho.numeroOs}
          </span>
        </h1>
        <Badge className={STATUS_TRABALHO[trabalho.status]?.color}>
          {STATUS_TRABALHO[trabalho.status]?.label}
        </Badge>
      </div>

      <Card title={t("cadastros.trabalhos.statusTitulo")}>
        <Select
          label={t("cadastros.trabalhos.alterarStatus")}
          value={trabalho.status}
          onChange={(e) => updateStatus(e.target.value)}
        >
          {Object.entries(STATUS_TRABALHO).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </Select>
      </Card>

      <Card title={t("cadastros.trabalhos.dadosOs")}>
        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-slate-500">{t("relatorio.comum.cliente")}</dt>
            <dd className="font-medium">{trabalho.cliente.nome}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{t("relatorio.comum.paciente")}</dt>
            <dd className="font-medium">{trabalho.paciente.nome}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{t("cadastros.trabalhos.colunaTipo")}</dt>
            <dd>{trabalho.tipoProtese}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{t("cadastros.trabalhos.colunaValor")}</dt>
            <dd className="font-semibold text-primary-700">
              {formatCurrency(trabalho.valor)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">{t("relatorio.comum.dente")}</dt>
            <dd>{trabalho.dentes || ""}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{t("cadastros.trabalhos.campoCorMaterial")}</dt>
            <dd>
              {[trabalho.cor, trabalho.material].filter(Boolean).join(" · ") || ""}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">{t("cadastros.trabalhos.campoEntrada")}</dt>
            <dd>{formatDate(trabalho.dataEntrada)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{t("cadastros.trabalhos.colunaPrevisao")}</dt>
            <dd>{formatDate(trabalho.dataPrevista)}</dd>
          </div>
          {trabalho.instrucoes && (
            <div className="sm:col-span-2">
              <dt className="text-slate-500">{t("cadastros.trabalhos.campoInstrucoesLabel")}</dt>
              <dd className="mt-1 whitespace-pre-wrap">{trabalho.instrucoes}</dd>
            </div>
          )}
          {trabalho.observacoes && (
            <div className="sm:col-span-2">
              <dt className="text-slate-500">{t("cadastros.trabalhos.campoObservacoes")}</dt>
              <dd className="mt-1 whitespace-pre-wrap">{trabalho.observacoes}</dd>
            </div>
          )}
        </dl>
      </Card>
    </div>
  );
}
