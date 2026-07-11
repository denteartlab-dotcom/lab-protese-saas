"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { AppMobileNav, BotaoMenuMobile } from "@/components/AppMobileNav";
import { ConfiguracoesGearMenu } from "@/components/ConfiguracoesGearMenu";
import { LanguageMenu } from "@/components/header/LanguageMenu";
import { NotificationsBell } from "@/components/header/NotificationsBell";
import { LeitorCodigoBarrasModal } from "@/components/LeitorCodigoBarrasModal";
import { InputLeitorCodigoOs } from "@/components/InputLeitorCodigoOs";
import { extrairNumeroOsCodigo } from "@/lib/codigo-barras-os";
import { SiteSearchBar, SiteSearchButton } from "@/components/header/SiteSearchBar";
import { I18nProvider, useI18n } from "@/components/i18n-provider";
import { usePermissoesApp } from "@/components/PermissoesAppProvider";
import type { LabImpressaoConfig } from "@/lib/lab-impressao";
import { dimensoesLogoPx } from "@/lib/lab-logo";
import {
  navGrupoTemAcesso,
  podeVerHref,
  primeiroHrefPermitidoNav,
} from "@/lib/permissoes-acesso";
import { AppFaixaTopo } from "@/components/AppFaixaTopo";
import { AssinaturaFaixaRodape } from "@/components/AssinaturaFaixaRodape";
import { SuporteChatWidget } from "@/components/SuporteChatWidget";
import { NOME_LAB_PADRAO } from "@/lib/document-title";
import { useLabConfigClient } from "@/lib/use-lab-config-client";
import {
  appNavPrincipal,
  appNavSemDropdown,
  cadastrosNav,
  estoqueNav,
  financeiroNav,
  producaoNav,
  relatoriosNav,
} from "@/lib/app-nav";
import type { MessageKey } from "@/lib/i18n";
import { ArmazenamentoLaboratorioProvider } from "@/components/ArmazenamentoLaboratorioProvider";
import { useSessaoInatividade } from "@/hooks/use-sessao-inatividade";
import { usePresencaApp } from "@/hooks/usePresencaApp";
import { lerUltimoLaboratorioLogin, salvarLogoLaboratorioLogin } from "@/lib/auth-client";
import { rotuloPapelUsuarioI18n } from "@/lib/i18n/papel-usuario-i18n";
import { limparUltimaAtividadeSessao } from "@/lib/sessao-inatividade";
import { readStorage, writeStorage } from "@/lib/persisted-storage";
import { persistirTemaLocal, lerTemaLocal } from "@/lib/theme-ui";
import { instrucoesTextoLivre } from "@/lib/etapas-os";
import { cn, STATUS_TRABALHO } from "@/lib/utils";
import {
  analisarCaminhoApp,
  ehPaginaInicioApp,
  menuAppSecaoAtiva,
  restanteCaminhoMenuApp,
} from "@/lib/rotas-app";
import {
  BarChart3,
  CheckSquare,
  ChevronDown,
  ClipboardList,
  Home,
  LockKeyhole,
  LogOut,
  Moon,
  Sun,
  Package,
  ScanBarcode,
  Settings,
  Shield,
  User,
  Users,
  Wallet,
} from "lucide-react";

type TrabalhoBuscaOs = {
  id: string;
  numeroOs: number;
  tipoProtese: string;
  valor: number;
  status: string;
  dentes?: string | null;
  cor?: string | null;
  material?: string | null;
  observacoes?: string | null;
  instrucoes?: string | null;
  dataEntrada?: string | null;
  dataPrevista?: string | null;
  cliente?: { nome?: string | null } | null;
  paciente?: { nome?: string | null } | null;
};

type ItemBuscaOs = {
  id: string;
  descricao: string;
  prazo?: string | null;
  qtd: string;
  dente: string;
  desconto: string;
  valor: number;
  situacao: string;
  tipo: "trabalho" | "frete" | "produto";
};

type LancamentoBuscaOs = {
  status: string;
  descricao: string;
  trabalho?: { numeroOs?: number | null } | null;
};

/** Estilo do menu principal (referência Smart Prótese). */
const CLASSE_NAV_MENU =
  "flex items-center gap-2 rounded px-3 py-2 text-[14px] leading-none transition";
const CLASSE_NAV_ATIVO =
  "bg-[#5c85d6] font-bold text-white shadow-[0_2px_4px_rgba(0,0,0,0.1)]";
const CLASSE_NAV_INATIVO =
  "font-normal text-[#555566] hover:bg-black/[0.04] hover:text-[#444455] dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-slate-100";
const CLASSE_NAV_ICONE = "h-4 w-4 shrink-0";
const CLASSE_NAV_CHEVRON = "ml-0.5 h-3 w-3 shrink-0 opacity-75";
const CLASSE_NAV_DROPDOWN =
  "absolute left-0 top-full z-40 rounded-md border border-slate-200 bg-white py-2 shadow-xl transition dark:border-slate-700 dark:bg-slate-900";
const CLASSE_NAV_DROPDOWN_LINK =
  "flex items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 hover:text-primary-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-primary-400";

function classeItemNavPrincipal(ativo: boolean) {
  return cn(CLASSE_NAV_MENU, ativo ? CLASSE_NAV_ATIVO : CLASSE_NAV_INATIVO);
}

function classeMenuNavDropdown(aberto: boolean) {
  return cn(
    CLASSE_NAV_DROPDOWN,
    aberto
      ? "visible translate-y-0 opacity-100"
      : "invisible pointer-events-none opacity-0"
  );
}

export function AppShell({
  userName,
  userRole,
  userEmail,
  isMasterAdmin = false,
  dataVencimentoAssinatura = null,
  suporteWhatsapp = null,
  initialLab,
  initialNomeLaboratorio,
  children,
}: {
  userName: string;
  userRole: string;
  userEmail?: string;
  isMasterAdmin?: boolean;
  dataVencimentoAssinatura?: string | null;
  suporteWhatsapp?: string | null;
  initialLab: LabImpressaoConfig;
  initialNomeLaboratorio?: string;
  children: React.ReactNode;
}) {
  return (
    <I18nProvider>
      <ArmazenamentoLaboratorioProvider>
        <AppShellInner
          userName={userName}
          userRole={userRole}
          userEmail={userEmail}
          isMasterAdmin={isMasterAdmin}
          dataVencimentoAssinatura={dataVencimentoAssinatura}
          suporteWhatsapp={suporteWhatsapp}
          initialLab={initialLab}
          initialNomeLaboratorio={initialNomeLaboratorio}
        >
          {children}
        </AppShellInner>
      </ArmazenamentoLaboratorioProvider>
    </I18nProvider>
  );
}

