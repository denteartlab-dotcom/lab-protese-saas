"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  Calendar,
  Check,
  DollarSign,
  Eye,
  EyeOff,
  LockKeyhole,
  LogOut,
  Moon,
  Sun,
  RefreshCw,
  ScanBarcode,
  Settings,
  User,
  X,
} from "lucide-react";
import { ConfiguracoesGearMenu } from "@/components/ConfiguracoesGearMenu";
import { LanguageMenu } from "@/components/header/LanguageMenu";
import { NotificationsBell } from "@/components/header/NotificationsBell";
import { SiteSearchBar, SiteSearchButton } from "@/components/header/SiteSearchBar";
import { useI18n } from "@/components/i18n-provider";
import { LeitorCodigoBarrasModal } from "@/components/LeitorCodigoBarrasModal";
import type { MessageKey } from "@/lib/i18n";
import { AppFaixaTopo } from "@/components/AppFaixaTopo";
import { dimensoesLogoPx } from "@/lib/lab-logo";
import type { EtapaOsLinha } from "@/lib/etapas-os";
import {
  complementosDaOs,
  formatDateModulo,
  itensDaOsModulo,
  itensDoGrupoOs,
  statusModuloOs,
  valorLinhaInstrucao,
  type ItemModuloOs,
  type TrabalhoModuloOs,
} from "@/lib/modulo-producao-os";
import { cn } from "@/lib/utils";
import {
  etapasConcluidasModulo,
  salvarEtapasConcluidasModulo,
} from "@/lib/modulo-producao-etapas";
import { readStorage, writeStorage } from "@/lib/persisted-storage";
import { useLabConfigClient } from "@/lib/use-lab-config-client";

type AbaModulo = "etapas" | "anotacoes" | "imagens" | "detalhes";

const abas: { id: AbaModulo; label: string }[] = [
  { id: "etapas", label: "ETAPAS" },
  { id: "anotacoes", label: "ANOTAÇÕES" },
  { id: "imagens", label: "IMAGENS" },
  { id: "detalhes", label: "DETALHES SERVIÇO" },
];

type Props = {
  userName: string;
  userRole: string;
};

