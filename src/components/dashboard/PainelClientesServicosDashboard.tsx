"use client";

import Link from "next/link";
import { useState } from "react";
import {
  OPCOES_DIAS_SEM_SERVICO,
  type ClienteSemServicoItem,
} from "@/lib/dashboard-clientes-servico";
import { formatDate } from "@/lib/utils";

function escaparHtml(texto: string) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function montarHtmlImpressaoClientesServicos(
  titulo: string,
  diasMinimos: number,
  lista: ClienteSemServicoItem[]
) {
  const linhas = lista
    .map((cliente) => {
      const data = cliente.ultimoServicoEm ? formatDate(cliente.ultimoServicoEm) : "—";
      return `<div class="linha">
        <span class="nome">${escaparHtml(cliente.nome)}</span>
        <span class="data">${escaparHtml(data)}</span>
      </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escaparHtml(titulo)}</title>
  <style>
    * { box-sizing: border-box; }
    @page { size: A4 portrait; margin: 14mm 16mm; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #111827;
      margin: 0;
      padding: 0;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 22px;
      font-weight: 700;
      line-height: 1.2;
      text-align: center;
    }
    .subtitulo {
      margin: 0 0 22px;
      font-size: 14px;
      color: #374151;
      text-align: center;
    }
    .tabela {
      width: 100%;
    }
    .cabecalho {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 0 0 8px;
      border-bottom: 1px solid #9ca3af;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #374151;
    }
    .cabecalho .data {
      min-width: 96px;
      text-align: right;
    }
    .linha {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 11px 0;
      border-bottom: 1px solid #d1d5db;
      font-size: 15px;
      line-height: 1.35;
    }
    .nome {
      flex: 1;
      min-width: 0;
      font-weight: 400;
    }
    .data {
      flex-shrink: 0;
      min-width: 96px;
      color: #111827;
      text-align: right;
      white-space: nowrap;
    }
    .vazio {
      padding: 28px 0;
      font-size: 14px;
      color: #6b7280;
      text-align: center;
    }
  </style>
</head>
<body>
  <h1>${escaparHtml(titulo)}</h1>
  <p class="subtitulo">Não solicita serviço há mais de ${diasMinimos} dias</p>
  <div class="tabela">
    ${
      linhas
        ? `<div class="cabecalho">
            <span class="nome">Cliente</span>
            <span class="data">Data último</span>
          </div>${linhas}`
        : '<p class="vazio">Nenhum cliente inativo neste período.</p>'
    }
  </div>
</body>
</html>`;
}

export function PainelClientesServicosDashboard({
  titulo,
  lista,
  diasMinimos,
  onDiasChange,
  carregarListaImpressao,
}: {
  titulo: string;
  lista: ClienteSemServicoItem[];
  diasMinimos: number;
  onDiasChange: (dias: number) => void;
  carregarListaImpressao?: () => Promise<ClienteSemServicoItem[]>;
}) {
  const [imprimindo, setImprimindo] = useState(false);

  async function imprimir() {
    if (imprimindo) return;
    setImprimindo(true);
    try {
      const listaImpressao = carregarListaImpressao
        ? await carregarListaImpressao()
        : lista;
      const html = montarHtmlImpressaoClientesServicos(
        titulo,
        diasMinimos,
        listaImpressao
      );
      const janela = window.open("", "_blank");
      if (!janela) return;
      janela.document.open();
      janela.document.write(html);
      janela.document.close();
      janela.focus();
      janela.print();
    } finally {
      setImprimindo(false);
    }
  }

  return (
    <section className="rounded border border-slate-200 bg-white shadow-sm">
      <div className="flex min-h-10 items-center justify-between border-b border-slate-100 px-4 py-2">
        <h2 className="text-sm font-medium text-slate-700">{titulo}</h2>
        <select
          value={String(diasMinimos)}
          onChange={(e) => onDiasChange(Number(e.target.value))}
          className="h-6 max-w-[88px] rounded border border-slate-200 bg-white px-1.5 text-[10px] text-slate-600"
          aria-label="Dias sem serviço"
        >
          {OPCOES_DIAS_SEM_SERVICO.map((op) => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>
      </div>
      <div className="p-4">
        <p className="mb-3 text-[11px] text-slate-500">
          Não solicita serviço há mais de {diasMinimos} dias
        </p>
        <div className="mb-1 grid grid-cols-[1fr_auto] gap-2 border-b border-slate-100 pb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
          <span>Cliente</span>
          <span>Data último</span>
        </div>
        <div className="max-h-36 space-y-0 overflow-y-auto">
          {lista.length === 0 ? (
            <p className="py-4 text-center text-[11px] text-slate-400">
              Nenhum cliente inativo neste período.
            </p>
          ) : (
            lista.map((c) => (
              <div
                key={c.id}
                className="grid grid-cols-[1fr_auto] gap-2 border-b border-slate-50 py-2 last:border-0"
              >
                <Link
                  href={`/app/clientes`}
                  className="truncate font-medium text-slate-700 hover:text-primary-600"
                >
                  {c.nome}
                </Link>
                <span className="shrink-0 text-[11px] text-slate-500">
                  {c.ultimoServicoEm ? formatDate(c.ultimoServicoEm) : "—"}
                </span>
              </div>
            ))
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <Link
            href="/app/clientes"
            className="rounded border border-primary-200 bg-primary-50 px-3 py-1 text-[11px] font-medium text-primary-700 hover:bg-primary-100"
          >
            Ver Mais
          </Link>
          <button
            type="button"
            onClick={() => void imprimir()}
            disabled={imprimindo}
            className="rounded border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            {imprimindo ? "Gerando..." : "Imprimir"}
          </button>
        </div>
      </div>
    </section>
  );
}
