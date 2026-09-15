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
import { extrairNumeroOsCodigo } from "@/lib/codigo-barras-os";
import { SiteSearchBar, SiteSearchButton } from "@/components/header/SiteSearchBar";
import { useI18n } from "@/components/i18n-provider";
import { usePermissoesApp } from "@/components/PermissoesAppProvider";
import type { LabImpressaoConfig } from "@/lib/lab-impressao";
import { dimensoesLogoPx } from "@/lib/lab-logo";
import {
  navGrupoTemAcesso,
  podeVerHref,
} from "@/lib/permissoes-acesso";
import { AppFaixaTopo } from "@/components/AppFaixaTopo";
import { AssinaturaFaixaRodape } from "@/components/AssinaturaFaixaRodape";
import { FaixaVisualizacaoMaster } from "@/components/FaixaVisualizacaoMaster";
import { SuporteChatWidget } from "@/components/SuporteChatWidget";
import { ArmazenamentoCheioModalHost } from "@/components/ArmazenamentoCheioModal";
import { NOME_LAB_PADRAO } from "@/lib/document-title";
import { useLabConfigClient } from "@/lib/use-lab-config-client";
import {
  appNavPrincipal,
  appNavSemDropdown,
  gruposNavMobile,
} from "@/lib/app-nav";
import type { MessageKey } from "@/lib/i18n";
import { ArmazenamentoLaboratorioProvider } from "@/components/ArmazenamentoLaboratorioProvider";
import { useSessaoInatividade } from "@/hooks/use-sessao-inatividade";
import { useTvSessaoKeepAlive } from "@/hooks/use-tv-sessao-keepalive";
import { usePresencaApp } from "@/hooks/usePresencaApp";
import { lerUltimoLaboratorioLogin, salvarLogoLaboratorioLogin } from "@/lib/auth-client";
import { rotuloPapelUsuarioI18n } from "@/lib/i18n/papel-usuario-i18n";
import {
  labelStatusTrabalho,
  metaStatusTrabalho,
} from "@/lib/i18n/status-trabalho-i18n";
import { localeDataIntl } from "@/lib/i18n/tr-ui";
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
  ChevronDown,
  LockKeyhole,
  LogOut,
  Moon,
  Sun,
  ScanBarcode,
  Settings,
  User,
  type LucideIcon,
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

/** Estilo do menu principal — sidebar vertical teal com accordion. */
const CLASSE_NAV_MENU =
  "flex w-full cursor-pointer select-none items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[15px] leading-snug tracking-tight caret-transparent outline-none transition focus:outline-none focus-visible:ring-0";
const CLASSE_NAV_ATIVO =
  "bg-gradient-to-r from-teal-500 to-cyan-500 font-semibold text-white shadow-nav";
const CLASSE_NAV_INATIVO =
  "font-medium text-white/75 hover:bg-white/10 hover:text-white";
const CLASSE_NAV_ICONE = "h-4 w-4 shrink-0";
const CLASSE_NAV_EMOJI = "inline-flex h-5 w-5 shrink-0 items-center justify-center text-[17px] leading-none";
const CLASSE_NAV_CHEVRON =
  "ml-auto h-4 w-4 shrink-0 opacity-60 transition-transform";
const CLASSE_NAV_SUBMENU =
  "mt-1 space-y-0.5 rounded-xl border border-white/10 bg-black/20 p-1.5";
const CLASSE_NAV_SUBMENU_LINK =
  "flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-white/75 caret-transparent outline-none transition hover:bg-white/10 hover:text-white focus:outline-none";
const CLASSE_NAV_SUBMENU_LINK_ATIVO =
  "bg-white/15 font-semibold text-white";

function IconeNav({
  emoji,
  Icon,
  strokeWidth,
  className = CLASSE_NAV_ICONE,
}: {
  emoji?: string;
  Icon: LucideIcon;
  strokeWidth?: number;
  className?: string;
}) {
  if (emoji) {
    return (
      <span className={CLASSE_NAV_EMOJI} aria-hidden>
        {emoji}
      </span>
    );
  }
  return <Icon className={className} strokeWidth={strokeWidth} />;
}

