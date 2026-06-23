"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  Wallet,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui";
import { AsaasSeloInstitucional } from "@/components/AsaasSeloInstitucional";
import { FinanceiroAbasNav } from "@/components/financeiro/FinanceiroAbasNav";
import { analisarCaminhoApp, montarCaminhoAppComSlug } from "@/lib/rotas-app";
import { cn } from "@/lib/utils";
import type { TipoMensagemForm } from "@/components/DadosLaboratorioForm";

type StatusSubconta =
  | "nao_iniciado"
  | "pendente_documentos"
  | "em_analise"
  | "aprovada"
  | "reprovada";

type DocumentoOnboarding = {
  id: string;
  title: string;
  description?: string;
  status?: string;
  onboardingUrl?: string | null;
};

type SubcontaResumo = {
  status: StatusSubconta;
  contaAtiva?: boolean;
  agencia?: string | null;
  conta?: string | null;
  contaDigito?: string | null;
};

const labelClass = "mb-1 block text-[11px] font-medium text-slate-600";
const inputClass =
  "h-9 w-full rounded border border-slate-300 bg-white px-2.5 text-[12px] text-slate-800 outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]";

function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function rotuloStatus(status: StatusSubconta) {
  switch (status) {
    case "aprovada":
      return { texto: "Conta aprovada", cor: "text-emerald-700 bg-emerald-50 border-emerald-200" };
    case "em_analise":
      return { texto: "Em análise", cor: "text-amber-700 bg-amber-50 border-amber-200" };
    case "reprovada":
      return { texto: "Reprovada", cor: "text-red-700 bg-red-50 border-red-200" };
    case "pendente_documentos":
      return { texto: "Documentos pendentes", cor: "text-blue-700 bg-blue-50 border-blue-200" };
    default:
      return { texto: "Não iniciada", cor: "text-slate-600 bg-slate-50 border-slate-200" };
  }
}

function linkConfiguracoes(pathname: string) {
  const { slug } = analisarCaminhoApp(pathname);
  if (slug) return montarCaminhoAppComSlug(slug, "/configuracoes?aba=boletos");
  return "/app/configuracoes?aba=boletos";
}

