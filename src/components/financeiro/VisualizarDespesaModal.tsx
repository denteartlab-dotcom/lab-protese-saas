"use client";

import Image from "next/image";
import { FileText, X } from "lucide-react";
import { parseParcelaNaDescricao } from "@/lib/fatura-financeiro";
import {
  desempacotarDespesa,
  type AnexoDespesa,
  type EntidadeDespesa,
} from "@/lib/lancamento-despesa";
import { formatDate } from "@/lib/utils";

type LancamentoDespesa = {
  id: string;
  descricao: string;
  valor: number;
  data: string;
  status: string;
  formaPagamento?: string | null;
  cliente?: { nome?: string } | null;
  trabalho?: { numeroOs?: number } | null;
};

type Props = {
  open: boolean;
  lancamento: LancamentoDespesa | null;
  refOs?: string;
  onClose: () => void;
};

const ROTULO_ENTIDADE: Record<EntidadeDespesa, string> = {
  todos: "Geral",
  fornecedores: "Fornecedor",
  colaboradores: "Colaborador",
  prestadores: "Prestador",
  entregadores: "Entregador",
  clientes: "Cliente",
};

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function rotuloStatus(status: string) {
  if (status === "pago") return "Pago";
  if (status === "cancelado") return "Cancelado";
  return "A pagar";
}

function descricaoSemParcela(texto: string) {
  const parcela = parseParcelaNaDescricao(texto);
  if (!parcela) return texto.trim();
  return texto.replace(/\(\d+\s*\/\s*\d+\)\s*$/, "").trim();
}

function AnexoPreview({ anexo }: { anexo: AnexoDespesa }) {
  const isPdf =
    anexo.type === "application/pdf" || anexo.name.toLowerCase().endsWith(".pdf");

  return (
    <a
      href={anexo.url}
      target="_blank"
      rel="noreferrer"
      className="block overflow-hidden rounded border border-slate-200 bg-white shadow-sm transition hover:border-[#4a90d9] hover:shadow"
    >
      {isPdf ? (
        <div className="flex h-28 flex-col items-center justify-center gap-1 bg-slate-50 text-[#4a90d9]">
          <FileText className="h-10 w-10" />
          <span className="text-[10px] font-medium uppercase">Abrir PDF</span>
        </div>
      ) : (
        <Image
          src={anexo.url}
          alt={anexo.name}
          width={200}
          height={160}
          unoptimized
          className="h-28 w-full object-cover"
        />
      )}
      <p className="truncate px-2 py-1 text-[10px] text-slate-600">{anexo.name}</p>
    </a>
  );
}

function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-slate-800">{valor || "—"}</dd>
    </div>
  );
}

export function VisualizarDespesaModal({ open, lancamento, refOs, onClose }: Props) {
  if (!open || !lancamento) return null;

  const pack = desempacotarDespesa(lancamento.descricao);
  const textoBase = descricaoSemParcela(pack.texto);
  const partesDescricao = textoBase.split("|").map((p) => p.trim()).filter(Boolean);
  const itens = partesDescricao.length > 1 ? partesDescricao.slice(0, -1) : partesDescricao;
  const observacoes =
    partesDescricao.length > 1 ? partesDescricao[partesDescricao.length - 1] : "";
  const entidade = pack.meta.entidade || "fornecedores";
  const referencia =
    refOs || (pack.referencia !== "—" ? pack.referencia : lancamento.trabalho?.numeroOs != null
      ? `OS ${lancamento.trabalho.numeroOs}`
      : "—");
  const anexos = pack.meta.anexos ?? [];
  const nomeExibicao = lancamento.cliente?.nome?.trim() || pack.nome;

  return (
    <div
      className="fixed inset-0 z-[96] flex items-center justify-center bg-black/45 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="visualizar-despesa-titulo"
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-5 py-4">
          <h2
            id="visualizar-despesa-titulo"
            className="pr-8 text-base font-semibold text-slate-800"
          >
            Visualizar despesa
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">{nomeExibicao}</p>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded p-1 text-slate-500 hover:bg-slate-200"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Campo label="Vencimento" valor={formatDate(lancamento.data)} />
            <Campo label="Parcela" valor={pack.parcela} />
            <Campo label={ROTULO_ENTIDADE[entidade]} valor={nomeExibicao} />
            <Campo label="Referência" valor={referencia} />
            <Campo label="Categoria" valor={pack.categoria} />
            <Campo label="Conta" valor={pack.conta} />
            <Campo label="Forma de pagamento" valor={lancamento.formaPagamento || "—"} />
            <Campo label="Situação" valor={rotuloStatus(lancamento.status)} />
            <Campo label="Valor" valor={`R$ ${money(lancamento.valor)}`} />
          </dl>

          {itens.length > 0 ? (
            <div className="mt-5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Itens / descrição
              </h3>
              <ul className="mt-2 space-y-1 rounded border border-slate-200 bg-slate-50/80 p-3 text-sm text-slate-700">
                {itens.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {observacoes && observacoes !== itens[0] ? (
            <div className="mt-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Observações
              </h3>
              <p className="mt-1 rounded border border-slate-200 bg-white p-3 text-sm text-slate-700">
                {observacoes}
              </p>
            </div>
          ) : null}

          <div className="mt-5">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Recibos e comprovantes
            </h3>
            {anexos.length > 0 ? (
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                {anexos.map((anexo) => (
                  <AnexoPreview key={anexo.url} anexo={anexo} />
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-400">Nenhum anexo cadastrado.</p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 justify-end border-t border-slate-200 bg-white px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
