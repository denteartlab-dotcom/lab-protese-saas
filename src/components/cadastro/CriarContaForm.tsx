"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Building2,
  Check,
  ChevronRight,
  Crown,
  Diamond,
  Eye,
  EyeOff,
  FileText,
  Lock,
  Mail,
  Plane,
  Shield,
  UserPlus,
} from "lucide-react";
import { salvarUltimoLaboratorioLogin } from "@/lib/auth-client";
import type { LabImpressaoConfig } from "@/lib/lab-impressao";
import { dimensoesLogoPx } from "@/lib/lab-logo";
import {
  recursosPlanosAssinatura,
  type PeriodoCobranca,
  type PlanoEmpresa,
} from "@/lib/master-planos";
import { cn } from "@/lib/utils";
import { SeletorPeriodoCobranca } from "@/components/assinatura/SeletorPeriodoCobranca";
import { ESTADOS_BR, listarCidadesPorEstado } from "@/lib/cidades-brasil";
import { NOME_LAB_PADRAO } from "@/lib/document-title";
import {
  formatarCpfCnpj,
  formatarTelefone,
} from "@/lib/validar-documento";
import { validarForcaSenha } from "@/lib/validar-senha";

const ICONES_PLANO = {
  basico: Plane,
  profissional: Crown,
  premium: Diamond,
} as const;

const CORES_PLANO: Record<
  PlanoEmpresa,
  { cor: "emerald" | "blue" | "violet" }
> = {
  basico: { cor: "emerald" },
  profissional: { cor: "blue" },
  premium: { cor: "violet" },
};

type Props = {
  branding: {
    lab: LabImpressaoConfig;
    nomeLaboratorio: string;
    marcaSubtitulo: string;
  };
};

