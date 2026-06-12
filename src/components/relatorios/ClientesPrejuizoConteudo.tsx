"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  DollarSign,
  RefreshCw,
  Shield,
  Users,
} from "lucide-react";
import { CampoDataBr } from "@/components/campo-data-br";
import { PainelCarregando } from "@/components/ListaCarregando";
import { dateToBrShort } from "@/lib/datas-br";
import {
  formatarMoedaClientesPrejuizo,
  labelStatusCriticidade,
  OPCOES_PERIODO_CLIENTES_PREJUIZO,
  type PeriodoClientesPrejuizo,
  type RelatorioClientesPrejuizoPayload,
  type StatusCriticidadeCliente,
} from "@/lib/relatorio-clientes-prejuizo";
import { cn } from "@/lib/utils";

const inputDataClass =
  "h-[36px] w-full rounded-lg border border-[#e5e7eb] bg-white px-3 text-[12px] text-[#374151] shadow-none outline-none focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1]/20";

function BadgeStatus({ status }: { status: StatusCriticidadeCliente }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
        status === "alto" && "bg-red-100 text-red-700",
        status === "medio" && "bg-orange-100 text-orange-700",
        status === "baixo" && "bg-yellow-100 text-yellow-800"
      )}
    >
      {labelStatusCriticidade(status)}
    </span>
  );
}

function CardKpi({
  titulo,
  valor,
  icone,
  corValor,
  corIcone,
  corFundoIcone,
}: {
  titulo: string;
  valor: string;
  icone: React.ReactNode;
  corValor: string;
  corIcone: string;
  corFundoIcone: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-[#e8eaed] bg-white p-4 shadow-sm">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: corFundoIcone, color: corIcone }}
      >
        {icone}
      </div>
      <div>
        <p className="text-[12px] font-medium text-[#6b7280]">{titulo}</p>
        <p className="text-[22px] font-bold tabular-nums" style={{ color: corValor }}>
          {valor}
        </p>
      </div>
    </div>
  );
}

function CardTabela({
  titulo,
  children,
  linkVerTodos,
}: {
  titulo: string;
  children: React.ReactNode;
  linkVerTodos?: boolean;
}) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-[#e8eaed] bg-white shadow-sm">
      <div className="border-b border-[#f0f0f0] px-4 py-3">
        <h3 className="text-[13px] font-semibold text-[#374151]">{titulo}</h3>
      </div>
      <div className="flex-1 overflow-x-auto px-2 py-2">{children}</div>
      {linkVerTodos ? (
        <div className="border-t border-[#f0f0f0] px-4 py-2.5 text-center">
          <button
            type="button"
            className="text-[12px] font-medium text-[#4a90d9] hover:underline"
          >
            Ver todos
          </button>
        </div>
      ) : null}
    </div>
  );
}

