"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Building2,
  Crown,
  Diamond,
  Eye,
  Lock,
  Pencil,
  RefreshCw,
  Save,
  Star,
  Trash2,
  Unlock,
  Users,
  Wallet,
} from "lucide-react";
import { LIMITES_PLANO_PADRAO, rotuloPlanoEmpresa } from "@/lib/master-planos";
import { cn } from "@/lib/utils";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Dashboard = {
  totalEmpresas: number;
  empresasAtivas: number;
  empresasBloqueadas: number;
  empresasInadimplentes: number;
  totalUsuarios: number;
  totalTrabalhos: number;
  faturamentoTotal: number;
  receitaMensal: number;
  receitaAnual: number;
};

type EmpresaItem = {
  id: string;
  codigo: string | null;
  nome: string;
  slug: string;
  responsavel: string | null;
  plano: string;
  limiteUsuarios: number;
  limiteTrabalhos: number;
  dataVencimento: string | null;
  status: string;
  totalUsuarios: number;
  totalTrabalhos: number;
  urlAcesso: string;
};

type CobrancaAssinaturaItem = {
  id: string;
  empresaNome: string;
  empresaCodigo: string | null;
  provedor: string;
  plano: string;
  valor: number;
  diasRenovacao: number;
  statusAsaas: string;
  pago: boolean;
  pagoEm: string | null;
  renovadoEm: string | null;
  createdAt: string;
};

const ESTADOS_BR = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const formularioVazio = () => ({
  nome: "",
  responsavel: "",
  cnpj: "",
  telefone: "",
  whatsapp: "",
  email: "",
  cidade: "",
  estado: "SP",
  plano: "profissional" as "basico" | "profissional" | "premium",
  limiteUsuarios: LIMITES_PLANO_PADRAO.profissional.usuarios,
  limiteTrabalhos: LIMITES_PLANO_PADRAO.profissional.trabalhos,
  dataVencimento: "",
  diasAssinatura: 30,
  status: "ativo" as "ativo" | "inativo" | "bloqueado" | "pendente",
  observacoes: "",
  adminNome: "",
  adminEmail: "",
  adminSenha: "",
  adminConfirmarSenha: "",
});

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function badgeStatus(status: string) {
  const mapa: Record<string, string> = {
    ativo: "bg-emerald-100 text-emerald-700",
    pendente: "bg-amber-100 text-amber-800",
    inativo: "bg-slate-100 text-slate-600",
    bloqueado: "bg-red-100 text-red-700",
  };
  const rotulo: Record<string, string> = {
    ativo: "Ativo",
    pendente: "Pendente",
    inativo: "Inativo",
    bloqueado: "Bloqueado",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", mapa[status] ?? mapa.inativo)}>
      {rotulo[status] ?? status}
    </span>
  );
}

function rotuloProvedor(provedor: string) {
  return provedor === "mercadopago" ? "Mercado Pago" : "Asaas";
}

function badgeCobranca(pago: boolean, statusAsaas: string) {
  if (pago) {
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
        Paga
      </span>
    );
  }
  const mapa: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-800",
    pending: "bg-amber-100 text-amber-800",
    in_process: "bg-amber-100 text-amber-800",
    OVERDUE: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
        mapa[statusAsaas] ?? "bg-slate-100 text-slate-600"
      )}
    >
      Pendente
    </span>
  );
}

