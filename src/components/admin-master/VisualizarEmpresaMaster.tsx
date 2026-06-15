"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Building2, Users, Wallet } from "lucide-react";
import { rotuloPlanoEmpresa } from "@/lib/master-planos";
import { cn } from "@/lib/utils";

type DetalheEmpresa = {
  empresa: {
    id: string;
    codigo: string | null;
    nome: string;
    slug: string;
    responsavel: string | null;
    cnpj: string | null;
    telefone: string | null;
    whatsapp: string | null;
    email: string | null;
    cidade: string | null;
    estado: string | null;
    plano: string;
    status: string;
    dataVencimento: string | null;
    urlAcesso: string;
    createdAt: string;
  };
  usuarios: Array<{ id: string; name: string; email: string; role: string }>;
  clientes: Array<{ id: string; nome: string; email: string | null; telefone: string | null; ativo: boolean }>;
  trabalhos: Array<{
    id: string;
    numeroOs: number;
    tipoProtese: string;
    status: string;
    valor: number;
    cliente: { nome: string };
  }>;
  financeiro: {
    totalReceitas: number;
    totalDespesas: number;
    lancamentosRecentes: Array<{
      id: string;
      tipo: string;
      descricao: string;
      valor: number;
      status: string;
      data: string;
    }>;
  };
  totais: {
    clientes: number;
    trabalhos: number;
    lancamentos: number;
    usuarios: number;
  };
  configuracoes: Record<string, unknown> | null;
};

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function VisualizarEmpresaMaster({ empresaId }: { empresaId: string }) {
  const [dados, setDados] = useState<DetalheEmpresa | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    fetch(`/api/admin-master/empresas/${empresaId}`)
      .then(async (res) => {
        if (!res.ok) {
          setErro("Empresa não encontrada.");
          return;
        }
        setDados(await res.json());
      })
      .catch(() => setErro("Erro ao carregar dados."));
  }, [empresaId]);

  if (erro) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">
        {erro}
        <div className="mt-4">
          <Link href="/admin-master" className="text-[#4a90d9] hover:underline">
            Voltar ao painel
          </Link>
        </div>
      </div>
    );
  }

  if (!dados) {
    return <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Carregando...</div>;
  }

  const { empresa, usuarios, clientes, trabalhos, financeiro, totais, configuracoes } = dados;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/admin-master"
            className="mb-2 inline-flex items-center gap-1 text-xs text-[#4a90d9] hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </Link>
          <h1 className="text-xl font-semibold text-slate-800">{empresa.nome}</h1>
          <p className="text-sm text-slate-500">
            Visualização somente leitura · {empresa.codigo ?? empresa.id}
          </p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-[#4a90d9]">
          Modo somente leitura
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { titulo: "Usuários", valor: totais.usuarios, Icon: Users },
          { titulo: "Clientes", valor: totais.clientes, Icon: Building2 },
          { titulo: "Trabalhos", valor: totais.trabalhos, Icon: Building2 },
          { titulo: "Receitas", valor: formatarMoeda(financeiro.totalReceitas), Icon: Wallet },
        ].map((card) => (
          <div key={card.titulo} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500">
              <card.Icon className="h-4 w-4" />
              <span className="text-xs font-medium">{card.titulo}</span>
            </div>
            <p className="mt-2 text-lg font-semibold text-slate-800">{card.valor}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">Dados da Empresa</h2>
          <dl className="grid gap-2 text-xs sm:grid-cols-2">
            {[
              ["Código", empresa.codigo ?? "—"],
              ["Slug", empresa.slug],
              ["Responsável", empresa.responsavel ?? "—"],
              ["CNPJ", empresa.cnpj ?? "—"],
              ["E-mail", empresa.email ?? "—"],
              ["Telefone", empresa.telefone ?? "—"],
              ["Cidade/UF", `${empresa.cidade ?? "—"} / ${empresa.estado ?? "—"}`],
              ["Plano", rotuloPlanoEmpresa(empresa.plano)],
              ["Status", empresa.status],
              ["URL", empresa.urlAcesso],
            ].map(([label, valor]) => (
              <div key={label}>
                <dt className="text-slate-400">{label}</dt>
                <dd className="font-medium text-slate-700">{valor}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">Financeiro</h2>
          <div className="mb-4 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-slate-500">Receitas pagas</p>
              <p className="text-lg font-semibold text-emerald-700">
                {formatarMoeda(financeiro.totalReceitas)}
              </p>
            </div>
            <div className="rounded-lg bg-red-50 p-3">
              <p className="text-slate-500">Despesas pagas</p>
              <p className="text-lg font-semibold text-red-600">
                {formatarMoeda(financeiro.totalDespesas)}
              </p>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="pb-2">Descrição</th>
                  <th className="pb-2">Valor</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {financeiro.lancamentosRecentes.map((l) => (
                  <tr key={l.id} className="border-t border-slate-100">
                    <td className="py-1.5 text-slate-700">{l.descricao}</td>
                    <td className={cn("py-1.5", l.tipo === "receita" ? "text-emerald-600" : "text-red-600")}>
                      {formatarMoeda(l.valor)}
                    </td>
                    <td className="py-1.5 text-slate-500">{l.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Usuários ({usuarios.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-slate-400">
              <tr>
                <th className="pb-2">Nome</th>
                <th className="pb-2">E-mail</th>
                <th className="pb-2">Papel</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="py-2 text-slate-800">{u.name}</td>
                  <td className="py-2 text-slate-600">{u.email}</td>
                  <td className="py-2 text-slate-500">{u.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">Clientes (amostra)</h2>
          <ul className="space-y-2 text-xs">
            {clientes.map((c) => (
              <li key={c.id} className="flex justify-between border-b border-slate-100 pb-2">
                <span className="font-medium text-slate-800">{c.nome}</span>
                <span className={c.ativo ? "text-emerald-600" : "text-slate-400"}>
                  {c.ativo ? "Ativo" : "Inativo"}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">Trabalhos recentes</h2>
          <ul className="space-y-2 text-xs">
            {trabalhos.map((t) => (
              <li key={t.id} className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-800">
                  OS {t.numeroOs} — {t.tipoProtese}
                </span>
                <span className="text-slate-500">{t.status}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {configuracoes && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">Configurações do Laboratório</h2>
          <pre className="max-h-64 overflow-auto rounded-lg bg-slate-50 p-4 text-[11px] text-slate-600">
            {JSON.stringify(configuracoes, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}