function TabelaSimples({
  colunas,
  linhas,
}: {
  colunas: string[];
  linhas: React.ReactNode[][];
}) {
  return (
    <table className="w-full min-w-[200px] text-left text-[12px]">
      <thead>
        <tr className="border-b border-[#f0f0f0] text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
          {colunas.map((col) => (
            <th key={col} className="px-2 py-2">
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {linhas.map((linha, i) => (
          <tr key={i} className="border-b border-[#f8f8f8] last:border-0">
            {linha.map((cel, j) => (
              <td key={j} className="px-2 py-2.5 text-[#374151]">
                {cel}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ClientesPrejuizoConteudo() {
  const [periodo, setPeriodo] = useState<PeriodoClientesPrejuizo>("30dias");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState(dateToBrShort(new Date()));
  const [dados, setDados] = useState<RelatorioClientesPrejuizoPayload | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams({ periodo });
      if (periodo === "personalizado") {
        if (dataInicio) params.set("dataInicio", dataInicio);
        if (dataFim) params.set("dataFim", dataFim);
      }
      const res = await fetch(`/api/relatorios/clientes-prejuizo?${params}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Falha");
      setDados((await res.json()) as RelatorioClientesPrejuizoPayload);
    } catch {
      setDados(null);
    } finally {
      setCarregando(false);
    }
  }, [periodo, dataInicio, dataFim]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (periodo === "personalizado" && !dataInicio) {
      const hoje = new Date();
      setDataInicio(dateToBrShort(new Date(hoje.getFullYear(), hoje.getMonth(), 1)));
    }
  }, [periodo, dataInicio]);

  return (
    <div className="min-h-[100vh] w-full bg-[#f4f6f8]">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-2">
          <Link
            href="/app/relatorios"
            className="inline-flex items-center gap-1.5 text-[12px] text-[#6b7280] hover:text-[#374151]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar aos relatórios
          </Link>
        </div>

        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-[20px] font-bold text-[#1f2937] sm:text-[22px]">
              Relatório: Clientes que Mais Geram Retrabalho
            </h1>
            <p className="mt-1 max-w-2xl text-[13px] text-[#6b7280]">
              Identifique clientes com maior número de retornos, garantias, atrasos e
              prejuízo estimado.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {periodo === "personalizado" ? (
              <>
                <div className="w-[130px]">
                  <CampoDataBr
                    value={dataInicio}
                    onChange={setDataInicio}
                    placeholder="dd/mm/aaaa"
                    iconPosition="left"
                    className="space-y-0"
                    inputClassName={inputDataClass}
                  />
                </div>
                <span className="pb-2 text-[12px] text-[#9ca3af]">—</span>
                <div className="w-[130px]">
                  <CampoDataBr
                    value={dataFim}
                    onChange={setDataFim}
                    placeholder="dd/mm/aaaa"
                    iconPosition="left"
                    className="space-y-0"
                    inputClassName={inputDataClass}
                  />
                </div>
              </>
            ) : null}
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
              <select
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value as PeriodoClientesPrejuizo)}
                className="h-[36px] min-w-[180px] appearance-none rounded-lg border border-[#e5e7eb] bg-white pl-9 pr-8 text-[12px] text-[#374151] shadow-sm outline-none focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1]/20"
              >
                {OPCOES_PERIODO_CLIENTES_PREJUIZO.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => void carregar()}
              className="inline-flex h-[36px] items-center gap-1.5 rounded-lg bg-[#4a90d9] px-3 text-[12px] font-semibold text-white shadow-sm hover:bg-[#3a7bc8]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Atualizar
            </button>
          </div>
        </header>

        {carregando ? (
          <div className="min-h-[400px] rounded-xl border border-[#e8eaed] bg-white shadow-sm">
            <PainelCarregando mensagem="Carregando relatório de clientes..." />
          </div>
        ) : !dados ? (
          <div className="rounded-xl border border-[#e8eaed] bg-white p-12 text-center text-[#6b7280]">
            Não foi possível carregar o relatório.
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <CardKpi
                titulo="Retrabalhos"
                valor={String(dados.resumo.retrabalhos)}
                icone={<RefreshCw className="h-5 w-5" />}
                corValor="#ef4444"
                corIcone="#ef4444"
                corFundoIcone="#fee2e2"
              />
              <CardKpi
                titulo="Garantias"
                valor={String(dados.resumo.garantias)}
                icone={<Shield className="h-5 w-5" />}
                corValor="#f97316"
                corIcone="#f97316"
                corFundoIcone="#ffedd5"
              />
              <CardKpi
                titulo="Clientes Críticos"
                valor={String(dados.resumo.clientesCriticos)}
                icone={<Users className="h-5 w-5" />}
                corValor="#8b5cf6"
                corIcone="#8b5cf6"
                corFundoIcone="#ede9fe"
              />
              <CardKpi
                titulo="Prejuízo Estimado"
                valor={formatarMoedaClientesPrejuizo(dados.resumo.prejuizoEstimado)}
                icone={<DollarSign className="h-5 w-5" />}
                corValor="#16a34a"
                corIcone="#16a34a"
                corFundoIcone="#dcfce7"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <CardTabela titulo="Clientes que Mais Retornam Serviços" linkVerTodos>
                <TabelaSimples
                  colunas={["Cliente", "Retrabalhos", "Garantias", "Status"]}
                  linhas={dados.clientesRetorno.map((c) => [
                    c.cliente,
                    String(c.retrabalhos),
                    String(c.garantias),
                    <BadgeStatus key={c.cliente} status={c.status} />,
                  ])}
                />
              </CardTabela>
              <CardTabela titulo="Clientes que Mais Demoram a Aprovar" linkVerTodos>
                <TabelaSimples
                  colunas={["Cliente", "Tempo Médio"]}
                  linhas={dados.clientesAprovacao.map((c) => [
                    c.cliente,
                    `${c.tempoMedioDias} dias`,
                  ])}
                />
              </CardTabela>
              <CardTabela titulo="Clientes que Mais Devolvem Trabalhos" linkVerTodos>
                <TabelaSimples
                  colunas={["Cliente", "Devoluções"]}
                  linhas={dados.clientesDevolucao.map((c) => [
                    c.cliente,
                    String(c.devolucoes),
                  ])}
                />
              </CardTabela>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <CardTabela titulo="Motivos Mais Frequentes" linkVerTodos>
                <TabelaSimples
                  colunas={["Motivo", "Quantidade"]}
                  linhas={dados.motivosFrequentes.map((m) => [
                    m.motivo,
                    String(m.quantidade),
                  ])}
                />
              </CardTabela>
              <CardTabela titulo="Prejuízo Estimado por Cliente" linkVerTodos>
                <TabelaSimples
                  colunas={["Cliente", "Valor"]}
                  linhas={dados.prejuizoPorCliente.map((p) => [
                    p.cliente,
                    <span key={p.cliente} className="font-semibold text-red-600">
                      {formatarMoedaClientesPrejuizo(p.valor)}
                    </span>,
                  ])}
                />
              </CardTabela>
              <div className="flex h-full flex-col rounded-xl border border-[#e8eaed] bg-white shadow-sm">
                <div className="border-b border-[#f0f0f0] px-4 py-3">
                  <h3 className="text-[13px] font-semibold text-[#374151]">
                    Alerta de Gargalos
                  </h3>
                </div>
                <div className="flex flex-1 flex-col gap-3 p-4">
                  {dados.alertasGargalos.map((alerta) => (
                    <div
                      key={alerta.cliente}
                      className={cn(
                        "rounded-lg border px-3 py-3",
                        alerta.nivel === "alto"
                          ? "border-red-200 bg-red-50/80"
                          : "border-orange-200 bg-orange-50/80"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle
                          className={cn(
                            "mt-0.5 h-4 w-4 shrink-0",
                            alerta.nivel === "alto" ? "text-red-500" : "text-orange-500"
                          )}
                        />
                        <div>
                          <p className="text-[13px] font-semibold text-[#374151]">
                            {alerta.cliente}
                          </p>
                          <ul className="mt-1.5 space-y-0.5">
                            {alerta.itens.map((item) => (
                              <li
                                key={item}
                                className="text-[11px] text-[#6b7280] before:mr-1.5 before:content-['•']"
                              >
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <footer className="pb-6 pt-2 text-center text-[11px] text-[#9ca3af]">
              <p>Relatório gerado em {dados.geradoEm}</p>
              <p className="mt-0.5">
                Os dados apresentados são baseados no período: {dados.periodoLabel}
              </p>
            </footer>
          </div>
        )}
      </div>
    </div>
  );
}
