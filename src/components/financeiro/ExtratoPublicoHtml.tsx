"use client";

import type { ExtratoPublicaConteudo } from "@/lib/extrato-publica-conteudo";
import type { LinhaExtrato3ComSaldo, ResumoExtrato3 } from "@/lib/extrato-3-paciente-dados";
import type {
  LinhaExtratoIndividualComSaldo,
  ResumoExtratoIndividual,
} from "@/lib/extrato-individual-dados";
import { useLabConfigClient } from "@/lib/use-lab-config-client";
import { cn } from "@/lib/utils";

function moneyBr(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function descricaoExtrato1(linha: LinhaExtratoIndividualComSaldo) {
  if (linha.tipo === "pagamento" || linha.tipo === "desconto") {
    const forma = (linha.servico || "")
      .replace(/^Pagamento\s*/i, "")
      .replace(/[()]/g, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/^pix/, "px");
    return `Recebimento ${forma || "externo"}`;
  }
  return linha.servico;
}

function ResumoExtratoTabela({ resumo }: { resumo: ResumoExtratoIndividual | ResumoExtrato3 }) {
  const itens: Array<[string, number, boolean]> = [
    ["(+) Saldo Anterior", resumo.saldoAnterior, false],
    ["(+) Total Serviços", resumo.totalServicos, false],
    ["(-) Total Pagamentos", resumo.totalPagamentos, false],
    ["(-) Total Descontos", resumo.totalDescontos, false],
    ["(=) Saldo Total", resumo.saldoTotal, true],
  ];

  return (
    <table className="mt-6 w-full max-w-md border-collapse text-[12px]">
      <tbody>
        {itens.map(([rotulo, valor, bold]) => (
          <tr key={rotulo} className="border border-[#a0a0a0]">
            <td className={cn("border border-[#a0a0a0] px-2 py-1.5", bold && "font-bold")}>
              {rotulo}
            </td>
            <td
              className={cn(
                "border border-[#a0a0a0] px-2 py-1.5 text-right tabular-nums",
                bold && "font-bold"
              )}
            >
              R$ {moneyBr(valor)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CabecalhoLab({ clienteNome, periodoLabel }: { clienteNome: string; periodoLabel: string }) {
  const { lab } = useLabConfigClient();

  return (
    <div className="mb-4 border-b border-black pb-3">
      <p className="text-[13px] font-bold text-[#333]">{lab.responsavel}</p>
      {lab.telefones ? <p className="text-[12px] text-black">{lab.telefones}</p> : null}
      {lab.email ? <p className="text-[12px] text-black">{lab.email}</p> : null}
      <h1 className="mt-4 text-center text-[14px] font-bold text-black">
        Extrato Financeiro ({clienteNome})
      </h1>
      {periodoLabel ? (
        <p className="mt-1 text-center text-[11px] text-[#555]">{periodoLabel}</p>
      ) : null}
    </div>
  );
}

function ExtratoIndividualHtml({
  linhas,
  resumo,
  modelo,
}: {
  linhas: LinhaExtratoIndividualComSaldo[];
  resumo: ResumoExtratoIndividual;
  modelo: "extrato-individual" | "extrato-2-individual";
}) {
  const extrato2 = modelo === "extrato-2-individual";

  return (
    <table className="w-full min-w-[920px] border-collapse text-[11px]">
      <thead>
        <tr className="border-b border-[#bebebe]">
          {extrato2 ? (
            <>
              <th className="px-1 py-1 text-left font-bold">Data Fatura</th>
              <th className="px-1 py-1 text-left font-bold">Núm. Fatura</th>
              <th className="px-1 py-1 text-left font-bold">OS</th>
              <th className="px-1 py-1 text-left font-bold">Serviço/Produto</th>
              <th className="px-1 py-1 text-right font-bold">Qtd</th>
              <th className="px-1 py-1 text-right font-bold">Valor Un</th>
              <th className="px-1 py-1 text-right font-bold">Desconto</th>
              <th className="px-1 py-1 text-right font-bold">Subtotal</th>
              <th className="px-1 py-1 text-right font-bold">Saldo</th>
            </>
          ) : (
            <>
              <th className="px-1 py-1 text-left font-bold">Data</th>
              <th className="px-1 py-1 text-left font-bold">Num Fatura</th>
              <th className="px-1 py-1 text-left font-bold">OS</th>
              <th className="px-1 py-1 text-left font-bold">Serviço/Produto</th>
              <th className="px-1 py-1 text-right font-bold">Qtd</th>
              <th className="px-1 py-1 text-left font-bold">Paciente</th>
              <th className="px-1 py-1 text-left font-bold">Núm Dente</th>
              <th className="px-1 py-1 text-right font-bold">Valor</th>
              <th className="px-1 py-1 text-right font-bold">Saldo</th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {linhas.map((linha, idx) => {
          if (linha.tipo === "saldo_anterior") {
            return extrato2 ? (
              <tr key={`sa-${idx}`} className="border-b border-[#bebebe]">
                <td colSpan={3} />
                <td className="px-1 py-1 font-bold">Saldo Anterior</td>
                <td colSpan={3} />
                <td className="px-1 py-1 text-right tabular-nums">R$ {moneyBr(0)}</td>
                <td className="px-1 py-1 text-right font-bold tabular-nums">
                  R$ {moneyBr(linha.saldo)}
                </td>
              </tr>
            ) : (
              <tr key={`sa-${idx}`} className="border-b border-[#bebebe]">
                <td colSpan={7} />
                <td className="px-1 py-1 text-right font-bold">Saldo Anterior</td>
                <td className="px-1 py-1 text-right font-bold tabular-nums">
                  R$ {moneyBr(linha.saldo)}
                </td>
              </tr>
            );
          }

          const pagamento = linha.tipo === "pagamento" || linha.tipo === "desconto";
          const cor = pagamento ? "text-[#dc2626]" : "text-[#2563eb]";

          return (
            <tr key={`${linha.tipo}-${idx}`} className="border-b border-[#bebebe]">
              <td className={cn("px-1 py-1", cor)}>{linha.dataFatura}</td>
              <td className={cn("px-1 py-1", pagamento ? "text-[#374151]" : cor)}>
                {linha.numFatura}
              </td>
              <td className={cn("px-1 py-1", pagamento ? "text-[#374151]" : cor)}>{linha.os}</td>
              <td className={cn("px-1 py-1", cor)}>{descricaoExtrato1(linha)}</td>
              <td
                className={cn(
                  "px-1 py-1 text-right",
                  pagamento ? "text-[#374151]" : cor
                )}
              >
                {linha.qtd}
              </td>
              {extrato2 ? (
                <>
                  <td className={cn("px-1 py-1 text-right tabular-nums", cor)}>
                    {pagamento ? "" : `R$ ${moneyBr(linha.valorUn)}`}
                  </td>
                  <td className={cn("px-1 py-1 text-right tabular-nums", cor)}>
                    {pagamento ? "" : `R$ ${moneyBr(linha.desconto)}`}
                  </td>
                  <td className={cn("px-1 py-1 text-right tabular-nums", cor)}>
                    {pagamento
                      ? `- R$ ${moneyBr(Math.abs(linha.subtotal))}`
                      : `R$ ${moneyBr(linha.subtotal)}`}
                  </td>
                </>
              ) : (
                <>
                  <td className={cn("px-1 py-1", pagamento ? "text-[#374151]" : cor)}>
                    {linha.paciente}
                  </td>
                  <td className={cn("px-1 py-1", pagamento ? "text-[#374151]" : cor)}>
                    {linha.numDente}
                  </td>
                  <td className={cn("px-1 py-1 text-right tabular-nums", cor)}>
                    {pagamento
                      ? `- R$ ${moneyBr(Math.abs(linha.subtotal))}`
                      : `R$ ${moneyBr(linha.subtotal)}`}
                  </td>
                </>
              )}
              <td className="px-1 py-1 text-right tabular-nums text-black">
                R$ {moneyBr(linha.saldo)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Extrato3Html({
  linhas,
  resumo,
}: {
  linhas: LinhaExtrato3ComSaldo[];
  resumo: ResumoExtrato3;
}) {
  return (
    <table className="w-full min-w-[980px] border-collapse text-[11px]">
      <thead>
        <tr className="border-b border-[#bebebe]">
          <th className="px-1 py-1 text-left font-bold">Data Fatura</th>
          <th className="px-1 py-1 text-left font-bold">Fatura</th>
          <th className="px-1 py-1 text-left font-bold">OS</th>
          <th className="px-1 py-1 text-center font-bold">Qtd</th>
          <th className="px-1 py-1 text-left font-bold">Serviço / Produto</th>
          <th className="px-1 py-1 text-center font-bold">Entregue</th>
          <th className="px-1 py-1 text-right font-bold">Valor Un</th>
          <th className="px-1 py-1 text-right font-bold">Desc</th>
          <th className="px-1 py-1 text-right font-bold">Valor</th>
          <th className="px-1 py-1 text-right font-bold">Saldo</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((linha, idx) => {
          if (linha.tipo === "saldo_anterior") {
            return (
              <tr key={`sa-${idx}`}>
                <td colSpan={10} className="px-1 py-1 text-right text-[12px]">
                  Saldo Anterior R$ {moneyBr(linha.saldo)}
                </td>
              </tr>
            );
          }

          if (linha.tipo === "pagamento" || linha.tipo === "desconto") {
            return (
              <tr key={`pg-${idx}`} className="bg-[#ecfdf5] text-[#16a34a]">
                <td className="px-1 py-1 font-bold">{linha.dataFatura}</td>
                <td />
                <td />
                <td />
                <td className="px-1 py-1 font-bold">{linha.servico}</td>
                <td />
                <td />
                <td />
                <td className="px-1 py-1 text-right font-bold tabular-nums">
                  - R$ {moneyBr(Math.abs(linha.valor))}
                </td>
                <td className="px-1 py-1 text-right tabular-nums">
                  R$ {moneyBr(linha.saldo)}
                </td>
              </tr>
            );
          }

          if (linha.tipo === "paciente") {
            return (
              <tr key={`pac-${idx}`} className="bg-[#e1e8f0]">
                <td colSpan={10} className="px-1 py-1 font-bold">
                  {linha.servico}
                </td>
              </tr>
            );
          }

          if (linha.tipo === "subtotal") {
            return (
              <tr key={`sub-${idx}`} className="border-b border-[#bebebe]">
                <td colSpan={4} />
                <td className="px-1 py-1 font-bold text-[#dc2626]">Subtotal</td>
                <td colSpan={3} />
                <td className="px-1 py-1 text-right font-bold tabular-nums text-[#dc2626]">
                  R$ {moneyBr(linha.valor)}
                </td>
                <td className="px-1 py-1 text-right tabular-nums">
                  R$ {moneyBr(linha.saldo)}
                </td>
              </tr>
            );
          }

          if (linha.tipo === "fatura") {
            return (
              <tr key={`fat-${idx}`} className="border-b border-[#bebebe]">
                <td className="px-1 py-1">{linha.dataFatura}</td>
                <td className="px-1 py-1">{linha.numFatura}</td>
                <td className="px-1 py-1">{linha.os}</td>
                <td className="px-1 py-1 text-center">{linha.qtd}</td>
                <td colSpan={6} />
              </tr>
            );
          }

          return (
            <tr key={`srv-${idx}`} className="border-b border-[#bebebe]">
              <td />
              <td />
              <td className="px-1 py-1">{linha.os}</td>
              <td className="px-1 py-1 text-center">{linha.qtd}</td>
              <td className="px-1 py-1">{linha.servico}</td>
              <td className="px-1 py-1 text-center">{linha.entrega || "—"}</td>
              <td className="px-1 py-1 text-right tabular-nums">
                {linha.valorUn > 0 ? `R$ ${moneyBr(linha.valorUn)}` : ""}
              </td>
              <td className="px-1 py-1 text-right">{linha.descPercent || "% 0,00"}</td>
              <td className="px-1 py-1 text-right tabular-nums">R$ {moneyBr(linha.valor)}</td>
              <td className="px-1 py-1 text-right tabular-nums">R$ {moneyBr(linha.saldo)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function ExtratoPublicoHtml({ conteudo }: { conteudo: ExtratoPublicaConteudo }) {
  const linhas1 = conteudo.linhas1 ?? [];
  const linhas3 = conteudo.linhas3 ?? [];
  const resumo1 = conteudo.resumo1;
  const resumo3 = conteudo.resumo3;

  return (
    <div className="mx-auto max-w-[1100px] bg-white p-6 text-black print:p-4">
      <CabecalhoLab clienteNome={conteudo.clienteNome} periodoLabel={conteudo.periodoLabel} />
      <div className="overflow-x-auto">
        {conteudo.modelo === "extrato-3-agrupado-paciente" ? (
          <Extrato3Html linhas={linhas3} resumo={resumo3!} />
        ) : (
          <ExtratoIndividualHtml
            linhas={linhas1}
            resumo={resumo1!}
            modelo={conteudo.modelo}
          />
        )}
      </div>
      {resumo1 ? <ResumoExtratoTabela resumo={resumo1} /> : null}
      {resumo3 ? <ResumoExtratoTabela resumo={resumo3} /> : null}
    </div>
  );
}