export function ContaDigitalConteudo() {
  const pathname = usePathname();
  const [subconta, setSubconta] = useState<SubcontaResumo | null>(null);
  const [saldo, setSaldo] = useState(0);
  const [movimentacoes, setMovimentacoes] = useState<
    Array<{
      id: string;
      date: string;
      type: string;
      value: number;
      description: string;
      balance: number;
    }>
  >([]);
  const [aba, setAba] = useState<"extrato" | "pagar" | "transferir">("extrato");
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [mensagem, setMensagem] = useState<{ texto: string; tipo: TipoMensagemForm } | null>(
    null
  );

  const [linhaDigitavel, setLinhaDigitavel] = useState("");
  const [boletoValidado, setBoletoValidado] = useState<{
    valor: number;
    vencimento?: string;
    beneficiario?: string;
  } | null>(null);
  const [valorPix, setValorPix] = useState("");
  const [chavePix, setChavePix] = useState("");
  const [tipoChave, setTipoChave] = useState<"CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP">("EVP");

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const resSub = await fetch("/api/asaas/subconta", { cache: "no-store" });
      const jsonSub = (await resSub.json()) as {
        subconta?: SubcontaResumo;
        error?: string;
      };
      if (!resSub.ok) throw new Error(jsonSub.error || "Erro ao carregar conta.");
      setSubconta(jsonSub.subconta || null);

      if (jsonSub.subconta?.contaAtiva) {
        const resSaldo = await fetch("/api/asaas/conta-digital", { cache: "no-store" });
        const jsonSaldo = (await resSaldo.json()) as { saldo?: number; error?: string };
        if (resSaldo.ok) setSaldo(Number(jsonSaldo.saldo) || 0);

        const resExt = await fetch("/api/asaas/conta-digital?acao=extrato", {
          cache: "no-store",
        });
        const jsonExt = (await resExt.json()) as {
          movimentacoes?: typeof movimentacoes;
        };
        if (resExt.ok) setMovimentacoes(jsonExt.movimentacoes || []);
      } else {
        setSaldo(0);
        setMovimentacoes([]);
      }
    } catch (err) {
      setMensagem({
        texto: err instanceof Error ? err.message : "Erro ao carregar.",
        tipo: "erro",
      });
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function validarBoleto() {
    setProcessando(true);
    setMensagem(null);
    try {
      const res = await fetch("/api/asaas/conta-digital", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "validar-boleto", linhaDigitavel }),
      });
      const json = (await res.json()) as { boleto?: typeof boletoValidado; error?: string };
      if (!res.ok) throw new Error(json.error || "Boleto inválido.");
      setBoletoValidado(json.boleto || null);
      setMensagem({ texto: "Boleto validado com sucesso.", tipo: "sucesso" });
    } catch (err) {
      setBoletoValidado(null);
      setMensagem({
        texto: err instanceof Error ? err.message : "Falha na validação.",
        tipo: "erro",
      });
    } finally {
      setProcessando(false);
    }
  }

  async function pagarBoleto() {
    setProcessando(true);
    setMensagem(null);
    try {
      const res = await fetch("/api/asaas/conta-digital", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "pagar-boleto", linhaDigitavel }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Pagamento não realizado.");
      setLinhaDigitavel("");
      setBoletoValidado(null);
      setMensagem({ texto: "Pagamento solicitado com sucesso.", tipo: "sucesso" });
      await carregar();
    } catch (err) {
      setMensagem({
        texto: err instanceof Error ? err.message : "Falha no pagamento.",
        tipo: "erro",
      });
    } finally {
      setProcessando(false);
    }
  }

  async function transferirPix() {
    setProcessando(true);
    setMensagem(null);
    try {
      const valor = Number(valorPix.replace(/\./g, "").replace(",", "."));
      const res = await fetch("/api/asaas/conta-digital", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "transferir-pix",
          valor,
          chavePix,
          tipoChave,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Transferência não realizada.");
      setValorPix("");
      setChavePix("");
      setMensagem({ texto: "Transferência Pix solicitada.", tipo: "sucesso" });
      await carregar();
    } catch (err) {
      setMensagem({
        texto: err instanceof Error ? err.message : "Falha na transferência.",
        tipo: "erro",
      });
    } finally {
      setProcessando(false);
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando conta digital…
      </div>
    );
  }

  const status = subconta?.status || "nao_iniciado";
  const badge = rotuloStatus(status);

  if (!subconta?.contaAtiva) {
    return (
      <div>
        <FinanceiroAbasNav />
        <div className="max-w-xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <Wallet className="mt-0.5 h-8 w-8 text-[#4a90d9]" />
            <div>
              <h2 className="text-[15px] font-medium text-slate-800">Conta Digital</h2>
              <p className="mt-1 text-[12px] text-slate-600">
                Abra sua conta para emitir boletos, receber Pix, pagar contas e transferir valores
                sem sair do Lab Prótese.
              </p>
              <span
                className={cn(
                  "mt-3 inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                  badge.cor
                )}
              >
                {badge.texto}
              </span>
            </div>
          </div>
          <Link
            href={linkConfiguracoes(pathname)}
            className="mt-5 inline-flex h-9 items-center rounded bg-[#4a90d9] px-4 text-[13px] text-white hover:bg-[#3d7fc4]"
          >
            Ativar conta digital
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <FinanceiroAbasNav />

      {mensagem ? (
        <p
          className={cn(
            "mb-4 rounded border px-3 py-2 text-[12px]",
            mensagem.tipo === "sucesso"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          )}
        >
          {mensagem.texto}
        </p>
      ) : null}

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:col-span-1">
          <p className="text-[11px] text-slate-500">Saldo disponível</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{money(saldo)}</p>
          {subconta.conta ? (
            <p className="mt-2 text-[11px] text-slate-500">
              Ag. {subconta.agencia || "—"} · Cc {subconta.conta}
              {subconta.contaDigito ? `-${subconta.contaDigito}` : ""}
            </p>
          ) : null}
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 md:col-span-2">
          <div className="flex items-center gap-2 text-emerald-800">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-[13px] font-medium">Conta digital ativa</span>
          </div>
          <p className="mt-1 text-[12px] text-emerald-900/80">
            Emissão de boletos nas receitas usa automaticamente esta conta. Pagamentos e
            transferências abaixo debitam deste saldo.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
        {(
          [
            ["extrato", "Extrato", FileText],
            ["pagar", "Pagar boleto", FileText],
            ["transferir", "Transferir Pix", ArrowLeftRight],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setAba(id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[12px] font-medium transition",
              aba === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {aba === "extrato" ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-[12px]">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] text-slate-500">
              <tr>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Descrição</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {movimentacoes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                    Nenhuma movimentação recente.
                  </td>
                </tr>
              ) : (
                movimentacoes.map((mov) => (
                  <tr key={mov.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 whitespace-nowrap">{mov.date}</td>
                    <td className="px-3 py-2">{mov.description || "—"}</td>
                    <td className="px-3 py-2 text-slate-500">{mov.type}</td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right font-medium",
                        mov.value >= 0 ? "text-emerald-700" : "text-red-700"
                      )}
                    >
                      {money(mov.value)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {aba === "pagar" ? (
        <div className="max-w-xl space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <label className={labelClass}>Linha digitável do boleto</label>
            <input
              type="text"
              value={linhaDigitavel}
              onChange={(e) => setLinhaDigitavel(e.target.value)}
              className={cn(inputClass, "font-mono text-[11px]")}
              placeholder="Cole ou digite a linha digitável"
            />
          </div>
          {boletoValidado ? (
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-[12px]">
              <p>
                <strong>Valor:</strong> {money(boletoValidado.valor)}
              </p>
              {boletoValidado.beneficiario ? (
                <p>
                  <strong>Beneficiário:</strong> {boletoValidado.beneficiario}
                </p>
              ) : null}
              {boletoValidado.vencimento ? (
                <p>
                  <strong>Vencimento:</strong> {boletoValidado.vencimento}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={processando} onClick={() => void validarBoleto()}>
              Validar boleto
            </Button>
            <Button type="button" disabled={processando || !boletoValidado} onClick={() => void pagarBoleto()}>
              Pagar boleto
            </Button>
          </div>
        </div>
      ) : null}

      {aba === "transferir" ? (
        <div className="max-w-xl space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <label className={labelClass}>Valor</label>
            <input
              type="text"
              value={valorPix}
              onChange={(e) => setValorPix(e.target.value)}
              className={inputClass}
              placeholder="0,00"
            />
          </div>
          <div>
            <label className={labelClass}>Tipo da chave</label>
            <select
              value={tipoChave}
              onChange={(e) =>
                setTipoChave(e.target.value as typeof tipoChave)
              }
              className={inputClass}
            >
              <option value="EVP">Aleatória</option>
              <option value="CPF">CPF</option>
              <option value="CNPJ">CNPJ</option>
              <option value="EMAIL">E-mail</option>
              <option value="PHONE">Telefone</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Chave Pix</label>
            <input
              type="text"
              value={chavePix}
              onChange={(e) => setChavePix(e.target.value)}
              className={inputClass}
            />
          </div>
          <Button type="button" disabled={processando} onClick={() => void transferirPix()}>
            Transferir Pix
          </Button>
        </div>
      ) : null}

      <AsaasSeloInstitucional
        detalhado
        className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-5"
      />
    </div>
  );
}
