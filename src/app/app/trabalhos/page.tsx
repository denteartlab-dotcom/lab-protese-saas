"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Printer, Eye } from "lucide-react";
import { BarraConfigListagem } from "@/components/listagem/BarraConfigListagem";
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
          <h1 className="text-2xl font-bold">Trabalhos / OS</h1>
          <p className="text-slate-600">Ordens de serviço e requisições</p>
        </div>
        <Link href="/app/trabalhos/novo">
          <Button>
            <Plus className="h-4 w-4" /> Nova OS
          </Button>
        </Link>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm"
              placeholder="Buscar OS, paciente, cliente..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Todos os status</option>
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
            { valor: "numeroOs", label: "Num OS" },
            { valor: "paciente", label: "Paciente" },
            { valor: "cliente", label: "Cliente" },
            { valor: "dataPrevista", label: "Previsão" },
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
            "OS",
            "Paciente",
            "Cliente",
            "Tipo",
            "Status",
            "Valor",
            "Previsão",
            "Ações",
          ]}
        >
          {listagem.itensPagina.map((t) => (
            <tr key={t.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <span className="inline-flex min-w-8 items-center justify-center rounded bg-slate-100 px-2 py-1 font-semibold text-slate-600">
                  {t.numeroOs}
                </span>
              </td>
              <td className="px-4 py-3">{t.paciente.nome}</td>
              <td className="px-4 py-3">{t.cliente.nome}</td>
              <td className="px-4 py-3">{t.tipoProtese}</td>
              <td className="px-4 py-3">
                <Badge className={STATUS_TRABALHO[t.status]?.color}>
                  {STATUS_TRABALHO[t.status]?.label}
                </Badge>
              </td>
              <td className="px-4 py-3">{formatCurrency(t.valor)}</td>
              <td className="px-4 py-3">{formatDate(t.dataPrevista)}</td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
                  <Link href={`/app/trabalhos/${t.id}`}>
                    <Button size="sm" variant="ghost">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href={`/app/trabalhos/${t.id}/imprimir`} target="_blank">
                    <Button size="sm" variant="ghost">
                      <Printer className="h-4 w-4" />
                    </Button>
                  </Link>
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