export function CriarContaForm({ branding }: Props) {
  const router = useRouter();
  const [periodo, setPeriodo] = useState<PeriodoCobranca>("mensal");
  const planos = recursosPlanosAssinatura(periodo);
  const [cidades, setCidades] = useState<string[]>([]);
  const [carregandoCidades, setCarregandoCidades] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);

  const [form, setForm] = useState({
    nome: "",
    responsavel: "",
    cnpj: "",
    telefone: "",
    whatsapp: "",
    emailLaboratorio: "",
    cidade: "",
    estado: "SP",
    plano: "profissional" as PlanoEmpresa,
    adminNome: "",
    adminEmail: "",
    adminSenha: "",
    confirmarSenha: "",
    aceiteTermos: false,
  });

  const logo = dimensoesLogoPx(branding.lab, { largura: 40, altura: 40 });
  const forcaSenha = validarForcaSenha(form.adminSenha);

  function atualizar<K extends keyof typeof form>(campo: K, valor: typeof form[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  useEffect(() => {
    let ativo = true;
    setCarregandoCidades(true);
    void listarCidadesPorEstado(form.estado).then((lista) => {
      if (!ativo) return;
      setCidades(lista);
      setForm((atual) => {
        if (atual.cidade && lista.includes(atual.cidade)) return atual;
        return { ...atual, cidade: "" };
      });
      setCarregandoCidades(false);
    });
    return () => {
      ativo = false;
    };
  }, [form.estado]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.aceiteTermos) {
      setError("Aceite os Termos de Uso e a Política de Privacidade.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/empresas/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          periodoCobranca: periodo,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        empresa?: { slug?: string; nome?: string };
      };
      if (!res.ok) {
        setError(data.error || "Não foi possível criar a conta.");
        return;
      }
      const slug = data.empresa?.slug?.trim();
      const nome = data.empresa?.nome?.trim();
      if (slug && nome) {
        salvarUltimoLaboratorioLogin({ slug, nome });
        router.push(`/login?cadastro=ok&lab=${encodeURIComponent(slug)}`);
        return;
      }
      router.push("/login?cadastro=ok");
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/15";

  const labelCls = "mb-1 block text-xs font-medium text-slate-600";

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            {branding.lab.logoDataUrl?.trim() ? (
              <img
                src={branding.lab.logoDataUrl}
                alt=""
                width={logo.largura}
                height={logo.altura}
                className="rounded-lg object-contain"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0066FF] text-lg text-white">
                🦷
              </div>
            )}
            <div>
              <p className="text-sm font-bold text-slate-900">
                {branding.nomeLaboratorio || NOME_LAB_PADRAO}
              </p>
              <p className="text-[11px] text-slate-500">
                {branding.marcaSubtitulo || "Sistema para Laboratórios"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-slate-500 sm:inline">Já tem uma conta?</span>
            <Link
              href="/login"
              className="inline-flex items-center gap-1 rounded-lg border border-[#0066FF] px-4 py-2 text-sm font-semibold text-[#0066FF] transition hover:bg-blue-50"
            >
              Entrar
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-[#0066FF]">
            <UserPlus className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Criar Conta</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
            Cadastre seu laboratório e comece a usar o sistema completo para gestão de próteses.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#0066FF]">
              <Building2 className="h-4 w-4" />
              1. Dados do Laboratório
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 sm:grid sm:grid-cols-2 sm:gap-4">
                <div>
                  <label className={labelCls}>Nome do Laboratório *</label>
                  <input
                    className={inputCls}
                    value={form.nome}
                    onChange={(e) => atualizar("nome", e.target.value)}
                    placeholder="Digite o nome do laboratório"
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Nome do Responsável *</label>
                  <input
                    className={inputCls}
                    value={form.responsavel}
                    onChange={(e) => atualizar("responsavel", e.target.value)}
                    placeholder="Nome completo"
                    required
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>CPF ou CNPJ *</label>
                <input
                  className={inputCls}
                  value={form.cnpj}
                  onChange={(e) => atualizar("cnpj", formatarCpfCnpj(e.target.value))}
                  placeholder="000.000.000-00"
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Telefone *</label>
                <input
                  className={inputCls}
                  value={form.telefone}
                  onChange={(e) => atualizar("telefone", formatarTelefone(e.target.value))}
                  placeholder="(00) 0000-0000"
                  required
                />
              </div>
              <div>
                <label className={labelCls}>WhatsApp</label>
                <input
                  className={inputCls}
                  value={form.whatsapp}
                  onChange={(e) => atualizar("whatsapp", formatarTelefone(e.target.value))}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div>
                <label className={labelCls}>E-mail do Laboratório *</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    className={cn(inputCls, "pl-9")}
                    value={form.emailLaboratorio}
                    onChange={(e) => atualizar("emailLaboratorio", e.target.value)}
                    placeholder="contato@laboratorio.com"
                    required
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Estado *</label>
                <select
                  className={inputCls}
                  value={form.estado}
                  onChange={(e) => atualizar("estado", e.target.value)}
                  required
                >
                  {ESTADOS_BR.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Cidade *</label>
                <select
                  className={inputCls}
                  value={form.cidade}
                  onChange={(e) => atualizar("cidade", e.target.value)}
                  required
                  disabled={carregandoCidades || cidades.length === 0}
                >
                  <option value="">
                    {carregandoCidades
                      ? "Carregando cidades..."
                      : "Selecione a cidade"}
                  </option>
                  {cidades.map((cidade) => (
                    <option key={cidade} value={cidade}>
                      {cidade}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#0066FF]">
              <Lock className="h-4 w-4" />
              2. Dados de Acesso
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Nome do Usuário Administrador *</label>
                <input
                  className={inputCls}
                  value={form.adminNome}
                  onChange={(e) => atualizar("adminNome", e.target.value)}
                  placeholder="Seu nome"
                  required
                />
              </div>
              <div>
                <label className={labelCls}>E-mail de Login *</label>
                <input
                  type="email"
                  className={inputCls}
                  value={form.adminEmail}
                  onChange={(e) => atualizar("adminEmail", e.target.value)}
                  placeholder="seu@email.com"
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Senha *</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={mostrarSenha ? "text" : "password"}
                    className={cn(inputCls, "pl-9 pr-10")}
                    value={form.adminSenha}
                    onChange={(e) => atualizar("adminSenha", e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {form.adminSenha && (
                  <p
                    className={cn(
                      "mt-1 text-[10px]",
                      forcaSenha.valida ? "text-emerald-600" : "text-amber-600"
                    )}
                  >
                    Força: {forcaSenha.forca}
                    {!forcaSenha.valida && ` — ${forcaSenha.erros[0]}`}
                  </p>
                )}
              </div>
              <div>
                <label className={labelCls}>Confirmar Senha *</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={mostrarConfirmar ? "text" : "password"}
                    className={cn(inputCls, "pl-9 pr-10")}
                    value={form.confirmarSenha}
                    onChange={(e) => atualizar("confirmarSenha", e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarConfirmar((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {mostrarConfirmar ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#0066FF]">
              <Crown className="h-4 w-4" />
              3. Escolha seu Plano
            </h2>
            <div className="mb-5 flex flex-col items-center gap-3">
              <SeletorPeriodoCobranca periodo={periodo} onChange={setPeriodo} />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {planos.map((plano) => {
                const selecionado = form.plano === plano.id;
                const { cor } = CORES_PLANO[plano.id];
                const Icone = ICONES_PLANO[plano.id];
                const corBorda =
                  cor === "emerald"
                    ? "border-emerald-500 ring-emerald-100"
                    : cor === "violet"
                      ? "border-violet-500 ring-violet-100"
                      : "border-[#0066FF] ring-blue-100";
                const corIcone =
                  cor === "emerald"
                    ? "text-emerald-500"
                    : cor === "violet"
                      ? "text-violet-500"
                      : "text-[#0066FF]";
                const corCheck =
                  cor === "emerald"
                    ? "text-emerald-500"
                    : cor === "violet"
                      ? "text-violet-500"
                      : "text-[#0066FF]";

                return (
                  <button
                    key={plano.id}
                    type="button"
                    onClick={() => atualizar("plano", plano.id)}
                    className={cn(
                      "relative rounded-2xl border-2 bg-white p-5 text-left shadow-sm transition hover:shadow-md",
                      selecionado ? cn(corBorda, "ring-4") : "border-slate-200"
                    )}
                  >
                    {plano.descontoAnualLabel ? (
                      <span className="absolute right-3 top-3 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                        {plano.descontoAnualLabel}
                      </span>
                    ) : null}
                    <div className="mb-3 flex items-start justify-between">
                      <div
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50",
                          corIcone
                        )}
                      >
                        <Icone className="h-5 w-5" />
                      </div>
                      <span
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-full border-2",
                          selecionado ? corCheck : "border-slate-300",
                          plano.descontoAnualLabel ? "mt-6" : ""
                        )}
                      >
                        {selecionado && <Check className="h-3 w-3" />}
                      </span>
                    </div>
                    <p className="font-semibold text-slate-900">{plano.nome}</p>
                    <div className="mt-1">
                      {plano.precoCheioAnualLabel ? (
                        <p className="text-sm text-slate-400 line-through">
                          {plano.precoCheioAnualLabel}
                        </p>
                      ) : null}
                      <p className="text-lg font-bold text-slate-800">{plano.precoLabel}</p>
                    </div>
                    <ul className="mt-4 space-y-2">
                      {plano.itens.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-2 text-xs text-slate-600"
                        >
                          <Check className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", corCheck)} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#0066FF]">
              <FileText className="h-4 w-4" />
              4. Termos e Condições
            </h2>
            <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={form.aceiteTermos}
                onChange={(e) => atualizar("aceiteTermos", e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-[#0066FF]"
              />
              <span>
                Li e aceito os{" "}
                <a href="#" className="font-medium text-[#0066FF] hover:underline">
                  Termos de Uso
                </a>{" "}
                e a{" "}
                <a href="#" className="font-medium text-[#0066FF] hover:underline">
                  Política de Privacidade
                </a>{" "}
                do sistema.
              </span>
            </label>
          </section>

          {error && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          )}

          <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0066FF] text-white">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Seus dados estão seguros</p>
                <p className="mt-0.5 text-xs text-slate-600">
                  Utilizamos criptografia e seguimos as melhores práticas para proteger suas
                  informações.
                </p>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full shrink-0 rounded-xl bg-[#0066FF] px-8 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-blue-500/25 transition hover:bg-[#0052cc] disabled:opacity-60 sm:mt-0 sm:w-auto"
            >
              {loading ? "Criando..." : "+ Criar minha conta"}
            </button>
          </div>
        </form>

        <p className="mt-10 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} {NOME_LAB_PADRAO} — Sistema para Laboratórios de Próteses
        </p>
      </main>
    </div>
  );
}
