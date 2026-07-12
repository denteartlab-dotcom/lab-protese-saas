"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Printer, Eye } from "lucide-react";
import { LinkImprimirOs } from "@/components/LinkImprimirOs";
import { BarraConfigListagem } from "@/components/listagem/BarraConfigListagem";
import { useI18n } from "@/components/i18n-provider";
import { Button, Card, Badge, Table } from "@/components/ui";
import { useListagemPaginada } from "@/hooks/use-listagem-paginada";
import { compararDataIso, compararNumero, compararTextoBr } from "@/lib/listagem-config";
import { formatCurrency, formatDate, STATUS_TRABALHO } from "@/lib/utils";

type Trabalho = {
  id: string;
  numeroOs: number;
  tipoProtese: string;
  status: string;
  valor: number;
  dataEntrada: string;
  dataPrevista?: string | null;
  cliente: { nome: string };
  paciente: { nome: string };
};

export default function TrabalhosPage() {
  const { t } = useI18n();
  const [list, setList] = useState<Trabalho[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  async function load() {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    const res = await fetch(`/api/trabalhos?${params}`);
    setList(await res.json());
  }

  useEffect(() => {
    load();
  }, [q, status]);

  const listagem = useListagemPaginada<Trabalho, "numeroOs" | "paciente" | "cliente" | "dataPrevista">({
    storageKey: "trabalhos",
    itens: list,
    padrao: { ordenarPor: "numeroOs", direcao: "desc", porPagina: 50 },
    comparadores: {
      numeroOs: (a, b) => compararNumero(a.numeroOs, b.numeroOs),
      paciente: (a, b) => compararTextoBr(a.paciente.nome, b.paciente.nome),
      cliente: (a, b) => compararTextoBr(a.cliente.nome, b.cliente.nome),
      dataPrevista: (a, b) => compararDataIso(a.dataPrevista, b.dataPrevista),
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("cadastros.trabalhos.titulo")}</h1>
          <p className="text-slate-600">{t("cadastros.trabalhos.subtitulo")}</p>
        </div>
        <Link href="/app/trabalhos/novo">
          <Button>
            <Plus className="h-4 w-4" /> {t("cadastros.trabalhos.nova")}
          </Button>
        </Link>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm"
              placeholder={t("cadastros.trabalhos.buscarPlaceholder")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">{t("cadastros.trabalhos.todosStatus")}</option>
            {Object.entries(STATUS_TRABALHO).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <BarraConfigListagem
          embutido
          configAberto={listagem.configAberto}
          onToggleConfig={() =>
            listagem.configAberto ? listagem.fecharConfig() : listagem.abrirConfig()
          }
          onFecharConfig={listagem.fecharConfig}
          rascunho={listagem.rascunho}
          opcoesOrdenacao={[
            { valor: "numeroOs", label: t("relatorio.comum.os") },
            { valor: "paciente", label: t("relatorio.comum.paciente") },
            { valor: "cliente", label: t("relatorio.comum.cliente") },
            { valor: "dataPrevista", label: t("cadastros.trabalhos.colunaPrevisao") },
          ]}
          onAlterarOrdenarPor={(valor) => listagem.atualizarRascunho({ ordenarPor: valor })}
          onAlterarDirecao={(direcao) => listagem.atualizarRascunho({ direcao })}
          onAlterarPorPagina={(porPagina) => listagem.atualizarRascunho({ porPagina })}
          onGravarConfig={listagem.gravarConfig}
          pagina={listagem.pagina}
          totalPaginas={listagem.totalPaginas}
          onPagina={listagem.setPagina}
          totalItens={listagem.totalItens}
        >
        <Table
          headers={[
            t("relatorio.comum.os"),
            t("relatorio.comum.paciente"),
            t("relatorio.comum.cliente"),
            t("cadastros.trabalhos.colunaTipo"),
            t("relatorio.filtro.status"),
            t("cadastros.trabalhos.colunaValor"),
            t("cadastros.trabalhos.colunaPrevisao"),
            t("cadastros.comum.acoes"),
          ]}
        >
          {listagem.itensPagina.map((trabalho) => (
            <tr key={trabalho.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <span className="inline-flex min-w-8 items-center justify-center rounded bg-slate-100 px-2 py-1 font-semibold text-slate-600">
                  {trabalho.numeroOs}
                </span>
              </td>
              <td className="px-4 py-3">{trabalho.paciente.nome}</td>
              <td className="px-4 py-3">{trabalho.cliente.nome}</td>
              <td className="px-4 py-3">{trabalho.tipoProtese}</td>
              <td className="px-4 py-3">
                <Badge className={STATUS_TRABALHO[trabalho.status]?.color}>
                  {STATUS_TRABALHO[trabalho.status]?.label}
                </Badge>
              </td>
              <td className="px-4 py-3">{formatCurrency(trabalho.valor)}</td>
              <td className="px-4 py-3">{formatDate(trabalho.dataPrevista)}</td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
                  <Link href={`/app/trabalhos/${trabalho.id}`}>
                    <Button size="sm" variant="ghost">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                  <LinkImprimirOs trabalho={trabalho}>
                    <Button size="sm" variant="ghost" type="button">
                      <Printer className="h-4 w-4" />
                    </Button>
                  </LinkImprimirOs>
                </div>
              </td>
            </tr>
          ))}
        </Table>
        </BarraConfigListagem>
      </Card>
    </div>
  );
}