function classeItemNavPrincipal(ativo: boolean) {
  return cn(CLASSE_NAV_MENU, ativo ? CLASSE_NAV_ATIVO : CLASSE_NAV_INATIVO);
}

function classeLinkSubmenu(ativo: boolean) {
  return cn(CLASSE_NAV_SUBMENU_LINK, ativo && CLASSE_NAV_SUBMENU_LINK_ATIVO);
}

export function AppShell({
  userName,
  userRole,
  userEmail,
  isMasterAdmin = false,
  visualizacaoMaster = false,
  suporteExpiraEm = null,
  empresaNomeVisualizacao = null,
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
  visualizacaoMaster?: boolean;
  suporteExpiraEm?: string | null;
  empresaNomeVisualizacao?: string | null;
  dataVencimentoAssinatura?: string | null;
  suporteWhatsapp?: string | null;
  initialLab: LabImpressaoConfig;
  initialNomeLaboratorio?: string;
  children: React.ReactNode;
}) {
  return (
    <ArmazenamentoLaboratorioProvider>
      <AppShellInner
          userName={userName}
          userRole={userRole}
          userEmail={userEmail}
          isMasterAdmin={isMasterAdmin}
          visualizacaoMaster={visualizacaoMaster}
          suporteExpiraEm={suporteExpiraEm}
          empresaNomeVisualizacao={empresaNomeVisualizacao}
          dataVencimentoAssinatura={dataVencimentoAssinatura}
          suporteWhatsapp={suporteWhatsapp}
          initialLab={initialLab}
          initialNomeLaboratorio={initialNomeLaboratorio}
        >
        {children}
      </AppShellInner>
    </ArmazenamentoLaboratorioProvider>
  );
}

