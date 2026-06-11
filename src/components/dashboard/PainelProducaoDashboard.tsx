"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import {
  hrefControlePorStatus,
  type ResumoProducaoDashboard,
} from "@/lib/dashboard-producao";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

type Props = {
  titulo: string;
  resumo: ResumoProducaoDashboard;
  mes: number;
  ano: number;
  onMesChange: (mes: number) => void;
  onAnoChange: (ano: number) => void;
  labels: {
    concluido: string;
    pendente: string;
    finalizado: string;
    saiuEntrega: string;
    entregue: string;
    producao: string;
    emProva: string;
    pendenteStatus: string;
    pedido: string;
  };
};

export function PainelProducaoDashboard({
  titulo,
  resumo,
  mes,
  ano,
  onMesChange,
  onAnoChange,
  labels,
}: Props) {
  const anos = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <section className="rounded border border-slate-200 bg-white shadow-sm">
      <div className="flex min-h-10 items-center justify-between border-b border-slate-100 px-4 py-2">
        <h2 className="text-sm font-medium text-slate-700">{titulo}</h2>
        <div className="flex items-center gap-2">
          <select
            value={mes}
            onChange={(e) => onMesChange(Number(e.target.value))}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-600"
          >
            {MESES.map((nome, index) => (
              <option key={nome} value={index}>
                {nome}
              </option>
            ))}
          </select>
          <select
            value={ano}
            onChange={(e) => onAnoChange(Number(e.target.value))}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-600"
          >
            {anos.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col items-center p-4">
        <ProgressRing percent={resumo.percentual} />
        <div className="mt-4 grid w-full grid-cols-2 border-t border-slate-100 text-center">
          <div className="border-r border-slate-100 py-3">
            <p className="text-[11px] text-slate-400">{labels.concluido}</p>
            <p className="text-lg font-semibold text-slate-700">{resumo.concluido}</p>
          </div>
          <div className="py-3">
            <p className="text-[11px] text-slate-400">{labels.pendente}</p>
            <p className="text-lg font-semibold text-slate-700">{resumo.pendente}</p>
          </div>
        </div>
        <div className="grid w-full grid-cols-2 gap-x-4 gap-y-2 px-1 text-[11px] text-slate-600">
          <LinhaStatus
            label={labels.finalizado}
            value={resumo.porStatus.finalizado}
            href={hrefControlePorStatus("finalizado")}
          />
          <LinhaStatus
            label={labels.producao}
            value={resumo.porStatus.producao}
            href={hrefControlePorStatus("producao")}
          />
          <LinhaStatus
            label={labels.saiuEntrega}
            value={resumo.porStatus.saiu_entrega}
            href={hrefControlePorStatus("saiu_entrega")}
          />
          <LinhaStatus
            label={labels.emProva}
            value={resumo.porStatus.prova}
            href={hrefControlePorStatus("prova")}
          />
          <LinhaStatus
            label={labels.entregue}
            value={resumo.porStatus.entregue}
            href={hrefControlePorStatus("entregue")}
          />
          <LinhaStatus
            label={labels.pendenteStatus}
            value={resumo.porStatus.pendente}
            href={hrefControlePorStatus("pendente")}
          />
          {resumo.porStatus.pedido > 0 && (
            <LinhaStatus
              label={labels.pedido}
              value={resumo.porStatus.pedido}
              href={hrefControlePorStatus("pedido")}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function LinhaStatus({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <div className="flex items-center justify-between gap-1">
      <span className="flex min-w-0 items-center gap-1 truncate">
        <Link
          href={href}
          className="shrink-0 text-slate-400 transition hover:text-primary-600"
          title={`Ver no controle: ${label}`}
        >
          <Eye className="h-3.5 w-3.5" />
        </Link>
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 font-medium text-slate-700">{value}</span>
    </div>
  );
}

function ProgressRing({ percent }: { percent: number }) {
  const angle = Math.min(Math.max(percent, 0), 100) * 3.6;
  return (
    <div
      className="mt-1 flex h-[120px] w-[120px] items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(#22c55e ${angle}deg, #e8ecf1 ${angle}deg)`,
      }}
    >
      <div className="flex h-[100px] w-[100px] items-center justify-center rounded-full bg-white text-[26px] font-semibold text-slate-600">
        {percent}%
      </div>
    </div>
  );
}