function AppShellInner({
  userName,
  userRole,
  userEmail,
  isMasterAdmin = false,
  dataVencimentoAssinatura = null,
  suporteWhatsapp = null,
  initialLab,
  initialNomeLaboratorio,
  children,
}: {
  userName: string;
  userRole: string;
  userEmail?: string;
  isMasterAdmin?: boolean;
  dataVencimentoAssinatura?: string | null;
  suporteWhatsapp?: string | null;
  initialLab: LabImpressaoConfig;
  initialNomeLaboratorio?: string;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const isPrint =
    pathname.includes("/imprimir") ||
    pathname.startsWith("/fatura/") ||
    pathname.startsWith("/app/visualizar-pdf") ||
    pathname.includes("/configuracoes/cabecalho") ||
    pathname.includes("/configuracoes/os/modelo1") ||
    pathname.includes("/configuracoes/os/modelo2") ||
    pathname.includes("/configuracoes/os/modelo3") ||
    pathname.includes("/configuracoes/os/modelo4") ||
    pathname.includes("/configuracoes/os/modelo5") ||
    pathname.includes("/configuracoes/faturas/modelo1") ||
    pathname.includes("/configuracoes/faturas/modelo2") ||
    pathname.includes("/configuracoes/faturas/modelo3") ||
    pathname.includes("/configuracoes/faturas/modelo4") ||
    pathname.includes("/configuracoes/faturas/modelo5");
  const restanteMenuApp = restanteCaminhoMenuApp(pathname);
  const isModuloColaborador = restanteMenuApp === "/producao/modulo";
  const isModuloTv = restanteMenuApp.startsWith("/producao/modulo-tv");
  usePresencaApp(!isPrint && !isModuloTv);
  const isRelatorioImersivo =
    pathname.startsWith("/app/relatorios/clientes-prejuizo") ||
    pathname.startsWith("/app/relatorios/servicos-nao-concluidos");
  const isModuloImersivo =
    isModuloTv || isRelatorioImersivo;
  const mostrarFaixaAssinatura =
    !isPrint && !isModuloImersivo && Boolean(dataVencimentoAssinatura);
  const isDashboard = ehPaginaInicioApp(pathname);
  const [darkMode, setDarkMode] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [menuNavAberto, setMenuNavAberto] = useState<string | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [buscaSiteAberta, setBuscaSiteAberta] = useState(false);
  const [buscaOsAberta, setBuscaOsAberta] = useState(false);
  const [buscaOs, setBuscaOs] = useState("");
  const [buscaPacienteAberta, setBuscaPacienteAberta] = useState(false);
  const [buscaPaciente, setBuscaPaciente] = useState("");
  const [resultadosOs, setResultadosOs] = useState<TrabalhoBuscaOs[]>([]);
  const [osSelecionada, setOsSelecionada] = useState<TrabalhoBuscaOs | null>(null);
  const [itemOsSelecionado, setItemOsSelecionado] = useState<string | null>(null);
  const [lancamentosFinanceirosOs, setLancamentosFinanceirosOs] = useState<LancamentoBuscaOs[]>([]);
  const [buscandoOs, setBuscandoOs] = useState(false);
  const [buscaOsExecutada, setBuscaOsExecutada] = useState(false);
  const [leitorCodigoAberto, setLeitorCodigoAberto] = useState(false);
  const [codigoBarrasMensagem, setCodigoBarrasMensagem] = useState("");
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  const { acessoTotal, permissoesModulos } = usePermissoesApp();
  const { montado, lab, nomeLaboratorio, nomeServidor } = useLabConfigClient({
    initialLab,
    initialNomeLaboratorio,
  });
  const nomePerfil =
    userName.trim() ||
    (nomeLaboratorio.trim() && nomeLaboratorio.trim() !== NOME_LAB_PADRAO
      ? nomeLaboratorio
      : nomeServidor);
  const papelUsuario = rotuloPapelUsuarioI18n(userRole, t);
  const fecharMenuMobile = useCallback(() => setMenuMobileAberto(false), []);
  const alternarMenuMobile = useCallback(
    () => setMenuMobileAberto((atual) => !atual),
    []
  );
  const logoPerfil = dimensoesLogoPx(lab, { largura: 61, altura: 61 });
  const temLogoPerfil = Boolean(lab.logoDataUrl?.startsWith("data:image"));

  useEffect(() => {
    if (!montado || !lab.logoDataUrl?.startsWith("data:image")) return;
    const slug =
      analisarCaminhoApp(pathname).slug ||
      lerUltimoLaboratorioLogin()?.slug ||
      "";
    if (slug) salvarLogoLaboratorioLogin(slug, lab.logoDataUrl);
  }, [montado, lab.logoDataUrl, pathname]);
  function podeVerMenu(href: string) {
    return podeVerHref(acessoTotal, permissoesModulos, href);
  }

  useEffect(() => {
    const savedTheme = readStorage<string | null>("labProteseTheme", null);
    const localTheme = lerTemaLocal();
    const shouldUseDark =
      savedTheme === "dark" || (savedTheme === null && localTheme === true);
    setDarkMode(shouldUseDark);
    persistirTemaLocal(shouldUseDark);
  }, []);

  useEffect(() => {
    setUserMenuOpen(false);
    setMenuNavAberto(null);
    setMenuMobileAberto(false);
    if (!ehPaginaInicioApp(pathname)) {
      setBuscaOsAberta(false);
      setBuscaPacienteAberta(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (!userMenuOpen) return;
    function fecharMenuUsuario(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", fecharMenuUsuario);
    return () => document.removeEventListener("mousedown", fecharMenuUsuario);
  }, [userMenuOpen]);

  const abrirMenuNav = useCallback((id: string) => {
    setUserMenuOpen(false);
    setMenuNavAberto(id);
  }, []);

  const fecharMenusNav = useCallback(() => {
    setMenuNavAberto(null);
  }, []);

  const alternarMenuUsuario = useCallback(() => {
    setMenuNavAberto(null);
    setUserMenuOpen((atual) => !atual);
  }, []);

  useEffect(() => {
    if (!buscaOsAberta) return;

    async function carregarFinanceiro() {
      try {
        const response = await fetch("/api/financeiro?tipo=receita", { cache: "no-store" });
        const data = await response.json();
        setLancamentosFinanceirosOs(Array.isArray(data?.lancamentos) ? data.lancamentos : []);
      } catch {
        setLancamentosFinanceirosOs([]);
      }
    }

    void carregarFinanceiro();
  }, [buscaOsAberta]);

  useEffect(() => {
    if (!buscaPacienteAberta) return;
    const termo = buscaPaciente.trim();
    if (termo.length < 2) {
      setResultadosOs([]);
      return;
    }

    const timeout = window.setTimeout(async () => {
      setBuscandoOs(true);
      try {
        const response = await fetch(`/api/trabalhos?q=${encodeURIComponent(termo)}`, {
          cache: "no-store",
        });
        const data = await response.json();
        setResultadosOs(Array.isArray(data) ? data : []);
      } finally {
        setBuscandoOs(false);
      }
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [buscaPaciente, buscaPacienteAberta]);

  function toggleTheme() {
    setDarkMode((current) => {
      const next = !current;
      persistirTemaLocal(next);
      writeStorage("labProteseTheme", next ? "dark" : "light");
      return next;
    });
  }

  const logoutPorInatividade = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      limparUltimaAtividadeSessao();
      window.location.href = "/login";
    }
  }, []);

  useSessaoInatividade(() => void logoutPorInatividade());

  async function logout() {
    setUserMenuOpen(false);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      limparUltimaAtividadeSessao();
      window.location.href = "/login";
    }
  }

  async function buscarOrdemServico(termoInformado?: string) {
    const bruto = (termoInformado ?? buscaOs).trim();
    if (!bruto) return;
    const numero = extrairNumeroOsCodigo(bruto);
    if (!numero) return;
    setBuscaOs(numero);

    setBuscandoOs(true);
    setBuscaOsExecutada(true);
    try {
      const response = await fetch(`/api/trabalhos?q=${encodeURIComponent(numero)}`, {
        cache: "no-store",
      });
      const data = await response.json();
      const resultados = Array.isArray(data) ? data : [];
      setResultadosOs(resultados);
      setOsSelecionada(resultados.length === 1 ? resultados[0] : null);
      setItemOsSelecionado(null);
      if (resultados.length === 1) {
        setCodigoBarrasMensagem(`OS ${numero} encontrada.`);
      } else if (resultados.length > 1) {
        setCodigoBarrasMensagem(`${resultados.length} resultados para OS ${numero}.`);
      } else {
        setCodigoBarrasMensagem(`Nenhuma OS encontrada para o código ${numero}.`);
      }
    } finally {
      setBuscandoOs(false);
    }
  }

  function aoCodigoBarrasLido(numero: string, bruto?: string) {
    if (!isDashboard) return;
    setBuscaOsAberta(true);
    setBuscaOs(numero);
    setLeitorCodigoAberto(false);
    setCodigoBarrasMensagem(
      bruto?.trim()
        ? `Código lido: ${bruto.trim()} — buscando OS ${numero}...`
        : `Código lido — buscando OS ${numero}...`
    );
    void buscarOrdemServico(numero);
  }

  async function buscarPorPaciente() {
    const termo = buscaPaciente.trim();
    if (!termo) return;

    setBuscandoOs(true);
    setBuscaOsExecutada(true);
    try {
      const response = await fetch(`/api/trabalhos?q=${encodeURIComponent(termo)}`, {
        cache: "no-store",
      });
      const data = await response.json();
      const resultados = Array.isArray(data) ? data : [];
      setResultadosOs(resultados);
      setOsSelecionada(resultados.length > 0 ? resultados[0] : null);
      setItemOsSelecionado(null);
      setBuscaOs(termo);
      setBuscaPacienteAberta(false);
    } finally {
      setBuscandoOs(false);
    }
  }

  function abrirBuscaOs() {
    if (!isDashboard) return;

    setBuscaOsAberta(true);
    setBuscaOs("");
    setResultadosOs([]);
    setOsSelecionada(null);
    setItemOsSelecionado(null);
    setBuscaOsExecutada(false);
    setCodigoBarrasMensagem("");
    setLeitorCodigoAberto(false);
  }

  function abrirOs(trabalho: TrabalhoBuscaOs) {
    setOsSelecionada(trabalho);
    setItemOsSelecionado(null);
  }

  function abrirOsDoPaciente(trabalho: TrabalhoBuscaOs) {
    setBuscaPacienteAberta(false);
    setBuscaOs(String(trabalho.numeroOs));
    setBuscaOsExecutada(true);
    setResultadosOs([trabalho]);
    setOsSelecionada(trabalho);
    setItemOsSelecionado(null);
  }

  function atualizarSituacaoOs(status: string) {
    setOsSelecionada((atual) => (atual ? { ...atual, status } : atual));
    setResultadosOs((atuais) =>
      atuais.map((trabalho) =>
        trabalho.id === osSelecionada?.id ? { ...trabalho, status } : trabalho
      )
    );
  }

  function formatDate(value?: string | null) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("pt-BR");
  }

  function money(value: number) {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function statusOs(status: string) {
    return STATUS_TRABALHO[status] || { label: status, color: "bg-slate-100 text-slate-700" };
  }

  function materiaisOs(trabalho: TrabalhoBuscaOs) {
    return (trabalho.material || trabalho.instrucoes || "")
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 6);
  }

  function tipoItemOs(descricao: string): ItemBuscaOs["tipo"] {
    const lower = descricao.toLowerCase();
    if (lower.startsWith("produto:") || lower.includes("produto")) return "produto";
    if (lower.includes("frete") || lower.includes("entrega") || lower.includes("retirada")) return "frete";
    return "trabalho";
  }

  function itensDaOs(trabalho: TrabalhoBuscaOs): ItemBuscaOs[] {
    const linhas = (trabalho.instrucoes || "")
      .split("\n")
      .filter((line) => line.trim().startsWith("Item adicionado:"));

    const itens = linhas.map((line, index) => {
      const match = line.match(
        /^Item adicionado:\s*(.*?)\s*-\s*dentes\s*(.*?)\s*-\s*cor\s*(.*?)\s*-\s*qtd\s*(.*?)\s*-\s*valor\s*(.*?)(?:\s*-\s*categoria|\s*-\s*desc|\s*-\s*situação|\s*-\s*produtoId|\s*-\s*urgente|\s*-\s*repetição|\s*-\s*repeticao|\s*-\s*obs|$)/i
      );
      const descricao = match?.[1]?.trim() || trabalho.tipoProtese;
      const desconto = line.match(/ - desc (.*?)(?: - situação| - produtoId| - urgente| - repetição| - repeticao| - obs|$)/i)?.[1]?.trim() || "0,00";
      const situacao = line.match(/ - situação (.*?)(?: - produtoId| - urgente| - repetição| - repeticao| - obs|$)/i)?.[1]?.trim() || trabalho.status;
      const valor = Number((match?.[5] || "").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".")) || 0;

      return {
        id: `${trabalho.id}-${index}`,
        descricao: descricao.replace(/^Produto:\s*/i, ""),
        prazo: trabalho.dataPrevista,
        qtd: match?.[4]?.trim() || "1",
        dente: match?.[2]?.trim() || trabalho.dentes || "-",
        desconto,
        valor,
        situacao,
        tipo: tipoItemOs(descricao),
      };
    });

    return itens.length
      ? itens
      : [
          {
            id: `${trabalho.id}-principal`,
            descricao: trabalho.tipoProtese,
            prazo: trabalho.dataPrevista,
            qtd: "1",
            dente: trabalho.dentes || "-",
            desconto: "0,00",
            valor: trabalho.valor || 0,
            situacao: trabalho.status,
            tipo: tipoItemOs(trabalho.tipoProtese),
          },
        ];
  }

  function itemAtivoDaOs(trabalho: TrabalhoBuscaOs) {
    const itens = itensDaOs(trabalho);
    return itens.find((item) => item.id === itemOsSelecionado) || itens[0];
  }

  function osEstaFaturada(trabalho: TrabalhoBuscaOs) {
    return lancamentosFinanceirosOs.some((lancamento) => {
      if (lancamento.status === "cancelado") return false;
      if (!lancamento.descricao.toLowerCase().startsWith("cobrança os")) return false;
      if (lancamento.trabalho?.numeroOs === trabalho.numeroOs) return true;
      return new RegExp(`\\b${trabalho.numeroOs}\\b`).test(lancamento.descricao);
    });
  }

  function faturadoBadge(trabalho: TrabalhoBuscaOs) {
    const faturada = osEstaFaturada(trabalho);
    return (
      <span
        className={cn(
          "inline-flex min-w-12 justify-center rounded px-2 py-1 text-[9px] font-bold",
          faturada
            ? "bg-emerald-100/70 text-emerald-700"
            : "bg-red-100/70 text-red-700"
        )}
      >
        {faturada ? "Sim" : "Não"}
      </span>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col transition-colors",
        isModuloTv
          ? "h-[100vh] w-[100vw] max-w-none overflow-hidden bg-[#070b12]"
          : isRelatorioImersivo
            ? "min-h-[100vh] w-full bg-[#f4f6f8] dark:bg-slate-950"
            : isModuloColaborador
              ? "bg-white dark:bg-slate-950"
              : "bg-[#f4f6f8] dark:bg-slate-950"
      )}
    >
      {!isPrint && !isModuloImersivo && (
        <>
        <AppMobileNav
          aberto={menuMobileAberto}
          onFechar={fecharMenuMobile}
          nomeLaboratorio={nomePerfil}
          logoDataUrl={lab.logoDataUrl?.startsWith("data:image") ? lab.logoDataUrl : undefined}
          logoLargura={logoPerfil.largura}
          logoAltura={logoPerfil.altura}
        />
        <div className="no-print sticky top-0 z-30 shrink-0">
          <AppFaixaTopo
            antes={
              <SiteSearchBar
                aberto={buscaSiteAberta}
                onFechar={() => setBuscaSiteAberta(false)}
              />
            }
            esquerda={
              <>
                <BotaoMenuMobile aberto={menuMobileAberto} onAlternar={alternarMenuMobile} />
                <button
                  type="button"
                  onClick={toggleTheme}
                  className={cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-black/5 dark:hover:bg-white/10",
                    darkMode ? "text-sky-400" : "text-[#3b6ea8]"
                  )}
                  title={darkMode ? t("theme.claro") : t("theme.escuro")}
                  aria-label={darkMode ? t("theme.ativarClaro") : t("theme.ativarEscuro")}
                >
                  {darkMode ? (
                    <Sun className="h-4 w-4" strokeWidth={1.75} />
                  ) : (
                    <Moon className="h-4 w-4" strokeWidth={1.75} />
                  )}
                </button>
                <button
                  type="button"
                  onClick={abrirBuscaOs}
                  disabled={!isDashboard}
                  className={cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-full transition",
                    isDashboard
                      ? "text-emerald-500 hover:bg-black/5"
                      : "cursor-not-allowed text-slate-300"
                  )}
                  title={isDashboard ? t("barcode.titulo") : t("barcode.somenteInicio")}
                  aria-label={isDashboard ? t("barcode.ariaInicio") : t("barcode.ariaForaInicio")}
                >
                  <ScanBarcode className="h-[18px] w-[18px]" strokeWidth={2} />
                </button>
              </>
            }
            direita={
              <>
                <LanguageMenu />
                <SiteSearchButton onAbrir={() => setBuscaSiteAberta(true)} />
                <Suspense
                  fallback={
                    <span className="inline-flex h-7 w-7 items-center justify-center text-slate-400">
                      <Settings className="h-[18px] w-[18px]" />
                    </span>
                  }
                >
                  <ConfiguracoesGearMenu />
                </Suspense>
                <NotificationsBell />
                <div className="relative" ref={userMenuRef}>
                  <button
                    type="button"
                    onClick={alternarMenuUsuario}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-black/5 dark:hover:bg-white/10"
                    aria-expanded={userMenuOpen}
                    aria-label="Abrir menu do usuário"
                  >
                    <div className="hidden leading-tight sm:block">
                      <p
                        suppressHydrationWarning
                        className="text-[13px] font-bold text-slate-800 dark:text-slate-100"
                      >
                        {nomePerfil}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{papelUsuario}</p>
                    </div>
                    <div
                      className={cn(
                        "relative inline-flex h-[57px] w-[57px] shrink-0 items-center justify-center overflow-hidden rounded-full",
                        temLogoPerfil ? "bg-white ring-1 ring-slate-200/80" : "bg-[#dbeafe] text-[#3b6ea8]"
                      )}
                    >
                      {temLogoPerfil ? (
                        <img
                          src={lab.logoDataUrl}
                          alt="Logo do laboratório"
                          className="object-contain"
                          width={logoPerfil.largura}
                          height={logoPerfil.altura}
                        />
                      ) : (
                        <User className="h-6 w-6" />
                      )}
                      <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#f2f4f6] bg-emerald-500" />
                    </div>
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-lg border border-slate-200 bg-white py-2 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                      <div className="border-b border-slate-100 px-4 pb-3 pt-2 dark:border-slate-800">
                        <p
                          suppressHydrationWarning
                          className="text-sm font-bold text-slate-700 dark:text-slate-100"
                        >
                          {nomePerfil}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {papelUsuario}
                        </p>
                      </div>
                      <div className="py-1">
                        <button
                          type="button"
                          onClick={() => {
                            setUserMenuOpen(false);
                            router.push("/app/alterar-senha");
                          }}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-600 transition hover:bg-slate-50 hover:text-primary-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <LockKeyhole className="h-4 w-4 text-slate-500" />
                          <span>{t("user.alterarSenha")}</span>
                        </button>
                      </div>
                      <div className="border-t border-slate-100 pt-1 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={logout}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-600 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-300 dark:hover:bg-red-950/30"
                        >
                          <LogOut className="h-4 w-4" />
                          {t("user.logout")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            }
          />

          <header className="hidden border-b border-[#e8eaed] bg-[#f8f9fa] dark:border-slate-700 dark:bg-slate-900 lg:block">
            <nav
              className="flex min-h-[44px] items-center justify-start gap-8 px-5 font-sans antialiased"
              onMouseLeave={fecharMenusNav}
            >
            {podeVerMenu("/app") &&
              appNavPrincipal.filter((item) => item.labelKey === "nav.inicio").map((item) => {
              const active = ehPaginaInicioApp(pathname);
              return (
                <Link
                  key={`${item.href}-${item.labelKey}`}
                  href={item.href}
                  onMouseEnter={fecharMenusNav}
                  className={classeItemNavPrincipal(active)}
                >
                  <item.icon className={CLASSE_NAV_ICONE} strokeWidth={active ? 2.25 : 2} />
                  {t(item.labelKey)}
                </Link>
              );
            })}
            {navGrupoTemAcesso(acessoTotal, permissoesModulos, producaoNav) && (
            <div
              className="relative"
              onMouseEnter={() => abrirMenuNav("producao")}
            >
              <Link
                href={primeiroHrefPermitidoNav(acessoTotal, permissoesModulos, producaoNav) || "/app/producao"}
                className={classeItemNavPrincipal(
                  menuAppSecaoAtiva(pathname, ["/producao", "/trabalhos"])
                )}
              >
                <ClipboardList
                  className={CLASSE_NAV_ICONE}
                  strokeWidth={menuAppSecaoAtiva(pathname, ["/producao", "/trabalhos"]) ? 2.25 : 2}
                />
                <span>{t("nav.producao")}</span>
                <ChevronDown className={CLASSE_NAV_CHEVRON} />
              </Link>
              <div className={cn(classeMenuNavDropdown(menuNavAberto === "producao"), "w-56")}>
                {producaoNav.filter((item) => podeVerMenu(item.href)).map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={CLASSE_NAV_DROPDOWN_LINK}
                    >
                      <item.icon className="h-3.5 w-3.5" />
                      {t(item.labelKey)}
                    </Link>
                ))}
              </div>
            </div>
            )}
            {navGrupoTemAcesso(acessoTotal, permissoesModulos, financeiroNav) && (
            <div
              className="relative"
              onMouseEnter={() => abrirMenuNav("financeiro")}
            >
              <Link
                href={primeiroHrefPermitidoNav(acessoTotal, permissoesModulos, financeiroNav) || "/app/financeiro"}
                className={classeItemNavPrincipal(menuAppSecaoAtiva(pathname, "/financeiro"))}
              >
                <Wallet
                  className={CLASSE_NAV_ICONE}
                  strokeWidth={menuAppSecaoAtiva(pathname, "/financeiro") ? 2.25 : 2}
                />
                <span>{t("nav.financeiro")}</span>
                <ChevronDown className={CLASSE_NAV_CHEVRON} />
              </Link>
              <div className={cn(classeMenuNavDropdown(menuNavAberto === "financeiro"), "w-56")}>
                {financeiroNav.filter((item) => podeVerMenu(item.href)).map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={CLASSE_NAV_DROPDOWN_LINK}
                    >
                      <item.icon className="h-3.5 w-3.5" />
                      {t(item.labelKey)}
                    </Link>
                ))}
              </div>
            </div>
            )}
            {navGrupoTemAcesso(acessoTotal, permissoesModulos, cadastrosNav) && (
            <div
              className="relative"
              onMouseEnter={() => abrirMenuNav("cadastros")}
            >
              <Link
                href={primeiroHrefPermitidoNav(acessoTotal, permissoesModulos, cadastrosNav) || "/app/clientes"}
                className={classeItemNavPrincipal(
                  menuAppSecaoAtiva(pathname, ["/clientes", "/cadastros"])
                )}
              >
                <Users
                  className={CLASSE_NAV_ICONE}
                  strokeWidth={menuAppSecaoAtiva(pathname, ["/clientes", "/cadastros"]) ? 2.25 : 2}
                />
                <span>{t("nav.cadastros")}</span>
                <ChevronDown className={CLASSE_NAV_CHEVRON} />
              </Link>
              <div className={cn(classeMenuNavDropdown(menuNavAberto === "cadastros"), "w-64")}>
                {cadastrosNav.filter((item) => podeVerMenu(item.href)).map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(CLASSE_NAV_DROPDOWN_LINK, "gap-1.5 rounded-md")}
                    >
                      <item.icon className="h-3.5 w-3.5" />
                      {t(item.labelKey)}
                    </Link>
                ))}
              </div>
            </div>
            )}
            {navGrupoTemAcesso(acessoTotal, permissoesModulos, estoqueNav) && (
            <div
              className="relative"
              onMouseEnter={() => abrirMenuNav("estoque")}
            >
              <Link
                href={primeiroHrefPermitidoNav(acessoTotal, permissoesModulos, estoqueNav) || "/app/produtos"}
                className={classeItemNavPrincipal(
                  menuAppSecaoAtiva(pathname, ["/produtos", "/orcamentos"])
                )}
              >
                <Package
                  className={CLASSE_NAV_ICONE}
                  strokeWidth={menuAppSecaoAtiva(pathname, ["/produtos", "/orcamentos"]) ? 2.25 : 2}
                />
                <span>{t("nav.estoque")}</span>
                <ChevronDown className={CLASSE_NAV_CHEVRON} />
              </Link>
              <div className={cn(classeMenuNavDropdown(menuNavAberto === "estoque"), "w-48")}>
                {estoqueNav.filter((item) => podeVerMenu(item.href)).map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={CLASSE_NAV_DROPDOWN_LINK}
                    >
                      <item.icon className="h-3.5 w-3.5" />
                      {t(item.labelKey)}
                    </Link>
                ))}
              </div>
            </div>
            )}
            {navGrupoTemAcesso(acessoTotal, permissoesModulos, relatoriosNav as typeof producaoNav) && (
            <div
              className="relative"
              onMouseEnter={() => abrirMenuNav("relatorios")}
            >
              <Link
                href={
                  primeiroHrefPermitidoNav(
                    acessoTotal,
                    permissoesModulos,
                    relatoriosNav as typeof producaoNav
                  ) || "/app/relatorios/fluxo-de-caixa"
                }
                className={classeItemNavPrincipal(menuAppSecaoAtiva(pathname, "/relatorios"))}
              >
                <BarChart3
                  className={CLASSE_NAV_ICONE}
                  strokeWidth={menuAppSecaoAtiva(pathname, "/relatorios") ? 2.25 : 2}
                />
                <span>{t("nav.relatorios")}</span>
                <ChevronDown className={CLASSE_NAV_CHEVRON} />
              </Link>
              <div className={cn(classeMenuNavDropdown(menuNavAberto === "relatorios"), "w-56")}>
                {relatoriosNav.filter((item) => podeVerMenu(item.href)).map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={CLASSE_NAV_DROPDOWN_LINK}
                    >
                      <item.icon className="h-3.5 w-3.5" />
                      {t(item.labelKey)}
                    </Link>
                ))}
              </div>
            </div>
            )}
            {isMasterAdmin && (
              <Link
                href="/admin-master"
                onMouseEnter={fecharMenusNav}
                className={cn(
                  CLASSE_NAV_MENU,
                  pathname.startsWith("/admin-master")
                    ? "bg-violet-600 font-bold text-white shadow-[0_2px_4px_rgba(0,0,0,0.1)]"
                    : CLASSE_NAV_INATIVO
                )}
                title={userEmail ?? "Master"}
              >
                <Shield className={CLASSE_NAV_ICONE} strokeWidth={2} />
                Gerenciar Sistema
              </Link>
            )}
            {appNavPrincipal
              .filter((item) => !appNavSemDropdown.has(item.labelKey))
              .map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/app" && pathname.startsWith(item.href));
              return (
                <Link
                  key={`${item.href}-${item.labelKey}`}
                  href={item.href}
                  onMouseEnter={fecharMenusNav}
                  className={classeItemNavPrincipal(active)}
                >
                  <item.icon className={CLASSE_NAV_ICONE} strokeWidth={2} />
                  {t(item.labelKey)}
                </Link>
              );
            })}
            </nav>
          </header>
        </div>
        </>
      )}
      {buscaOsAberta && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 p-4 pt-20">
          <div className="relative w-full max-w-6xl rounded bg-white shadow-2xl">
            <div className="flex h-9 items-center justify-between border-b border-slate-100 px-4">
              <h2 className="text-[11px] font-medium text-slate-700">Busca Rápida de Ordem de Serviço</h2>
              <span className="ml-auto mr-4 text-[11px] font-semibold text-emerald-600">
                OS: {osSelecionada?.numeroOs || ""}
              </span>
              <button
                type="button"
                onClick={() => {
                  setLeitorCodigoAberto(false);
                  setBuscaOsAberta(false);
                }}
                className="flex h-7 w-7 items-center justify-center rounded text-lg leading-none text-slate-500 hover:bg-slate-100"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 px-4 py-4 text-[11px] text-slate-600">
              <div className="space-y-1">
                <label className="block text-[10px] text-slate-500">Número da OS</label>
                <div className="flex items-center gap-2">
                  <InputLeitorCodigoOs
                    value={buscaOs}
                    onChange={setBuscaOs}
                    onCodigoLido={(numero, bruto) => aoCodigoBarrasLido(numero, bruto)}
                    onCodigoInvalido={(bruto) =>
                      setCodigoBarrasMensagem(`Código não reconhecido: ${bruto}`)
                    }
                    capturaGlobal
                    capturaGlobalAtivo={buscaOsAberta && !leitorCodigoAberto}
                    autoFocus
                    readOnly={leitorCodigoAberto}
                    mostrarStatusLeitor
                    placeholder="Busque número pela OS ou passe o leitor de código de barras"
                    className="h-7 min-w-0 flex-1 rounded border border-slate-300 px-3 text-[11px] outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => void buscarOrdemServico()}
                    disabled={buscandoOs}
                    className="inline-flex h-7 shrink-0 items-center justify-center rounded bg-blue-600 px-2.5 text-[10px] font-semibold leading-none text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {buscandoOs ? "..." : "Buscar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeitorCodigoAberto(true)}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-blue-600 text-white shadow-sm transition hover:bg-blue-700"
                    title="Abrir leitor de código de barras"
                    aria-label="Abrir leitor de código de barras"
                  >
                    <ScanBarcode className="h-4 w-4" strokeWidth={2.4} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBuscaPaciente("");
                      setBuscaPacienteAberta(true);
                    }}
                    className="inline-flex h-7 shrink-0 items-center justify-center rounded border border-slate-300 bg-white px-2.5 text-[10px] font-semibold leading-none text-slate-600 hover:bg-slate-50"
                  >
                    Pesquisar Paciente
                  </button>
                </div>
              </div>

              {codigoBarrasMensagem ? (
                <div className="rounded bg-blue-50 px-3 py-2 text-[10px] font-medium text-blue-700">
                  {codigoBarrasMensagem}
                </div>
              ) : null}

              {buscaOsExecutada && resultadosOs.length === 0 && (
                <div className="rounded bg-orange-50 px-3 py-2 text-[10px] text-orange-600">
                  Nenhuma ordem de serviço encontrada.
                </div>
              )}

              <div className="overflow-x-auto rounded border border-slate-200">
                <table className="w-full min-w-[900px] text-[10px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-[#f4f3fb] uppercase text-slate-500">
                      <th className="px-3 py-2 text-left">OS</th>
                      <th className="px-3 py-2 text-left">Descrição</th>
                      <th className="px-3 py-2 text-left">Prazo</th>
                      <th className="px-3 py-2 text-center">Qtd</th>
                      <th className="px-3 py-2 text-right">Desc</th>
                      <th className="px-3 py-2 text-right">Valor</th>
                      <th className="px-3 py-2 text-center">Situação</th>
                      <th className="px-3 py-2 text-center">Faturado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {osSelecionada
                      ? itensDaOs(osSelecionada).map((item) => {
                        const ativo = (itemOsSelecionado || itensDaOs(osSelecionada)[0]?.id) === item.id;
                        return (
                        <tr
                          key={item.id}
                          onClick={() => setItemOsSelecionado(item.id)}
                          className={cn(
                            "cursor-pointer border-b border-slate-100 hover:bg-orange-50",
                            ativo && "bg-orange-100/70"
                          )}
                        >
                          <td className="px-3 py-2 text-center text-slate-500">{ativo ? "✓" : ""}</td>
                          <td className="px-3 py-2">{item.descricao}</td>
                          <td className="px-3 py-2">{formatDate(item.prazo)}</td>
                          <td className="px-3 py-2 text-center">{item.qtd}</td>
                          <td className="px-3 py-2 text-right">{item.desconto}</td>
                          <td className="px-3 py-2 text-right">{money(item.valor || 0)}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={cn("rounded px-2 py-1 text-[9px] font-semibold", statusOs(item.situacao).color)}>
                              {statusOs(item.situacao).label}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {faturadoBadge(osSelecionada)}
                          </td>
                        </tr>
                      );
                    })
                      : resultadosOs.map((trabalho) => (
                      <tr
                        key={trabalho.id}
                        onClick={() => abrirOs(trabalho)}
                        className="cursor-pointer border-b border-slate-100 hover:bg-blue-50"
                      >
                        <td className="px-3 py-2 font-semibold text-blue-700">{trabalho.numeroOs}</td>
                        <td className="px-3 py-2">{trabalho.tipoProtese}</td>
                        <td className="px-3 py-2">{formatDate(trabalho.dataPrevista)}</td>
                        <td className="px-3 py-2 text-center">1</td>
                        <td className="px-3 py-2 text-right">0,00</td>
                        <td className="px-3 py-2 text-right">{money(trabalho.valor || 0)}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={cn("rounded px-2 py-1 text-[9px] font-semibold", statusOs(trabalho.status).color)}>
                            {statusOs(trabalho.status).label}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {faturadoBadge(trabalho)}
                        </td>
                      </tr>
                    ))}
                    {resultadosOs.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-3 py-5 text-center text-slate-400">
                          Busque pelo número da OS ou passe o leitor de código de barras.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {osSelecionada && (() => {
                const itemAtivo = itemAtivoDaOs(osSelecionada);
                const detalheCompleto = itemAtivo?.tipo === "trabalho";
                return (
                <div className="overflow-hidden rounded border border-slate-200 bg-white">
                  <div className="bg-blue-50 px-3 py-2 text-[10px] font-semibold uppercase text-blue-700">
                    Materiais
                  </div>
                  <div className="min-h-16 bg-blue-50/70 px-4 py-2 text-[10px] text-blue-800">
                    {materiaisOs(osSelecionada).length > 0 ? (
                      <ul className="list-disc pl-4">
                        {materiaisOs(osSelecionada).map((material) => (
                          <li key={material}>{material}</li>
                        ))}
                      </ul>
                    ) : (
                      <span>Nenhum material informado.</span>
                    )}
                  </div>

                  <div className="grid grid-cols-6 border-b border-slate-100 text-center text-[10px] font-semibold text-slate-500">
                    {["DADOS", "ETAPAS", "ANOTAÇÕES", "COMISSÕES", "TERCEIRIZADO", "IMAGENS"].map((aba, index) => (
                      <button
                        key={aba}
                        type="button"
                        className={cn(
                          "h-9 border-r border-slate-100 text-[10px] font-medium tracking-wide last:border-r-0",
                          index === 0 ? "bg-blue-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"
                        )}
                      >
                        {aba}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-4 px-3 py-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold text-emerald-600">{itemAtivo?.descricao || osSelecionada.tipoProtese}</p>
                      <div className="flex gap-4 text-[10px] text-slate-500">
                      <label className="inline-flex items-center gap-1">
                        <input type="checkbox" className="h-3 w-3" /> Urgente
                      </label>
                      <label className="inline-flex items-center gap-1">
                        <input type="checkbox" className="h-3 w-3" /> Repetição
                      </label>
                      </div>
                    </div>
                    <div className={cn("grid gap-3", detalheCompleto ? "md:grid-cols-4" : "md:grid-cols-2")}>
                      <div className="space-y-1">
                        <label className="block text-[10px] text-slate-500">Data Lançamento</label>
                        <input readOnly value={formatDate(osSelecionada.dataEntrada)} className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-[10px]" />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] text-slate-500">Data Entrega p/Finalizado</label>
                        <input readOnly value={formatDate(osSelecionada.dataPrevista)} className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-[10px]" />
                      </div>
                      {detalheCompleto && (
                        <>
                      <div className="space-y-1">
                        <label className="block text-[10px] text-slate-500">Situação</label>
                        <select
                          value={osSelecionada.status}
                          onChange={(event) => atualizarSituacaoOs(event.target.value)}
                          className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-[10px] text-slate-700 outline-none focus:border-blue-500"
                        >
                          {Object.entries(STATUS_TRABALHO).map(([key, value]) => (
                            <option key={key} value={key}>
                              {value.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] text-slate-500">Paciente</label>
                        <input readOnly value={osSelecionada.paciente?.nome || "-"} className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-[10px]" />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] text-slate-500">Caixa Organizadora</label>
                        <input readOnly value="-" className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-[10px]" />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] text-slate-500">Prazo Laboratório</label>
                        <input readOnly value={formatDate(osSelecionada.dataPrevista)} className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-[10px]" />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] text-slate-500">Hora Laboratório</label>
                        <input readOnly value="14:00" className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-[10px]" />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] text-slate-500">Prazo Dentista</label>
                        <input readOnly value={formatDate(osSelecionada.dataPrevista)} className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-[10px]" />
                      </div>
                      <div className="space-y-1 md:col-start-4">
                        <label className="block text-[10px] text-slate-500">Hora Dentista</label>
                        <input readOnly value="-" className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-[10px]" />
                      </div>
                        </>
                      )}
                    </div>

                    {detalheCompleto && (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <label className="block text-[10px] text-slate-500">Observação Interna</label>
                        <textarea readOnly value={osSelecionada.observacoes || ""} className="min-h-20 w-full rounded border border-slate-300 bg-white px-2 py-2 text-[10px]" />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] text-slate-500">Observação Serviço</label>
                        <textarea
                          readOnly
                          value={instrucoesTextoLivre(osSelecionada.instrucoes)}
                          className="min-h-20 w-full rounded border border-slate-300 bg-white px-2 py-2 text-[10px]"
                        />
                      </div>
                    </div>
                    )}

                    <div className="grid gap-3 md:grid-cols-[0.18fr_0.22fr_1fr_1fr]">
                      <button
                        type="button"
                        onClick={() =>
                          window.open(
                            `/app/trabalhos/${osSelecionada.id}/imprimir`,
                            "_blank",
                            "noopener,noreferrer"
                          )
                        }
                        className="h-8 rounded border border-emerald-200 bg-white px-3 text-[10px] font-semibold text-emerald-600 hover:bg-emerald-50"
                      >
                        Imprimir
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBuscaOsAberta(false);
                          router.push(`/app/producao/controle?q=${osSelecionada.numeroOs}`);
                        }}
                        className="h-8 rounded border border-emerald-200 bg-white px-3 text-[10px] font-semibold text-emerald-600 hover:bg-emerald-50"
                      >
                        Controle de Entregas
                      </button>
                      {itemAtivo?.tipo === "produto" && (
                        <button
                          type="button"
                          onClick={() => {
                            setBuscaOsAberta(false);
                            router.push(`/app/producao/os?edit=${osSelecionada.id}`);
                          }}
                          className="h-8 rounded border border-emerald-200 bg-white px-3 text-[10px] font-semibold text-emerald-600 hover:bg-emerald-50"
                        >
                          Baixar Produto no Estoque
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setBuscaOsAberta(false);
                          router.push(`/app/producao/os?edit=${osSelecionada.id}`);
                        }}
                        className="h-8 rounded bg-blue-600 px-4 text-[10px] font-semibold text-white hover:bg-blue-700"
                      >
                        Gravar
                      </button>
                      <button
                        type="button"
                        onClick={() => setBuscaOsAberta(false)}
                        className="h-8 rounded border border-slate-300 bg-white px-4 text-[10px] text-slate-600 hover:bg-slate-50"
                      >
                        Fechar
                      </button>
                    </div>
                  </div>
                </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
      {buscaPacienteAberta && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/20 p-4 pt-24">
          <div className="relative w-full max-w-md rounded bg-white shadow-2xl">
            <div className="flex h-9 items-center justify-between border-b border-slate-100 px-4">
              <h2 className="text-[11px] font-medium text-slate-700">Buscar por Paciente</h2>
              <button
                type="button"
                onClick={() => setBuscaPacienteAberta(false)}
                className="flex h-7 w-7 items-center justify-center rounded text-lg leading-none text-slate-500 hover:bg-slate-100"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            <div className="space-y-3 px-4 py-4 text-[11px] text-slate-600">
              <input
                value={buscaPaciente}
                onChange={(event) => setBuscaPaciente(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void buscarPorPaciente();
                  }
                }}
                autoFocus
                placeholder="Digite o nome do paciente"
                className="h-8 w-full rounded border border-slate-300 px-3 text-[11px] outline-none focus:border-blue-500"
              />
              <div className="space-y-1">
                {buscaPaciente.trim().length < 2 && (
                  <p className="text-center text-[10px] text-slate-400">
                    Digite ao menos 2 caracteres para buscar
                  </p>
                )}
                {buscaPaciente.trim().length >= 2 && buscandoOs && (
                  <p className="text-center text-[10px] text-slate-400">Buscando paciente...</p>
                )}
                {buscaPaciente.trim().length >= 2 && !buscandoOs && resultadosOs.length === 0 && (
                  <p className="text-center text-[10px] text-slate-400">Nenhuma OS encontrada.</p>
                )}
                {resultadosOs.map((trabalho) => (
                  <button
                    type="button"
                    key={trabalho.id}
                    onClick={() => abrirOsDoPaciente(trabalho)}
                    className="flex w-full items-center justify-between rounded border border-slate-200 bg-white px-3 py-2 text-left text-[11px] hover:bg-blue-50"
                  >
                    <span>{trabalho.paciente?.nome || trabalho.cliente?.nome || "-"}</span>
                    <span className="rounded bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-600">
                      OS {trabalho.numeroOs}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <LeitorCodigoBarrasModal
        open={leitorCodigoAberto}
        onClose={() => setLeitorCodigoAberto(false)}
        onCodigoLido={aoCodigoBarrasLido}
      />

      <main
        className={cn(
          (isModuloTv || isRelatorioImersivo) &&
            "h-full min-h-0 w-full max-w-none flex-1 overflow-auto"
        )}
      >
        <div
          className={cn(
            isPrint || isModuloImersivo
              ? isRelatorioImersivo
                ? "h-full min-h-[100vh] w-full max-w-none overflow-auto p-0 m-0"
                : "h-[100vh] w-[100vw] max-w-none min-h-0 overflow-hidden p-0 m-0"
              : cn(
                  "min-h-screen px-3 py-4 sm:px-5",
                  mostrarFaixaAssinatura && "pb-16"
                )
          )}
        >
          {children}
        </div>
      </main>
      {mostrarFaixaAssinatura && (
        <AssinaturaFaixaRodape
          dataVencimento={dataVencimentoAssinatura}
          whatsappSuporte={suporteWhatsapp}
        />
      )}
      {!isPrint && !isModuloTv && !isModuloImersivo && <SuporteChatWidget />}
    </div>
  );
}