function AppShellInner({
  userName,
  userRole,
  userEmail,
  isMasterAdmin = false,
  visualizacaoMaster = false,
  suporteExpiraEm = null,
  empresaNomeVisualizacao = null,
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
  visualizacaoMaster?: boolean;
  suporteExpiraEm?: string | null;
  empresaNomeVisualizacao?: string | null;
  dataVencimentoAssinatura?: string | null;
  suporteWhatsapp?: string | null;
  initialLab: LabImpressaoConfig;
  initialNomeLaboratorio?: string;
  children: React.ReactNode;
}) {
  const { t, locale } = useI18n();
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
  useTvSessaoKeepAlive(isModuloTv);
  const isRelatorioImersivo =
    pathname.startsWith("/app/relatorios/clientes-prejuizo") ||
    pathname.startsWith("/app/relatorios/servicos-nao-concluidos");
  const isModuloImersivo =
    isModuloTv || isRelatorioImersivo;
  const mostrarFaixaAssinatura =
    !isPrint && !isModuloImersivo && Boolean(dataVencimentoAssinatura);
  const isDashboard = ehPaginaInicioApp(pathname);
  const [darkMode, setDarkMode] = useState(false);
  const [menuNavAberto, setMenuNavAberto] = useState<string | null>(null);
  const [menuUsuarioAberto, setMenuUsuarioAberto] = useState(false);
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
  const logoPerfil = dimensoesLogoPx(lab, { largura: 116, altura: 116 });
  const temLogoPerfil = Boolean(lab.logoDataUrl?.startsWith("data:image"));

  useEffect(() => {
    if (!montado || !lab.logoDataUrl?.startsWith("data:image")) return;
    const slug =
      analisarCaminhoApp(pathname).slug ||
      lerUltimoLaboratorioLogin()?.slug ||
      "";
    if (slug) salvarLogoLaboratorioLogin(slug, lab.logoDataUrl);
  }, [montado, lab.logoDataUrl, pathname]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    if (isPrint) {
      html.classList.add("site-zoom-full");
      html.style.zoom = "1";
      html.style.setProperty("--site-zoom", "1");
      body.classList.add("site-editor-tela-cheia");
    } else {
      html.classList.remove("site-zoom-full");
      html.style.zoom = "0.9";
      html.style.setProperty("--site-zoom", "0.9");
      body.classList.remove("site-editor-tela-cheia");
    }
    return () => {
      html.classList.remove("site-zoom-full");
      html.style.zoom = "0.9";
      html.style.setProperty("--site-zoom", "0.9");
      body.classList.remove("site-editor-tela-cheia");
    };
  }, [isPrint]);

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
    setMenuMobileAberto(false);
    setMenuUsuarioAberto(false);
    if (!ehPaginaInicioApp(pathname)) {
      setBuscaOsAberta(false);
      setBuscaPacienteAberta(false);
    }
  }, [pathname]);

  const alternarMenuNav = useCallback((id: string) => {
    setMenuUsuarioAberto(false);
    setMenuNavAberto((atual) => (atual === id ? null : id));
  }, []);

  const alternarMenuUsuario = useCallback(() => {
    setMenuNavAberto(null);
    setMenuUsuarioAberto((atual) => !atual);
  }, []);

  useEffect(() => {
    const grupoAtivo = gruposNavMobile.find((grupo) => grupo.ativo(pathname));
    setMenuNavAberto(grupoAtivo?.id ?? null);
  }, [pathname]);

  function submenuLinkAtivo(href: string) {
    const base = href.split("?")[0] || href;
    if (base === "/app") return ehPaginaInicioApp(pathname);
    const sufixo = base.replace(/^\/app/, "") || "/";
    return menuAppSecaoAtiva(pathname, sufixo);
  }

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

  useSessaoInatividade(() => void logoutPorInatividade(), {
    desabilitado: isModuloTv,
  });

  async function logout() {
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
    if (!numero) {
      setCodigoBarrasMensagem(
        t("shell.buscaOs.codigoNaoReconhecido", { codigo: bruto })
      );
      return;
    }
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
    return date.toLocaleDateString(localeDataIntl(locale));
  }

  function money(value: number) {
    return value.toLocaleString(localeDataIntl(locale), {
      style: "currency",
      currency: locale === "en" ? "USD" : "BRL",
    });
  }

  function statusOs(status: string) {
    const meta = metaStatusTrabalho(status);
    return {
      label: labelStatusTrabalho(t, status) || status,
      color: meta?.color || "bg-slate-100 text-slate-700",
    };
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

  /** Só o valor de desconto (ex.: 5,00). Sem tipo/metadado; vazio se for 0 ou inexistente. */
  function descontoDaLinhaItem(line: string): string {
    const m = line.match(
      /\s-\sdesc\s(?!:)\s*(.+?)(?=\s-\s(?:desc:|situa[cç][aã]o|produtoId|urgente|repeti[cç][aã]o|repeticao|obs|categoria)\b|$)/i
    );
    const bruto = (m?.[1] || "").split(/\s+-\s+/)[0].trim();
    if (!bruto || /^tipo\b/i.test(bruto)) return "";
    const numerico = bruto.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
    const valor = Number(numerico);
    if (!numerico || Number.isNaN(valor) || valor === 0) return "";
    return bruto;
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
      const valor = Number((match?.[5] || "").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".")) || 0;

      return {
        id: `${trabalho.id}-${index}`,
        descricao: descricao.replace(/^Produto:\s*/i, ""),
        prazo: trabalho.dataPrevista,
        qtd: match?.[4]?.trim() || "1",
        dente: match?.[2]?.trim() || trabalho.dentes || "-",
        desconto: descontoDaLinhaItem(line),
        valor,
        // Situação real do serviço (controle de produção), não o texto da linha de item.
        situacao: trabalho.status,
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
            desconto: "",
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
        {faturada ? t("shell.buscaOs.faturadoSim") : t("shell.buscaOs.faturadoNao")}
      </span>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col transition-colors",
        isPrint
          ? "fixed inset-0 z-40 h-[100dvh] w-full max-w-none overflow-hidden bg-[#4a4f56]"
          : isModuloTv
          ? "h-[100vh] w-[100vw] max-w-none overflow-hidden bg-[#070b12]"
          : isRelatorioImersivo
            ? "min-h-[100vh] w-full bg-[#e8f2f3] dark:bg-slate-950"
            : isModuloColaborador
              ? "bg-white dark:bg-slate-950"
              : "bg-[#edf5f6] dark:bg-slate-950"
      )}
    >
      {!isPrint && !isModuloImersivo && (
        <>
        <AppMobileNav
          aberto={menuMobileAberto}
          onFechar={fecharMenuMobile}
          nomeLaboratorio={nomePerfil}
          papelUsuario={papelUsuario}
          logoDataUrl={lab.logoDataUrl?.startsWith("data:image") ? lab.logoDataUrl : undefined}
          logoLargura={logoPerfil.largura}
          logoAltura={logoPerfil.altura}
        />
        <div className="no-print sticky top-0 z-30 shrink-0">
          {visualizacaoMaster && (
            <FaixaVisualizacaoMaster
              empresaNome={empresaNomeVisualizacao || nomeLaboratorio || "empresa"}
              expiraEm={suporteExpiraEm}
            />
          )}
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
                    darkMode ? "text-teal-300" : "text-teal-800"
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
                      ? "text-teal-700 hover:bg-black/5"
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
              </>
            }
          />
        </div>

          <header
            className={cn(
              "hidden lg:fixed lg:left-0 lg:top-[68px] lg:z-20 lg:flex lg:w-[15.25rem] lg:flex-col lg:overflow-hidden lg:border-r lg:border-white/10 lg:bg-[#0b3d3a] lg:shadow-[8px_0_24px_rgba(11,61,58,0.18)] dark:lg:border-slate-800 dark:lg:bg-slate-950",
              mostrarFaixaAssinatura ? "lg:bottom-11" : "lg:bottom-0"
            )}
          >
            <div className="shrink-0 border-b border-white/10 px-2.5 py-3">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={alternarMenuUsuario}
                aria-expanded={menuUsuarioAberto}
                className="flex w-full cursor-pointer select-none items-center gap-3 rounded-xl px-1.5 py-1.5 text-left caret-transparent outline-none transition hover:bg-white/10 focus:outline-none"
              >
                <div
                  className={cn(
                    "relative inline-flex h-[58px] w-[58px] shrink-0 items-center justify-center overflow-hidden rounded-xl",
                    temLogoPerfil ? "bg-white ring-1 ring-white/25 shadow-sm" : "bg-teal-800 text-teal-100"
                  )}
                >
                  {temLogoPerfil ? (
                    <img
                      src={lab.logoDataUrl}
                      alt="Logo do laboratório"
                      className="h-[52px] w-[52px] object-contain"
                      width={logoPerfil.largura}
                      height={logoPerfil.altura}
                      decoding="async"
                      style={{ imageRendering: "auto" }}
                    />
                  ) : (
                    <User className="h-6 w-6" />
                  )}
                  <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#0b3d3a] bg-teal-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    suppressHydrationWarning
                    className="truncate text-[14px] font-bold text-white"
                  >
                    {nomePerfil}
                  </p>
                  <p className="truncate text-[12px] text-teal-100/70">{papelUsuario}</p>
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-white/60 transition-transform",
                    menuUsuarioAberto && "rotate-180"
                  )}
                />
              </button>
              {menuUsuarioAberto ? (
                <div className="mt-1.5 space-y-0.5 rounded-xl border border-white/10 bg-black/20 p-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuUsuarioAberto(false);
                      router.push("/app/alterar-senha");
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
                  >
                    <LockKeyhole className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{t("user.alterarSenha")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuUsuarioAberto(false);
                      void logout();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-white/80 transition hover:bg-red-500/20 hover:text-red-100"
                  >
                    <LogOut className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{t("user.logout")}</span>
                  </button>
                </div>
              ) : null}
            </div>
            <nav className="app-sidebar-scroll flex min-h-0 flex-1 select-none flex-col gap-1 overflow-y-auto overscroll-contain px-2.5 py-3 font-sans antialiased caret-transparent">
            {podeVerMenu("/app") &&
              appNavPrincipal.filter((item) => item.labelKey === "nav.inicio").map((item) => {
              const active = ehPaginaInicioApp(pathname);
              return (
                <Link
                  key={`${item.href}-${item.labelKey}`}
                  href={item.href}
                  className={classeItemNavPrincipal(active)}
                >
                  <IconeNav
                    emoji={item.emoji}
                    Icon={item.icon}
                    strokeWidth={active ? 2.25 : 2}
                  />
                  {t(item.labelKey)}
                </Link>
              );
            })}
            {gruposNavMobile.map((grupo) => {
              if (!navGrupoTemAcesso(acessoTotal, permissoesModulos, grupo.itens)) {
                return null;
              }
              const grupoAtivo = grupo.ativo(pathname);
              const aberto = menuNavAberto === grupo.id;
              return (
                <div key={grupo.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => alternarMenuNav(grupo.id)}
                    aria-expanded={aberto}
                    className={classeItemNavPrincipal(grupoAtivo)}
                  >
                    <IconeNav
                      emoji={grupo.emoji}
                      Icon={grupo.icon}
                      strokeWidth={grupoAtivo ? 2.25 : 2}
                    />
                    <span className="min-w-0 flex-1 truncate text-left">{t(grupo.labelKey)}</span>
                    <ChevronDown
                      className={cn(
                        CLASSE_NAV_CHEVRON,
                        aberto && "rotate-180"
                      )}
                    />
                  </button>
                  {aberto && (
                    <div className={CLASSE_NAV_SUBMENU}>
                      {grupo.itens.filter((item) => podeVerMenu(item.href)).map((item) => (
                        <Link
                          key={`${grupo.id}-${item.href}-${item.labelKey}`}
                          href={item.href}
                          className={classeLinkSubmenu(submenuLinkAtivo(item.href))}
                        >
                          {t(item.labelKey)}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {isMasterAdmin && (
              <Link
                href="/admin-master"
                className={cn(
                  CLASSE_NAV_MENU,
                  pathname.startsWith("/admin-master")
                    ? "bg-violet-600 font-bold text-white shadow-[0_2px_4px_rgba(0,0,0,0.1)]"
                    : CLASSE_NAV_INATIVO
                )}
                title={userEmail ?? "Master"}
              >
                <span className={CLASSE_NAV_EMOJI} aria-hidden>
                  🛡️
                </span>
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
                  className={classeItemNavPrincipal(active)}
                >
                  <IconeNav emoji={item.emoji} Icon={item.icon} strokeWidth={2} />
                  {t(item.labelKey)}
                </Link>
              );
            })}
            </nav>
          </header>
        </>
      )}
      {buscaOsAberta && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 p-4 pt-20">
          <div className="relative w-full max-w-6xl rounded bg-white shadow-2xl">
            <div className="flex h-9 items-center justify-between border-b border-slate-100 px-4">
              <h2 className="text-[11px] font-medium text-slate-700">{t("shell.buscaOs.titulo")}</h2>
              <span className="ml-auto mr-4 text-[11px] font-semibold text-emerald-600">
                {t("nav.os")}: {osSelecionada?.numeroOs || ""}
              </span>
              <button
                type="button"
                onClick={() => {
                  setLeitorCodigoAberto(false);
                  setBuscaOsAberta(false);
                }}
                className="flex h-7 w-7 items-center justify-center rounded text-lg leading-none text-slate-500 hover:bg-slate-100"
                aria-label={t("cadastros.comum.fechar")}
              >
                ×
              </button>
            </div>

            <div className="space-y-3 px-4 py-4 text-[11px] text-slate-600">
              <div className="space-y-1">
                <label className="block text-[10px] text-slate-500">{t("shell.buscaOs.numeroOs")}</label>
                <div className="flex items-center gap-2">
                  <input
                    value={buscaOs}
                    onChange={(e) => {
                      setBuscaOs(e.target.value);
                      setCodigoBarrasMensagem("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void buscarOrdemServico();
                      }
                    }}
                    autoFocus
                    autoComplete="off"
                    placeholder={t("shell.buscaOs.placeholder")}
                    className="h-7 min-w-0 flex-1 rounded border border-slate-300 bg-white px-3 text-[11px] text-slate-700 outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => void buscarOrdemServico()}
                    disabled={buscandoOs}
                    className="inline-flex h-7 shrink-0 items-center justify-center rounded bg-blue-600 px-2.5 text-[10px] font-semibold leading-none text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {buscandoOs ? "..." : t("cadastros.comum.buscar")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeitorCodigoAberto(true)}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-blue-600 text-white shadow-sm transition hover:bg-blue-700"
                    title={t("shell.buscaOs.abrirLeitor")}
                    aria-label={t("shell.buscaOs.abrirLeitor")}
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
                    {t("shell.buscaOs.pesquisarPaciente")}
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
                  {t("shell.buscaOs.nenhumaOs")}
                </div>
              )}

              <div className="overflow-x-auto rounded border border-slate-200">
                <table className="w-full min-w-[900px] text-[10px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-[#f4f3fb] uppercase text-slate-500">
                      <th className="px-3 py-2 text-left">{t("nav.os")}</th>
                      <th className="px-3 py-2 text-left">{t("shell.buscaOs.col.descricao")}</th>
                      <th className="px-3 py-2 text-left">{t("shell.buscaOs.col.prazo")}</th>
                      <th className="px-3 py-2 text-center">{t("shell.buscaOs.col.qtd")}</th>
                      <th className="px-3 py-2 text-right">{t("shell.buscaOs.col.desc")}</th>
                      <th className="px-3 py-2 text-right">{t("shell.buscaOs.col.valor")}</th>
                      <th className="px-3 py-2 text-center">{t("shell.buscaOs.col.situacao")}</th>
                      <th className="px-3 py-2 text-center">{t("shell.buscaOs.col.faturado")}</th>
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
                        <td className="px-3 py-2 text-right"></td>
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
                          {t("shell.buscaOs.instrucaoTabela")}
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
                    {t("shell.buscaOs.materiais")}
                  </div>
                  <div className="min-h-16 bg-blue-50/70 px-4 py-2 text-[10px] text-blue-800">
                    {materiaisOs(osSelecionada).length > 0 ? (
                      <ul className="list-disc pl-4">
                        {materiaisOs(osSelecionada).map((material) => (
                          <li key={material}>{material}</li>
                        ))}
                      </ul>
                    ) : (
                      <span>{t("shell.buscaOs.nenhumMaterial")}</span>
                    )}
                  </div>

                  <div className="grid grid-cols-6 border-b border-slate-100 text-center text-[10px] font-semibold text-slate-500">
                    {(
                      [
                        t("shell.buscaOs.aba.dados"),
                        t("shell.buscaOs.aba.etapas"),
                        t("shell.buscaOs.aba.anotacoes"),
                        t("shell.buscaOs.aba.comissoes"),
                        t("shell.buscaOs.aba.terceirizado"),
                        t("shell.buscaOs.aba.imagens"),
                      ] as const
                    ).map((aba, index) => (
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
                        <input type="checkbox" className="h-3 w-3" /> {t("shell.buscaOs.urgente")}
                      </label>
                      <label className="inline-flex items-center gap-1">
                        <input type="checkbox" className="h-3 w-3" /> {t("shell.buscaOs.repeticao")}
                      </label>
                      </div>
                    </div>
                    <div className={cn("grid gap-3", detalheCompleto ? "md:grid-cols-4" : "md:grid-cols-2")}>
                      <div className="space-y-1">
                        <label className="block text-[10px] text-slate-500">{t("shell.buscaOs.dataLancamento")}</label>
                        <input readOnly value={formatDate(osSelecionada.dataEntrada)} className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-[10px]" />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] text-slate-500">{t("shell.buscaOs.dataEntregaFinalizado")}</label>
                        <input readOnly value={formatDate(osSelecionada.dataPrevista)} className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-[10px]" />
                      </div>
                      {detalheCompleto && (
                        <>
                      <div className="space-y-1">
                        <label className="block text-[10px] text-slate-500">{t("shell.buscaOs.col.situacao")}</label>
                        <select
                          value={osSelecionada.status}
                          onChange={(event) => atualizarSituacaoOs(event.target.value)}
                          className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-[10px] text-slate-700 outline-none focus:border-blue-500"
                        >
                          {Object.keys(STATUS_TRABALHO).map((key) => (
                            <option key={key} value={key}>
                              {labelStatusTrabalho(t, key)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] text-slate-500">{t("relatorio.comum.paciente")}</label>
                        <input readOnly value={osSelecionada.paciente?.nome || "-"} className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-[10px]" />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] text-slate-500">{t("shell.buscaOs.caixaOrganizadora")}</label>
                        <input readOnly value="-" className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-[10px]" />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] text-slate-500">{t("shell.buscaOs.prazoLaboratorio")}</label>
                        <input readOnly value={formatDate(osSelecionada.dataPrevista)} className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-[10px]" />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] text-slate-500">{t("shell.buscaOs.horaLaboratorio")}</label>
                        <input readOnly value="14:00" className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-[10px]" />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] text-slate-500">{t("shell.buscaOs.prazoDentista")}</label>
                        <input readOnly value={formatDate(osSelecionada.dataPrevista)} className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-[10px]" />
                      </div>
                      <div className="space-y-1 md:col-start-4">
                        <label className="block text-[10px] text-slate-500">{t("shell.buscaOs.horaDentista")}</label>
                        <input readOnly value="-" className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-[10px]" />
                      </div>
                        </>
                      )}
                    </div>

                    {detalheCompleto && (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <label className="block text-[10px] text-slate-500">{t("shell.buscaOs.obsInterna")}</label>
                        <textarea readOnly value={osSelecionada.observacoes || ""} className="min-h-20 w-full rounded border border-slate-300 bg-white px-2 py-2 text-[10px]" />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] text-slate-500">{t("shell.buscaOs.obsServico")}</label>
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
                        {t("cadastros.comum.imprimir")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBuscaOsAberta(false);
                          router.push(`/app/producao/controle?q=${osSelecionada.numeroOs}`);
                        }}
                        className="h-8 rounded border border-emerald-200 bg-white px-3 text-[10px] font-semibold text-emerald-600 hover:bg-emerald-50"
                      >
                        {t("shell.buscaOs.controleEntregas")}
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
                          {t("shell.buscaOs.baixarProdutoEstoque")}
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
                        {t("common.gravar")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setBuscaOsAberta(false)}
                        className="h-8 rounded border border-slate-300 bg-white px-4 text-[10px] text-slate-600 hover:bg-slate-50"
                      >
                        {t("cadastros.comum.fechar")}
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
              <h2 className="text-[11px] font-medium text-slate-700">{t("shell.buscaPaciente.titulo")}</h2>
              <button
                type="button"
                onClick={() => setBuscaPacienteAberta(false)}
                className="flex h-7 w-7 items-center justify-center rounded text-lg leading-none text-slate-500 hover:bg-slate-100"
                aria-label={t("cadastros.comum.fechar")}
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
                placeholder={t("shell.buscaPaciente.placeholder")}
                className="h-8 w-full rounded border border-slate-300 px-3 text-[11px] outline-none focus:border-blue-500"
              />
              <div className="space-y-1">
                {buscaPaciente.trim().length < 2 && (
                  <p className="text-center text-[10px] text-slate-400">
                    {t("shell.buscaPaciente.minChars")}
                  </p>
                )}
                {buscaPaciente.trim().length >= 2 && buscandoOs && (
                  <p className="text-center text-[10px] text-slate-400">{t("shell.buscaPaciente.buscando")}</p>
                )}
                {buscaPaciente.trim().length >= 2 && !buscandoOs && resultadosOs.length === 0 && (
                  <p className="text-center text-[10px] text-slate-400">{t("shell.buscaPaciente.nenhumaOs")}</p>
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
          (isModuloTv || isRelatorioImersivo || isPrint) &&
            "h-full min-h-0 w-full max-w-none flex-1 overflow-hidden"
        )}
      >
        <div
          className={cn(
            isPrint || isModuloImersivo
              ? isRelatorioImersivo
                ? "h-full min-h-[100vh] w-full max-w-none overflow-auto p-0 m-0"
                : "h-full min-h-0 w-full max-w-none overflow-hidden p-0 m-0"
              : cn(
                  "min-h-screen px-3 py-2 sm:px-5 lg:pl-[16rem]",
                  isDashboard && "py-2",
                  mostrarFaixaAssinatura && "pb-14"
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
      {!isPrint && !isModuloTv && !isModuloImersivo && <ArmazenamentoCheioModalHost />}
    </div>
  );
}