export function ModuloProducaoColaborador({ userName, userRole }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const { montado, lab, nomeLaboratorio } = useLabConfigClient();
  const [buscaSiteAberta, setBuscaSiteAberta] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [buscaOs, setBuscaOs] = useState("");
  const [buscandoOs, setBuscandoOs] = useState(false);
  const [resultadosOs, setResultadosOs] = useState<TrabalhoModuloOs[]>([]);
  const [osSelecionada, setOsSelecionada] = useState<TrabalhoModuloOs | null>(null);
  const [itemSelecionado, setItemSelecionado] = useState<string | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<AbaModulo>("etapas");
  const [leitorAberto, setLeitorAberto] = useState(false);
  const [buscaPacienteAberta, setBuscaPacienteAberta] = useState(false);
  const [buscaPaciente, setBuscaPaciente] = useState("");
  const [grupoOs, setGrupoOs] = useState<TrabalhoModuloOs[]>([]);
  const [etapasOs, setEtapasOs] = useState<EtapaOsLinha[]>([]);
  const [etapasOk, setEtapasOk] = useState<Set<number>>(new Set());
  const [anotacoes, setAnotacoes] = useState("");
  const [salvandoAnotacao, setSalvandoAnotacao] = useState(false);
  const [comissaoVisivel, setComissaoVisivel] = useState(false);

  const logoPerfil = dimensoesLogoPx(lab, { largura: 36, altura: 36 });
  const temLogo = montado && Boolean(lab.logoDataUrl?.startsWith("data:image"));
  const temLogoPerfil = temLogo;
  async function logout() {
    setUserMenuOpen(false);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } finally {
      window.location.href = "/login";
    }
  }

  const itens = osSelecionada
    ? grupoOs.length > 0
      ? itensDoGrupoOs(grupoOs)
      : itensDaOsModulo(osSelecionada)
    : [];
  const itemAtivo =
    itens.find((item) => item.id === itemSelecionado) || (itens.length === 1 ? itens[0] : null);
  const servicoSelecionado = Boolean(osSelecionada && itemAtivo);

  const buscarOrdemServico = useCallback(
    async (termoInformado?: string) => {
      const bruto = (termoInformado ?? buscaOs).trim();
      if (!bruto) return;
      const numeroLido = bruto.replace(/\D/g, "");
      const query = numeroLido || bruto;
      setBuscaOs(query);
      setBuscandoOs(true);
      try {
        const response = await fetch(`/api/trabalhos?q=${encodeURIComponent(query)}`, {
          cache: "no-store",
        });
        const data = await response.json();
        const resultados = Array.isArray(data) ? (data as TrabalhoModuloOs[]) : [];
        setResultadosOs(resultados);
        if (resultados.length === 1) {
          await selecionarOs(resultados[0]);
        } else {
          setOsSelecionada(null);
          setGrupoOs([]);
          setItemSelecionado(null);
        }
      } finally {
        setBuscandoOs(false);
      }
    },
    [buscaOs]
  );

  const chaveEtapasConcluidas =
    osSelecionada && itemAtivo ? `${osSelecionada.id}:${itemAtivo.id}` : "";

  const instrucoesGrupo = grupoOs.map((t) => t.instrucoes || "").join("\n");

  useEffect(() => {
    if (!osSelecionada) {
      setEtapasOs([]);
      setEtapasOk(new Set());
      return;
    }
    const comp = complementosDaOs(grupoOs.length ? grupoOs : [osSelecionada]);
    setEtapasOs(comp.etapas);
  }, [osSelecionada, grupoOs]);

  useEffect(() => {
    if (!chaveEtapasConcluidas) {
      setEtapasOk(new Set());
      return;
    }
    setEtapasOk(etapasConcluidasModulo(chaveEtapasConcluidas));
    setAnotacoes(osSelecionada?.observacoes || "");
  }, [chaveEtapasConcluidas, osSelecionada?.observacoes]);

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

  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    setDarkMode(readStorage<string | null>("labProteseTheme", null) === "dark");
  }, []);

  function toggleTheme() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    writeStorage("labProteseTheme", next ? "dark" : "light");
    setDarkMode(next);
  }

  async function carregarGrupoOs(trabalho: TrabalhoModuloOs) {
    try {
      const res = await fetch(`/api/trabalhos/${trabalho.id}`, { cache: "no-store" });
      if (!res.ok) {
        setGrupoOs([trabalho]);
        return trabalho;
      }
      const data = (await res.json()) as TrabalhoModuloOs & { grupo?: TrabalhoModuloOs[] };
      const grupo = Array.isArray(data.grupo) && data.grupo.length > 0 ? data.grupo : [data];
      setGrupoOs(grupo);
      const principal = grupo.find((t) => t.id === trabalho.id) || grupo[0] || trabalho;
      return { ...principal, ...data };
    } catch {
      setGrupoOs([trabalho]);
      return trabalho;
    }
  }

  async function selecionarOs(trabalho: TrabalhoModuloOs) {
    const detalhe = await carregarGrupoOs(trabalho);
    setOsSelecionada(detalhe);
    const lista = itensDaOsModulo(detalhe);
    setItemSelecionado(lista[0]?.id ?? null);
    setBuscaOs(String(detalhe.numeroOs));
  }

  function selecionarItem(item: ItemModuloOs) {
    setItemSelecionado(item.id);
  }

  function alternarEtapa(indice: number) {
    if (!chaveEtapasConcluidas || !osSelecionada) return;
    const etapa = etapasOs.find((e) => e.indice === indice);
    const concluidaAntes = etapasOk.has(indice);
    const next = new Set(etapasOk);
    if (next.has(indice)) next.delete(indice);
    else next.add(indice);
    setEtapasOk(next);
    salvarEtapasConcluidasModulo(chaveEtapasConcluidas, next);

    void fetch("/api/relatorios/logs-auditoria", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoria: "etapas",
        tipoAlteracao: "alteracao",
        numeroOs: osSelecionada.numeroOs,
        trabalhoId: osSelecionada.id,
        servico: itemAtivo?.descricao || osSelecionada.tipoProtese,
        etapa: etapa?.nome,
        colaborador: etapa?.responsavel || undefined,
        detalhes: [
          {
            campo: etapa?.nome || "Etapa",
            antes: concluidaAntes ? "Concluída" : "Pendente",
            depois: concluidaAntes ? "Pendente" : "Concluída",
          },
        ],
      }),
    }).catch(() => {});
  }

  async function salvarAnotacoes() {
    if (!osSelecionada) return;
    setSalvandoAnotacao(true);
    try {
      const res = await fetch(`/api/trabalhos/${osSelecionada.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ observacoes: anotacoes }),
      });
      if (res.ok) {
        setOsSelecionada((atual) => (atual ? { ...atual, observacoes: anotacoes } : atual));
      }
    } finally {
      setSalvandoAnotacao(false);
    }
  }

  async function atualizarSituacaoItem(novoStatus: string) {
    if (!osSelecionada || !itemAtivo) return;
    const res = await fetch(`/api/trabalhos/${osSelecionada.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: novoStatus }),
    });
    if (!res.ok) return;
    setOsSelecionada({ ...osSelecionada, status: novoStatus });
    setResultadosOs((lista) =>
      lista.map((t) => (t.id === osSelecionada.id ? { ...t, status: novoStatus } : t))
    );
  }

  type LinhaTabela = ItemModuloOs & { _trabalho?: TrabalhoModuloOs };

  const linhasTabela: LinhaTabela[] =
    osSelecionada && itens.length > 0
      ? itens
      : resultadosOs.length > 0 && !osSelecionada
        ? resultadosOs.map((t) => ({
            id: t.id,
            descricao: t.tipoProtese,
            prazo: t.dataPrevista,
            qtd: "1",
            situacao: t.status,
            tipo: "trabalho" as const,
            _trabalho: t,
          }))
        : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white text-[#333]">
      <AppFaixaTopo
        antes={
          <SiteSearchBar aberto={buscaSiteAberta} onFechar={() => setBuscaSiteAberta(false)} />
        }
        esquerda={
          <button
            type="button"
            onClick={toggleTheme}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-black/5 dark:hover:bg-white/10",
              darkMode ? "text-sky-400" : "text-[#5b9bd5]"
            )}
            aria-label={darkMode ? "Ativar modo claro" : "Ativar modo escuro"}
          >
            {darkMode ? (
              <Sun className="h-4 w-4" strokeWidth={1.75} />
            ) : (
              <Moon className="h-4 w-4" strokeWidth={1.75} />
            )}
          </button>
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
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen((open) => !open)}
                className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-left transition hover:bg-black/5"
                aria-expanded={userMenuOpen}
                aria-label="Abrir menu do usuário"
              >
                <div className="hidden leading-tight sm:block">
                  <p
                    suppressHydrationWarning
                    className="text-[11px] font-bold text-slate-800"
                  >
                    {montado ? nomeLaboratorio : "\u00a0"}
                  </p>
                  <p className="text-[10px] text-slate-500">{userName}</p>
                </div>
                <div
                  className={cn(
                    "relative inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full",
                    temLogoPerfil ? "bg-white ring-1 ring-slate-200/80" : "bg-[#dbeafe] text-[#4a90d9]"
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
                    <User className="h-4 w-4" />
                  )}
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#f2f4f6] bg-emerald-500" />
                </div>
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-lg border border-slate-200 bg-white py-2 shadow-2xl">
                  <div className="border-b border-slate-100 px-4 pb-3 pt-2">
                    <p
                      suppressHydrationWarning
                      className="text-sm font-bold text-slate-700"
                    >
                      {nomeLaboratorio}
                    </p>
                    <p className="text-xs text-slate-500">{userName}</p>
                  </div>
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        router.push("/app/alterar-senha");
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-600 transition hover:bg-slate-50 hover:text-[#4a90d9]"
                    >
                      <LockKeyhole className="h-4 w-4 text-slate-500" />
                      <span>{t("user.alterarSenha")}</span>
                    </button>
                  </div>
                  <div className="border-t border-slate-100 pt-1">
                    <button
                      type="button"
                      onClick={() => void logout()}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-600 transition hover:bg-red-50 hover:text-red-600"
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

      <main className="mx-auto w-full max-w-[1180px] flex-1 px-6 py-5 pb-24">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_250px]">
          <div className="overflow-hidden rounded border border-[#e5e7eb] bg-white">
            <div className="px-5 pb-4 pt-5">
              <label className="mb-2 block text-[13px] font-normal text-[#4b5563]">
                Número da OS
              </label>
              <div className="flex items-center gap-2">
                <input
                  value={buscaOs}
                  onChange={(e) => setBuscaOs(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void buscarOrdemServico();
                    }
                  }}
                  placeholder="Buscar serviço pela OS"
                  className="h-[38px] min-w-0 flex-1 rounded border border-[#d1d5db] px-3 text-[13px] text-[#374151] outline-none focus:border-[#3b82f6]"
                />
                <button
                  type="button"
                  onClick={() => void buscarOrdemServico()}
                  disabled={buscandoOs}
                  className="inline-flex h-[38px] shrink-0 items-center gap-2 rounded bg-[#3b82f6] px-4 text-[13px] font-normal text-white hover:bg-[#2563eb] disabled:opacity-60"
                >
                  <span
                    role="presentation"
                    className="inline-flex"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLeitorAberto(true);
                    }}
                  >
                    <ScanBarcode className="h-[18px] w-[18px]" strokeWidth={2} />
                  </span>
                  {buscandoOs ? "Buscando…" : "Buscar"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBuscaPaciente("");
                    setBuscaPacienteAberta(true);
                  }}
                  className="inline-flex h-[38px] shrink-0 items-center gap-2 rounded border border-[#93c5fd] bg-white px-4 text-[13px] font-normal text-[#3b82f6] hover:bg-[#eff6ff]"
                >
                  <User className="h-4 w-4" strokeWidth={2} />
                  Pesquisar Paciente
                </button>
              </div>
            </div>

            {osSelecionada ? (
              <div className="mx-5 mb-3 border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-[12px] leading-relaxed text-[#1e40af]">
                <div className="grid gap-x-10 gap-y-1 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p>
                      <span className="font-semibold">Ordem de Serviço:</span>{" "}
                      {osSelecionada.numeroOs}
                    </p>
                    <p>
                      <span className="font-semibold">Cliente:</span>{" "}
                      {osSelecionada.cliente?.nome || "—"}
                    </p>
                    <p>
                      <span className="font-semibold">Produtos:</span>{" "}
                      {itens.map((i) => i.descricao).join(", ") || "—"}
                    </p>
                    <p>
                      <span className="font-semibold">Observação Interna:</span>{" "}
                      {osSelecionada.observacoes?.trim() ||
                        valorLinhaInstrucao(instrucoesGrupo, "Observação") ||
                        "—"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p>
                      <span className="font-semibold">Data Lançamento:</span>{" "}
                      {formatDateModulo(osSelecionada.dataEntrada)}
                    </p>
                    <p>
                      <span className="font-semibold">Paciente:</span>{" "}
                      {osSelecionada.paciente?.nome || "—"}
                    </p>
                    <p>
                      <span className="font-semibold">Materiais enviado pelo Dentista:</span>{" "}
                      {valorLinhaInstrucao(instrucoesGrupo, "Material enviado") ||
                        osSelecionada.material?.trim() ||
                        "—"}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="min-h-[140px] overflow-x-auto">
              <table className="w-full min-w-[600px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-y border-[#e5e7eb] bg-[#f3f4f6]">
                    <th className="w-12 px-3 py-2.5 text-center">
                      <Check className="mx-auto h-4 w-4 text-[#3b82f6]" strokeWidth={2.5} />
                    </th>
                    <th className="w-16 px-2 py-2.5 text-center text-[12px] font-semibold uppercase text-[#6b7280]">
                      QTD
                    </th>
                    <th className="px-3 py-2.5 text-left text-[12px] font-semibold uppercase text-[#6b7280]">
                      Descrição
                    </th>
                    <th className="w-28 px-3 py-2.5 text-left text-[12px] font-semibold uppercase text-[#6b7280]">
                      Prazo
                    </th>
                    <th className="w-32 px-3 py-2.5 text-center text-[12px] font-semibold uppercase text-[#6b7280]">
                      Situação
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {linhasTabela.map((linha) => {
                    const ativo =
                      osSelecionada && itemAtivo ? itemAtivo.id === linha.id : false;
                    const situacao = statusModuloOs(linha.situacao);
                    return (
                      <tr
                        key={linha.id}
                        onClick={() => {
                          if (linha._trabalho) selecionarOs(linha._trabalho);
                          else if (osSelecionada) selecionarItem(linha);
                        }}
                        className={cn(
                          "cursor-pointer border-b border-[#f3f4f6]",
                          ativo && "bg-[#fff7ed]"
                        )}
                      >
                        <td className="px-3 py-2.5 text-center">
                          {ativo ? (
                            <Check className="mx-auto h-4 w-4 text-[#3b82f6]" strokeWidth={2.5} />
                          ) : null}
                        </td>
                        <td className="px-2 py-2.5 text-center text-[#374151]">{linha.qtd}</td>
                        <td className="px-3 py-2.5 text-[#374151]">{linha.descricao}</td>
                        <td className="px-3 py-2.5 text-[#6b7280]">
                          {formatDateModulo(linha.prazo)}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span
                            className={cn(
                              "inline-block rounded px-2 py-0.5 text-[11px] font-semibold",
                              situacao.color
                            )}
                          >
                            {situacao.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex border-t border-[#e5e7eb]">
              {abas.map((aba, index) => (
                <button
                  key={aba.id}
                  type="button"
                  onClick={() => setAbaAtiva(aba.id)}
                  className={cn(
                    "flex-1 border-r border-[#e5e7eb] py-2.5 text-[12px] font-semibold tracking-wide last:border-r-0",
                    abaAtiva === aba.id
                      ? "rounded-t-sm bg-[#3b82f6] text-white"
                      : "bg-white text-[#6b7280]"
                  )}
                  style={index === 0 && abaAtiva === aba.id ? undefined : undefined}
                >
                  {aba.label}
                </button>
              ))}
            </div>

            {!servicoSelecionado ? (
              <div className="bg-[#fde8d8] py-3 text-center text-[13px] font-normal text-[#e8913a]">
                Nenhum Serviço Selecionado!
              </div>
            ) : (
              <div className="min-h-[200px] bg-white p-4 text-[13px] text-[#374151]">
                {abaAtiva === "etapas" &&
                  (etapasOs.length === 0 ? (
                    <div className="bg-[#fde8d8] py-3 text-center text-[13px] font-normal text-[#e8913a]">
                      Não existe Etapas cadastradas para este serviço
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[520px] border-collapse text-[12px]">
                        <thead>
                          <tr className="border-b border-[#e5e7eb] bg-[#f9fafb] text-[11px] font-semibold uppercase text-[#6b7280]">
                            <th className="w-10 px-2 py-2 text-center">✓</th>
                            <th className="px-3 py-2 text-left">Etapa</th>
                            <th className="px-3 py-2 text-left">Responsável</th>
                            <th className="px-3 py-2 text-left">Prazo</th>
                            <th className="px-3 py-2 text-left">Observação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {etapasOs.map((etapa) => {
                            const ok = etapasOk.has(etapa.indice);
                            return (
                              <tr
                                key={`${etapa.indice}-${etapa.nome}`}
                                className="border-b border-[#f3f4f6] hover:bg-[#f9fafb]"
                              >
                                <td className="px-2 py-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => alternarEtapa(etapa.indice)}
                                    className={cn(
                                      "inline-flex h-5 w-5 items-center justify-center border",
                                      ok
                                        ? "border-[#22c55e] bg-[#22c55e] text-white"
                                        : "border-[#d1d5db] bg-white"
                                    )}
                                    aria-label={
                                      ok ? "Etapa concluída" : "Marcar etapa concluída"
                                    }
                                  >
                                    {ok ? <Check className="h-3 w-3" /> : null}
                                  </button>
                                </td>
                                <td className="px-3 py-2 font-medium text-[#374151]">
                                  {etapa.nome}
                                </td>
                                <td className="px-3 py-2 text-[#374151]">
                                  {etapa.responsavel || "—"}
                                </td>
                                <td className="px-3 py-2 text-[#6b7280]">
                                  {etapa.prazo || "—"}
                                </td>
                                <td className="px-3 py-2 text-[#6b7280]">
                                  {etapa.observacao || "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))}
                {abaAtiva === "anotacoes" && (
                  <div className="space-y-3">
                    <textarea
                      value={anotacoes}
                      onChange={(e) => setAnotacoes(e.target.value)}
                      rows={6}
                      className="w-full border border-[#d1d5db] px-3 py-2 text-[13px] outline-none focus:border-[#3b82f6]"
                    />
                    <button
                      type="button"
                      onClick={() => void salvarAnotacoes()}
                      disabled={salvandoAnotacao}
                      className="rounded bg-[#3b82f6] px-4 py-2 text-[13px] text-white"
                    >
                      {salvandoAnotacao ? "Salvando…" : "Gravar"}
                    </button>
                  </div>
                )}
                {abaAtiva === "imagens" && (
                  <p className="py-8 text-center text-[#9ca3af]">Sem imagens.</p>
                )}
                {abaAtiva === "detalhes" && osSelecionada && itemAtivo && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <CampoDetalhe label="OS" valor={String(osSelecionada.numeroOs)} />
                    <CampoDetalhe label="Serviço" valor={itemAtivo.descricao} />
                    <CampoDetalhe label="Paciente" valor={osSelecionada.paciente?.nome || "—"} />
                    <CampoDetalhe label="Cliente" valor={osSelecionada.cliente?.nome || "—"} />
                    <CampoDetalhe label="Dentes" valor={osSelecionada.dentes || "—"} />
                    <CampoDetalhe label="Cor" valor={osSelecionada.cor || "—"} />
                    <div>
                      <span className="text-[12px] text-[#6b7280]">Situação</span>
                      <select
                        value={osSelecionada.status}
                        onChange={(e) => void atualizarSituacaoItem(e.target.value)}
                        className="mt-1 h-[34px] w-full border border-[#d1d5db] px-2 text-[13px]"
                      >
                        {[
                          "pedido",
                          "producao",
                          "prova",
                          "finalizado",
                          "saiu_entrega",
                          "entregue",
                          "pendente",
                          "cancelado",
                        ].map((st) => (
                          <option key={st} value={st}>
                            {statusModuloOs(st).label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <aside className="flex flex-col gap-4">
            <div className="relative rounded border border-[#e5e7eb] bg-white px-4 py-4">
              <p className="text-[13px] font-semibold text-[#374151]">Total Comissões</p>
              <div className="mt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setComissaoVisivel((v) => !v)}
                  className="text-[#9ca3af] hover:text-[#6b7280]"
                  aria-label={comissaoVisivel ? "Ocultar valor" : "Mostrar valor"}
                >
                  {comissaoVisivel ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="text-[#9ca3af] hover:text-[#6b7280]"
                  aria-label="Atualizar"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
              <p
                className={cn(
                  "mt-2 text-[26px] font-semibold leading-none text-[#374151]",
                  !comissaoVisivel && "blur-md select-none"
                )}
              >
                R$ 0,00
              </p>
              <Link
                href="/app/producao/comissao"
                className="mt-3 inline-block rounded border border-[#3b82f6] px-3 py-1 text-[12px] text-[#3b82f6] hover:bg-[#eff6ff]"
              >
                Ver Detalhes
              </Link>
              <div className="absolute right-4 top-1/2 flex h-[72px] w-[72px] -translate-y-1/2 items-center justify-center rounded-full bg-[#dbeafe]">
                <DollarSign className="h-9 w-9 text-[#3b82f6]" strokeWidth={1.5} />
              </div>
            </div>

            <div className="flex items-center gap-3 rounded border border-[#e5e7eb] bg-white px-4 py-6">
              <Calendar className="h-6 w-6 text-[#6b7280]" strokeWidth={1.5} />
              <span className="text-[14px] text-[#374151]">Agenda</span>
            </div>
          </aside>
        </div>
      </main>

      {buscaPacienteAberta && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-28">
          <div className="w-full max-w-md rounded border border-[#e5e7eb] bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-[#e5e7eb] px-4 py-3">
              <h2 className="text-[14px] font-semibold text-[#374151]">Pesquisar Paciente</h2>
              <button type="button" onClick={() => setBuscaPacienteAberta(false)} aria-label="Fechar">
                <X className="h-5 w-5 text-[#9ca3af]" />
              </button>
            </div>
            <div className="space-y-3 p-4">
              <input
                value={buscaPaciente}
                onChange={(e) => setBuscaPaciente(e.target.value)}
                autoFocus
                placeholder="Nome do paciente ou cliente"
                className="h-[38px] w-full border border-[#d1d5db] px-3 text-[13px] outline-none focus:border-[#3b82f6]"
              />
              <div className="max-h-56 space-y-2 overflow-y-auto">
                {resultadosOs.map((trabalho) => (
                  <button
                    key={trabalho.id}
                    type="button"
                    onClick={() => {
                      selecionarOs(trabalho);
                      setBuscaPacienteAberta(false);
                    }}
                    className="flex w-full items-center justify-between border border-[#e5e7eb] px-3 py-2 text-left text-[13px] hover:bg-[#eff6ff]"
                  >
                    <span>{trabalho.paciente?.nome || trabalho.cliente?.nome || "—"}</span>
                    <span className="text-[12px] font-semibold text-[#3b82f6]">
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
        open={leitorAberto}
        onClose={() => setLeitorAberto(false)}
        onCodigoLido={(numero) => void buscarOrdemServico(numero)}
      />
    </div>
  );
}

function CampoDetalhe({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <span className="block text-[12px] text-[#6b7280]">{label}</span>
      <span className="text-[13px] text-[#374151]">{valor}</span>
    </div>
  );
}
