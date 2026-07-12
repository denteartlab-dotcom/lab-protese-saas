"use client";

import { ControleProducaoToolbar, type ControleProducaoView } from "@/components/ControleProducaoToolbar";
import { useI18n } from "@/components/i18n-provider";
import { Card, Table } from "@/components/ui";

const linhas = [
  ["#1001", "Maria Oliveira", "Coroa em zircônia", "Produção", "23/05/2026"],
  ["#1002", "João Santos", "Prótese total", "Prova", "30/05/2026"],
  ["#1003", "Ana Paula", "Protocolo", "Finalizado", "02/06/2026"],
];

export function ProducaoSimplePage({
  title,
  description,
  viewAtiva,
}: {
  title: string;
  description: string;
  viewAtiva?: ControleProducaoView;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-4 text-sm">
      <div className="text-sm text-slate-500">
        {t("producao.module.producao")} / <span className="font-medium text-slate-700">{title}</span>
      </div>
      {viewAtiva ? (
        <div className="rounded border border-slate-200 bg-white p-3 shadow-sm">
          <ControleProducaoToolbar viewAtiva={viewAtiva} />
        </div>
      ) : null}
      <Card>
        <h1 className="text-xl font-semibold text-slate-800">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </Card>
      <Card title={t("producao.module.servicos")}>
        <Table
          headers={[
            t("relatorio.comum.os"),
            t("relatorio.comum.paciente"),
            t("relatorio.comum.servico"),
            t("relatorio.filtro.status"),
            t("producao.module.colunaPrazo"),
          ]}
        >
          {linhas.map((linha) => (
            <tr key={linha[0]}>
              {linha.map((coluna) => (
                <td key={coluna} className="px-4 py-3">
                  {coluna}
                </td>
              ))}
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
