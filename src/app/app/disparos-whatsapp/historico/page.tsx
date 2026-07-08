"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Input, Select, StatCard, Table } from "@/components/ui";
import type { CampanhaPublica } from "@/lib/whatsapp-disparos/campanha-servidor";
import { ArrowLeft, Copy, Download, Search } from "lucide-react";

export default function HistoricoDisparosPage() {
  const [campanhas, setCampanhas] = useState<CampanhaPublica[]>([]);
  const [status, setStatus] = useState("todos");
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams();
      if (status !== "todos") params.set("status", status);
      if (busca.trim()) params.set("busca", busca.trim());
      const res = await fetch(`/api/disparos-whatsapp/historico?${params}`);
      const data = (await res.json()) as { campanhas: CampanhaPublica[] };
      setCampanhas(data.campanhas || []);
    } finally {
      setCarregando(false);
    }
  }, [status, busca]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const totais = campanhas.reduce(
    (acc, c) => ({
      enviadas: acc.enviadas + c.enviadas,
      falhas: acc.falhas + c.falhas,
    }),
    { enviadas: 0, falhas: 0 }
  );

  return (
    <div className="min-h-full bg-[#e8eaed] px-4 py-5 dark:bg-slate-950 md:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/app/disparos-whatsapp" className="mb-2 inline-flex items-center gap-1 text-sm text-primary-600">
            <ArrowLeft className="h-4 w-4" /> Voltar aos disparos
          </Link>
          <h1 className="text-2xl font-semibold text-slate-800">Histórico de campanhas</h1>
        </div>
        <div className="flex gap-2">
          <a href="/api/disparos-whatsapp/historico?formato=xlsx">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4" /> Exportar Excel
            </Button>
          </a>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard title="Campanhas listadas" value={String(campanhas.length)} icon={Search} />
        <StatCard title="Mensagens enviadas" value={String(totais.enviadas)} icon={Copy} />
        <StatCard title="Falhas" value={String(totais.falhas)} icon={Search} />
      </div>

      <div className="mb-4 flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="min-w-[160px]">
          <option value="todos">Todos</option>
          <option value="concluida">Finalizadas</option>
          <option value="cancelada">Canceladas</option>
          <option value="rascunho">Rascunhos</option>
          <option value="enviando">Em envio</option>
        </Select>
        <Input
          label="Pesquisar"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Nome da campanha"
          className="min-w-[220px] flex-1"
        />
        <div className="flex items-end">
          <Button onClick={() => void carregar()}>Filtrar</Button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {carregando ? (
          <p className="p-8 text-center text-sm text-slate-500">Carregando…</p>
        ) : (
          <Table headers={["Nome", "Usuário", "Enviadas", "Falhas", "Status", "Início", "Fim", "Ações"]}>
            {campanhas.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-medium">{c.nome}</td>
                <td className="px-4 py-3 text-slate-600">{c.userName || "—"}</td>
                <td className="px-4 py-3">{c.enviadas}</td>
                <td className="px-4 py-3 text-red-700">{c.falhas}</td>
                <td className="px-4 py-3">{c.status}</td>
                <td className="px-4 py-3 text-xs">{c.iniciadoEm ? new Date(c.iniciadoEm).toLocaleString("pt-BR") : "—"}</td>
                <td className="px-4 py-3 text-xs">{c.concluidoEm ? new Date(c.concluidoEm).toLocaleString("pt-BR") : "—"}</td>
                <td className="px-4 py-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await fetch(`/api/disparos-whatsapp/campanhas/${c.id}/duplicar`, { method: "POST" });
                      alert("Campanha duplicada.");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" /> Duplicar
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>
    </div>
  );
}