function tabelaCobrancas(titulo: string, itens: CobrancaAssinaturaItem[], vazio: string) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold text-slate-600">
        {titulo} ({itens.length})
      </h3>
      {itens.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
          {vazio}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Empresa</th>
                <th className="px-3 py-2">Provedor</th>
                <th className="px-3 py-2">Plano</th>
                <th className="px-3 py-2">Valor</th>
                <th className="px-3 py-2">Dias</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Pago em</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item) => (
                <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                  <td className="px-3 py-2 text-slate-600">
                    {formatarData(item.createdAt)}
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium text-slate-800">{item.empresaNome}</p>
                    <p className="font-mono text-[10px] text-slate-400">
                      {item.empresaCodigo ?? "—"}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{rotuloProvedor(item.provedor)}</td>
                  <td className="px-3 py-2">{badgePlano(item.plano)}</td>
                  <td className="px-3 py-2 font-medium text-slate-700">
                    {formatarMoeda(item.valor)}
                  </td>
                  <td className="px-3 py-2 text-slate-600">+{item.diasRenovacao}</td>
                  <td className="px-3 py-2">{badgeCobranca(item.pago, item.statusAsaas)}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {item.pagoEm ? formatarData(item.pagoEm) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function badgePlano(plano: string) {
  const mapa: Record<string, string> = {
    basico: "bg-sky-100 text-sky-700",
    profissional: "bg-violet-100 text-violet-700",
    premium: "bg-amber-100 text-amber-800",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", mapa[plano] ?? mapa.basico)}>
      {rotuloPlanoEmpresa(plano)}
    </span>
  );
}

export function AdminMasterPainel() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [empresas, setEmpresas] = useState<EmpresaItem[]>([]);
  const [form, setForm] = useState(formularioVazio);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [diasAtivacao, setDiasAtivacao] = useState<Record<string, number>>({});
  const [cobrancasPendentes, setCobrancasPendentes] = useState<CobrancaAssinaturaItem[]>([]);
  const [cobrancasPagas, setCobrancasPagas] = useState<CobrancaAssinaturaItem[]>([]);

  const carregar = useCallback(async () => {
    const opcoesFetch: RequestInit = { cache: "no-store" };
    const [resumoRes, empRes, cobRes] = await Promise.all([
      fetch("/api/admin-master/dashboard/resumo", opcoesFetch),
      fetch("/api/admin-master/empresas", opcoesFetch),
      fetch("/api/admin-master/cobrancas-assinatura", opcoesFetch),
    ]);
    if (resumoRes.ok) {
      const data = await resumoRes.json();
      if (data.dashboard) setDashboard(data.dashboard);
    }
    if (empRes.ok) {
      const data = await empRes.json();
      setEmpresas(data.empresas ?? []);
    }
    if (cobRes.ok) {
      const data = await cobRes.json();
      setCobrancasPendentes(data.pendentes ?? []);
      setCobrancasPagas(data.pagas ?? []);
    }
  }, []);

  useEffect(() => {
    carregar().catch(() => undefined);
  }, [carregar]);

  const graficoReceita = useMemo(
    () => [
      { nome: "Mensal", valor: dashboard?.receitaMensal ?? 0 },
      { nome: "Anual", valor: dashboard?.receitaAnual ?? 0 },
      { nome: "Total", valor: dashboard?.faturamentoTotal ?? 0 },
    ],
    [dashboard]
  );

  function alterarPlano(plano: "basico" | "profissional" | "premium") {
    const limites = LIMITES_PLANO_PADRAO[plano];
    setForm((f) => ({
      ...f,
      plano,
      limiteUsuarios: limites.usuarios,
      limiteTrabalhos: limites.trabalhos,
    }));
  }

  function limparFormulario() {
    setForm(formularioVazio());
    setEditandoId(null);
    setErro("");
    setMensagem("");
  }

  function preencherEdicao(empresa: EmpresaItem) {
    setEditandoId(empresa.id);
    setForm((f) => ({
      ...f,
      nome: empresa.nome,
      responsavel: empresa.responsavel ?? "",
      plano: (empresa.plano as "basico" | "profissional" | "premium") || "basico",
      limiteUsuarios: empresa.limiteUsuarios,
      limiteTrabalhos: empresa.limiteTrabalhos,
      dataVencimento: empresa.dataVencimento?.slice(0, 10) ?? "",
      status: (empresa.status as "ativo" | "inativo" | "bloqueado") || "ativo",
      adminNome: "",
      adminEmail: "",
      adminSenha: "",
      adminConfirmarSenha: "",
    }));
    setMensagem("");
    setErro("");
    window.scrollTo({ top: 400, behavior: "smooth" });
  }

  async function salvarConta() {
    setErro("");
    setMensagem("");
    if (!form.nome.trim()) {
      setErro("Informe o nome da empresa.");
      return;
    }
    if (!editandoId) {
      if (!form.adminNome.trim() || !form.adminEmail.trim() || !form.adminSenha) {
        setErro("Preencha os dados do administrador.");
        return;
      }
      if (form.adminSenha !== form.adminConfirmarSenha) {
        setErro("As senhas não conferem.");
        return;
      }
    }

    setSalvando(true);
    try {
      const payload = {
        nome: form.nome,
        responsavel: form.responsavel,
        cnpj: form.cnpj,
        telefone: form.telefone,
        whatsapp: form.whatsapp,
        email: form.email,
        cidade: form.cidade,
        estado: form.estado,
        plano: form.plano,
        limiteUsuarios: form.limiteUsuarios,
        limiteTrabalhos: form.limiteTrabalhos,
        dataVencimento: form.dataVencimento || null,
        observacoes: form.observacoes,
        status: form.status,
        diasAssinatura: form.diasAssinatura,
        adminNome: form.adminNome || undefined,
        adminEmail: form.adminEmail || undefined,
        adminSenha: form.adminSenha || undefined,
      };

      const url = editandoId
        ? `/api/admin-master/empresas/${editandoId}`
        : "/api/admin-master/empresas";
      const res = await fetch(url, {
        method: editandoId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error || "Erro ao salvar.");
        return;
      }
      setMensagem(editandoId ? "Conta atualizada com sucesso." : "Conta criada com sucesso.");
      limparFormulario();
      await carregar();
    } catch {
      setErro("Erro de conexão.");
    } finally {
      setSalvando(false);
    }
  }

  async function ativarAssinatura(id: string) {
    const dias = diasAtivacao[id] ?? 30;
    const res = await fetch(`/api/admin-master/empresas/${id}/ativar-assinatura`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dias }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErro(data.error || "Erro ao ativar assinatura.");
      return;
    }
    setMensagem(`Assinatura ativada por ${dias} dias.`);
    await carregar();
  }

  async function acaoEmpresa(id: string, acao: "bloquear" | "reativar" | "excluir") {
    if (acao === "excluir" && !confirm("Excluir esta empresa e todos os dados? Esta ação é irreversível.")) {
      return;
    }
    setErro("");
    const url =
      acao === "excluir"
        ? `/api/admin-master/empresas/${id}`
        : `/api/admin-master/empresas/${id}/${acao}`;
    const res = await fetch(url, { method: acao === "excluir" ? "DELETE" : "POST" });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setErro(data.error || "Não foi possível concluir a ação.");
      await carregar();
      return;
    }
    if (acao === "excluir") {
      setEmpresas((atual) => atual.filter((empresa) => empresa.id !== id));
      if (editandoId === id) limparFormulario();
      setMensagem("Conta excluída com sucesso.");
    }
    await carregar();
  }

  const proximoCodigo = `EMP-${String((empresas.length || 0) + 1).padStart(5, "0")}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">
            {editandoId ? "Editar Conta" : "Cadastro de Nova Conta"}
          </h1>
          <p className="text-sm text-slate-500">
            {editandoId
              ? "Atualize os dados do laboratório selecionado."
              : "Cadastre novos laboratórios no sistema."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => carregar()}
          className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Atualizar
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { titulo: "Total de Contas", valor: dashboard?.totalEmpresas ?? 0, sub: "Laboratórios", cor: "text-[#4a90d9]", Icon: Building2 },
          { titulo: "Contas Ativas", valor: dashboard?.empresasAtivas ?? 0, sub: "Ativas", cor: "text-emerald-600", Icon: Unlock },
          { titulo: "Contas Bloqueadas", valor: dashboard?.empresasBloqueadas ?? 0, sub: "Bloqueadas", cor: "text-orange-600", Icon: Lock },
          { titulo: "Faturamento Mensal", valor: formatarMoeda(dashboard?.receitaMensal ?? 0), sub: "Assinaturas pagas no mês", cor: "text-violet-600", Icon: Wallet },
        ].map((card) => (
          <div key={card.titulo} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-500">{card.titulo}</p>
              <card.Icon className={cn("h-4 w-4", card.cor)} />
            </div>
            <p className={cn("mt-2 text-2xl font-bold", card.cor)}>
              {typeof card.valor === "number" ? card.valor : card.valor}
            </p>
            <p className="text-[11px] text-slate-400">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          {[
            { titulo: "Total de Usuários", valor: dashboard?.totalUsuarios ?? 0, Icon: Users },
            { titulo: "Total de Trabalhos", valor: dashboard?.totalTrabalhos ?? 0, Icon: BarChart3 },
            { titulo: "Receita Anual", valor: formatarMoeda(dashboard?.receitaAnual ?? 0), Icon: Wallet },
            { titulo: "Inadimplentes", valor: dashboard?.empresasInadimplentes ?? 0, Icon: Lock },
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
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold text-slate-600">Receita da Plataforma</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={graficoReceita}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v) => formatarMoeda(typeof v === "number" ? v : Number(v) || 0)}
                />
                <Bar dataKey="valor" fill="#4a90d9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-slate-700">Dados da Empresa</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Nome da Empresa *", "nome"],
                ["Responsável", "responsavel"],
                ["CNPJ", "cnpj"],
                ["Telefone", "telefone"],
                ["WhatsApp", "whatsapp"],
                ["E-mail", "email"],
                ["Cidade", "cidade"],
              ].map(([label, key]) => (
                <div key={key}>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">{label}</label>
                  <input
                    value={form[key as keyof typeof form] as string}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#4a90d9]"
                  />
                </div>
              ))}
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-500">Estado</label>
                <select
                  value={form.estado}
                  onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#4a90d9]"
                >
                  {ESTADOS_BR.map((uf) => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-slate-700">Dados de Acesso (Administrador)</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-500">Usuário Administrador</label>
                <input
                  value={form.adminNome}
                  onChange={(e) => setForm((f) => ({ ...f, adminNome: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#4a90d9]"
                  placeholder={editandoId ? "Deixe vazio para manter" : ""}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-500">E-mail Administrador</label>
                <input
                  type="email"
                  value={form.adminEmail}
                  onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#4a90d9]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-500">Senha</label>
                <input
                  type="password"
                  value={form.adminSenha}
                  onChange={(e) => setForm((f) => ({ ...f, adminSenha: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#4a90d9]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-500">Confirmar Senha</label>
                <input
                  type="password"
                  value={form.adminConfirmarSenha}
                  onChange={(e) => setForm((f) => ({ ...f, adminConfirmarSenha: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#4a90d9]"
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-slate-700">Plano Contratado</h2>
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              {([
                { id: "basico", label: "Básico", Icon: Star },
                { id: "profissional", label: "Profissional", Icon: Crown },
                { id: "premium", label: "Premium", Icon: Diamond },
              ] as const).map((plano) => (
                <button
                  key={plano.id}
                  type="button"
                  onClick={() => alterarPlano(plano.id)}
                  className={cn(
                    "rounded-lg border-2 p-4 text-left transition",
                    form.plano === plano.id
                      ? "border-[#4a90d9] bg-blue-50"
                      : "border-slate-200 hover:border-slate-300"
                  )}
                >
                  <plano.Icon className="mb-2 h-5 w-5 text-[#4a90d9]" />
                  <p className="text-sm font-semibold text-slate-800">{plano.label}</p>
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-500">Limite de Usuários</label>
                <input
                  type="number"
                  min={1}
                  value={form.limiteUsuarios}
                  onChange={(e) => setForm((f) => ({ ...f, limiteUsuarios: Number(e.target.value) }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#4a90d9]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-500">Limite de Trabalhos/Mês</label>
                <input
                  type="number"
                  min={1}
                  value={form.limiteTrabalhos}
                  onChange={(e) => setForm((f) => ({ ...f, limiteTrabalhos: Number(e.target.value) }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#4a90d9]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-500">
                  Dias de assinatura
                </label>
                <input
                  type="number"
                  min={1}
                  value={form.diasAssinatura}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, diasAssinatura: Number(e.target.value) || 30 }))
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#4a90d9]"
                />
                <p className="mt-1 text-[10px] text-slate-400">
                  Ao ativar, a data de vencimento será hoje + dias informados.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-500">Data de Vencimento</label>
                <input
                  type="date"
                  value={form.dataVencimento}
                  onChange={(e) => setForm((f) => ({ ...f, dataVencimento: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#4a90d9]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-500">Status</label>
                <div className="flex gap-2">
                  {(["ativo", "pendente", "inativo", "bloqueado"] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, status }))}
                      className={cn(
                        "flex-1 rounded-md px-2 py-2 text-[10px] font-medium capitalize transition",
                        form.status === status
                          ? status === "ativo"
                            ? "bg-emerald-600 text-white"
                            : status === "pendente"
                              ? "bg-amber-500 text-white"
                            : status === "bloqueado"
                              ? "bg-red-600 text-white"
                              : "bg-slate-600 text-white"
                          : "bg-slate-100 text-slate-600"
                      )}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Observações</label>
              <textarea
                rows={3}
                value={form.observacoes}
                onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#4a90d9]"
              />
            </div>
          </section>

          {mensagem && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{mensagem}</p>}
          {erro && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={salvarConta}
              disabled={salvando}
              className="flex items-center gap-2 rounded-md bg-[#4a90d9] px-4 py-2 text-sm font-medium text-white hover:bg-[#3a7bc8] disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {salvando ? "Salvando..." : editandoId ? "Atualizar Conta" : "Salvar Conta"}
            </button>
            <button
              type="button"
              onClick={limparFormulario}
              className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
            >
              Limpar Formulário
            </button>
            {editandoId && (
              <button
                type="button"
                onClick={limparFormulario}
                className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
              >
                Cancelar Edição
              </button>
            )}
          </div>
        </div>

        <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Ambiente do Sistema</h2>
          <div className="space-y-3 text-xs text-slate-600">
            <div>
              <p className="font-medium text-slate-500">URL de acesso</p>
              <p className="mt-1 break-all rounded bg-slate-50 px-2 py-1.5 font-mono text-[11px]">
                /app/{form.nome ? form.nome.toLowerCase().replace(/\s+/g, "-") : "empresa"}
              </p>
            </div>
            <div>
              <p className="font-medium text-slate-500">ID da Empresa</p>
              <p className="mt-1 font-mono text-sm font-semibold text-[#4a90d9]">{proximoCodigo}</p>
            </div>
            <div>
              <p className="font-medium text-slate-500">Plano</p>
              <p>{rotuloPlanoEmpresa(form.plano)}</p>
            </div>
            <div>
              <p className="font-medium text-slate-500">Limites</p>
              <p>{form.limiteUsuarios} usuários · {form.limiteTrabalhos} trabalhos/mês</p>
            </div>
          </div>
        </aside>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-700">Cobranças de Assinatura (PIX)</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Renovações automáticas geradas pelos laboratórios.
          </p>
        </div>
        <div className="grid gap-6 p-5 lg:grid-cols-2">
          {tabelaCobrancas(
            "Pendentes",
            cobrancasPendentes,
            "Nenhuma cobrança PIX pendente no momento."
          )}
          {tabelaCobrancas(
            "Pagas",
            cobrancasPagas,
            "Nenhuma cobrança PIX paga registrada ainda."
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-700">Contas Cadastradas</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">Responsável</th>
                <th className="px-4 py-3">Plano</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Usuários</th>
                <th className="px-4 py-3">Trabalhos</th>
                <th className="px-4 py-3">Vencimento</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {empresas.map((empresa) => (
                <tr key={empresa.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                    {empresa.codigo ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">{empresa.nome}</td>
                  <td className="px-4 py-3 text-slate-600">{empresa.responsavel ?? "—"}</td>
                  <td className="px-4 py-3">{badgePlano(empresa.plano)}</td>
                  <td className="px-4 py-3">{badgeStatus(empresa.status)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {empresa.totalUsuarios} / {empresa.limiteUsuarios}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {empresa.totalTrabalhos} / {empresa.limiteTrabalhos}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatarData(empresa.dataVencimento)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1">
                      {(empresa.status === "pendente" || empresa.status === "inativo") && (
                        <>
                          <input
                            type="number"
                            min={1}
                            value={diasAtivacao[empresa.id] ?? 30}
                            onChange={(e) =>
                              setDiasAtivacao((atual) => ({
                                ...atual,
                                [empresa.id]: Number(e.target.value) || 30,
                              }))
                            }
                            className="w-14 rounded border border-slate-200 px-1 py-0.5 text-[10px]"
                            title="Dias de assinatura"
                          />
                          <button
                            type="button"
                            onClick={() => ativarAssinatura(empresa.id)}
                            className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-emerald-700"
                            title="Ativar assinatura"
                          >
                            Ativar
                          </button>
                        </>
                      )}
                      <Link
                        href={`/admin-master/empresas/${empresa.id}`}
                        className="rounded p-1.5 text-[#4a90d9] hover:bg-blue-50"
                        title="Visualizar"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => preencherEdicao(empresa)}
                        className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {empresa.status === "bloqueado" ? (
                        <button
                          type="button"
                          onClick={() => acaoEmpresa(empresa.id, "reativar")}
                          className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50"
                          title="Reativar"
                        >
                          <Unlock className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => acaoEmpresa(empresa.id, "bloquear")}
                          className="rounded p-1.5 text-orange-600 hover:bg-orange-50"
                          title="Bloquear"
                        >
                          <Lock className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => acaoEmpresa(empresa.id, "excluir")}
                        className="rounded p-1.5 text-red-600 hover:bg-red-50"
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {empresas.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    Nenhuma empresa cadastrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
