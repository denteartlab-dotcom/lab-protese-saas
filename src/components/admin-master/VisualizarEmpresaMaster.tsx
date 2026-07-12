"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, Users, Wallet } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import type { Locale, MessageKey } from "@/lib/i18n";
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

function localeTag(locale: Locale) {
  if (locale === "pt") return "pt-BR";
  if (locale === "es") return "es-ES";
  return "en-US";
}

function rotuloPlano(plano: string, t: (key: MessageKey) => string) {
  const mapa: Record<string, MessageKey> = {
    basico: "admin.master.plano.basico",
    profissional: "admin.master.plano.profissional",
    premium: "admin.master.plano.premium",
  };
  return t(mapa[plano] ?? "admin.master.plano.basico");
}

function rotuloStatus(status: string, t: (key: MessageKey) => string) {
  const mapa: Record<string, MessageKey> = {
    ativo: "admin.master.status.ativo",
    pendente: "admin.master.status.pendente",
    inativo: "admin.master.status.inativo",
    bloqueado: "admin.master.status.bloqueado",
  };
  return t(mapa[status] ?? "admin.master.status.inativo");
}

export function VisualizarEmpresaMaster({ empresaId }: { empresaId: string }) {
  const { t, locale } = useI18n();
  const [dados, setDados] = useState<DetalheEmpresa | null>(null);
  const [erro, setErro] = useState("");

  const formatarMoeda = useMemo(
    () => (valor: number) =>
      valor.toLocaleString(localeTag(locale), { style: "currency", currency: "BRL" }),
    [locale]
  );

  useEffect(() => {
    fetch(`/api/admin-master/empresas/${empresaId}`)
      .then(async (res) => {
        if (!res.ok) {
          setErro(t("admin.master.view.erroNaoEncontrada"));
          return;
        }
        setDados(await res.json());
      })
      .catch(() => setErro(t("admin.master.view.erroCarregar")));
  }, [empresaId, t]);

  if (erro) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">
        {erro}
        <div className="mt-4">
          <Link href="/admin-master" className="text-[#4a90d9] hover:underline">
            {t("admin.master.voltarPainel")}
          </Link>
        </div>
      </div>
    );
  }

  if (!dados) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
        {t("admin.master.carregando")}
      </div>
    );
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
            {t("admin.master.voltar")}
          </Link>
          <h1 className="text-xl font-semibold text-slate-800">{empresa.nome}</h1>
          <p className="text-sm text-slate-500">
            {t("admin.master.view.subtitulo", { codigo: empresa.codigo ?? empresa.id })}
          </p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-[#4a90d9]">
          {t("admin.master.view.somenteLeitura")}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { titulo: t("admin.master.col.usuarios"), valor: totais.usuarios, Icon: Users },
          { titulo: t("admin.master.view.clientes"), valor: totais.clientes, Icon: Building2 },
          { titulo: t("admin.master.col.trabalhos"), valor: totais.trabalhos, Icon: Building2 },
          { titulo: t("admin.master.view.receitas"), valor: formatarMoeda(financeiro.totalReceitas), Icon: Wallet },
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
          <h2 className="mb-4 text-sm font-semibold text-slate-700">{t("admin.master.secao.dadosEmpresa")}</h2>
          <dl className="grid gap-2 text-xs sm:grid-cols-2">
            {[
              [t("admin.master.view.campo.codigo"), empresa.codigo ?? "—"],
              [t("admin.master.view.campo.slug"), empresa.slug],
              [t("admin.master.campo.responsavel"), empresa.responsavel ?? "—"],
              [t("admin.master.campo.cnpj"), empresa.cnpj ?? "—"],
              [t("admin.master.campo.email"), empresa.email ?? "—"],
              [t("admin.master.campo.telefone"), empresa.telefone ?? "—"],
              [
                t("admin.master.view.campo.cidadeUf"),
                `${empresa.cidade ?? "—"} / ${empresa.estado ?? "—"}`,
              ],
              [t("admin.master.col.plano"), rotuloPlano(empresa.plano, t)],
              [t("admin.master.col.status"), rotuloStatus(empresa.status, t)],
              [t("admin.master.view.campo.url"), empresa.urlAcesso],
            ].map(([label, valor]) => (
              <div key={String(label)}>
                <dt className="text-slate-400">{label}</dt>
                <dd className="font-medium text-slate-700">{valor}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">{t("admin.master.view.financeiro")}</h2>
          <div className="mb-4 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-slate-500">{t("admin.master.view.receitasPagas")}</p>
              <p className="text-lg font-semibold text-emerald-700">
                {formatarMoeda(financeiro.totalReceitas)}
              </p>
            </div>
            <div className="rounded-lg bg-red-50 p-3">
              <p className="text-slate-500">{t("admin.master.view.despesasPagas")}</p>
              <p className="text-lg font-semibold text-red-600">
                {formatarMoeda(financeiro.totalDespesas)}
              </p>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="pb-2">{t("admin.master.col.descricao")}</th>
                  <th className="pb-2">{t("admin.master.col.valor")}</th>
                  <th className="pb-2">{t("admin.master.col.status")}</th>
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
        <h2 className="mb-4 text-sm font-semibold text-slate-700">
          {t("admin.master.view.usuariosTitulo", { n: usuarios.length })}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-slate-400">
              <tr>
                <th className="pb-2">{t("admin.master.col.nome")}</th>
                <th className="pb-2">{t("admin.master.col.email")}</th>
                <th className="pb-2">{t("admin.master.col.papel")}</th>
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
          <h2 className="mb-4 text-sm font-semibold text-slate-700">{t("admin.master.view.clientesAmostra")}</h2>
          <ul className="space-y-2 text-xs">
            {clientes.map((c) => (
              <li key={c.id} className="flex justify-between border-b border-slate-100 pb-2">
                <span className="font-medium text-slate-800">{c.nome}</span>
                <span className={c.ativo ? "text-emerald-600" : "text-slate-400"}>
                  {c.ativo ? t("admin.master.status.ativo") : t("admin.master.status.inativo")}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">{t("admin.master.view.trabalhosRecentes")}</h2>
          <ul className="space-y-2 text-xs">
            {trabalhos.map((trabalho) => (
              <li key={trabalho.id} className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-800">
                  {t("admin.master.view.os", {
                    numero: trabalho.numeroOs,
                    tipo: trabalho.tipoProtese,
                  })}
                </span>
                <span className="text-slate-500">{trabalho.status}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {configuracoes && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">{t("admin.master.view.configuracoes")}</h2>
          <pre className="max-h-64 overflow-auto rounded-lg bg-slate-50 p-4 text-[11px] text-slate-600">
            {JSON.stringify(configuracoes, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}
