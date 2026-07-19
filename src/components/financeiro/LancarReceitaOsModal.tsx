"use client";

import { I18nPortal } from "@/components/I18nPortal";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Barcode, Eye, Minus, Plus, X } from "lucide-react";
import { CampoDataBr } from "@/components/campo-data-br";
import { SelectPesquisavel } from "@/components/SelectPesquisavel";
import { PlanoContasCategoriaSelect } from "@/components/financeiro/PlanoContasCategoriaSelect";
import { SituacaoOsBadgeReceita } from "@/components/financeiro/SituacaoOsBadgeReceita";
import { dateToBrShort, somarMesesDataBr } from "@/lib/datas-br";
import {
  carregarPlanoContas,
  categoriaPadraoLancamento,
  contasAnaliticasPlano,
  PLANO_CONTAS_ATUALIZADO_EVENT,
} from "@/lib/plano-contas";
import { AnexosReciboCampo,
  type AnexosReciboCampoRef,
} from "@/components/financeiro/AnexosReciboCampo";
import { SelectFormaRecebimentoAsaas } from "@/components/financeiro/SelectFormaRecebimentoAsaas";
import type { AnexoDespesa } from "@/lib/lancamento-despesa";
import { cn, STATUS_TRABALHO } from "@/lib/utils";
import { useEntradaLeitorCodigo } from "@/hooks/use-entrada-leitor-codigo-barras";
import type { TrabalhoSituacaoBadge } from "@/components/financeiro/SituacaoOsBadgeReceita";
import {
  carregarConfiguracoesGerais,
  CONFIG_GERAIS_ATUALIZADA_EVENT,
} from "@/lib/configuracoes-gerais";
import { osExternaAgenda } from "@/lib/agenda-producao-grupo";
import { prazoFromInstructions, prazoTrabalho } from "@/lib/controle-producao-prazos";
import { itensDoTrabalho } from "@/lib/relatorio-faturas-modelo3-dados";

export type LancarReceitaOsForm = {
  tipo: string;
  semOs: boolean;
  clienteId: string;
  convenio: string;
  categoria: string;
  descricao: string;
  valor: string;
  descontoTipo: string;
  desconto: string;
  jurosTipo: string;
  juros: string;
  acrescimo: boolean;
  data: string;
  pedidoInicio: string;
  pedidoFinal: string;
  situacaoOs: string;
  vencimento: string;
  status: string;
  formaPagamento: string;
  conta: string;
  parcela: string;
  observacoes: string;
  recebido: boolean;
};

type TrabalhoReceita = TrabalhoSituacaoBadge & {
  valor?: number;
  dentes?: string | null;
  cor?: string | null;
  material?: string | null;
  observacoes?: string | null;
  dataPrevista?: string | null;
  dataEntrega?: string | null;
  dataEntrada?: string | null;
  updatedAt?: string | null;
  cliente?: { id?: string; nome?: string | null; cro?: string | null } | null;
  paciente?: { nome?: string | null } | null;
};

function formatarDataBrCurta(value?: string | Date | null): string {
  if (!value) return "";
  if (typeof value === "string") {
    if (/^\d{2}\/\d{2}\/\d{4}/.test(value)) return value.slice(0, 10);
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR");
}

function materialEnviadoDentista(trabalho: TrabalhoReceita) {
  if (trabalho.material?.trim()) return trabalho.material.trim();
  const linha = (trabalho.instrucoes || "")
    .split("\n")
    .map((l) => l.trim())
    .find((l) => /^material enviado/i.test(l));
  return (
    linha?.replace(/^material enviado(?: pelo dentista)?:\s*/i, "").trim() || ""
  );
}

function detalhesLinhaReceitaOs(trabalho: TrabalhoReceita, money: (n: number) => string) {
  const itens = itensDoTrabalho(trabalho);
  const item = itens[0];
  const qtd = itens.reduce((sum, i) => sum + (Number(String(i.qtd).replace(",", ".")) || 0), 0) || 1;
  const total = itens.reduce((sum, i) => sum + i.subtotal, 0);
  const valorUnitario = item?.valorUn ?? total / Math.max(qtd, 1);
  const desconto = item?.descPercent?.trim() || "0,00";
  const descontoFmt = desconto.includes("%") ? desconto : `% ${desconto}`;

  const prazoLab =
    prazoTrabalho(
      {
        status: trabalho.status,
        dataEntrada: trabalho.dataEntrada || trabalho.dataPrevista || new Date().toISOString(),
        dataPrevista: trabalho.dataPrevista,
        instrucoes: trabalho.instrucoes,
      },
      "lab"
    ) || prazoFromInstructions(trabalho.instrucoes, "lab");

  const prazoDentista =
    prazoTrabalho(
      {
        status: trabalho.status,
        dataEntrada: trabalho.dataEntrada || trabalho.dataPrevista || new Date().toISOString(),
        dataPrevista: trabalho.dataPrevista,
        instrucoes: trabalho.instrucoes,
      },
      "dentista"
    ) || prazoFromInstructions(trabalho.instrucoes, "dentista");

  return {
    qtd: String(qtd),
    servico: item?.descricao || trabalho.tipoProtese || "—",
    dentista: trabalho.cliente?.nome?.trim() || item?.dentista || "",
    paciente: trabalho.paciente?.nome?.trim() || item?.paciente || "",
    entregue: formatarDataBrCurta(trabalho.dataEntrega),
    osExterna: osExternaAgenda(trabalho.instrucoes),
    prazoLab: prazoLab ? formatarDataBrCurta(prazoLab) : "",
    prazoDentista: prazoDentista ? formatarDataBrCurta(prazoDentista) : "",
    finalizado: formatarDataBrCurta(trabalho.dataEntrega || trabalho.updatedAt),
    numDente: item?.numDente || trabalho.dentes || "",
    corDente: trabalho.cor?.trim() || "",
    valorUnitario: money(valorUnitario),
    desconto: descontoFmt,
    total: money(total),
    material: materialEnviadoDentista(trabalho),
    observacaoInterna: trabalho.observacoes?.trim() || "",
  };
}

export type ParcelaLinhaReceita = {
  parcela: string;
  formaPagamento: string;
  conta: string;
  vencimento: string;
  valor: string;
  valorTipo: "percentual" | "valor";
  juros: string;
  jurosTipo: "percentual" | "valor";
  recebido: boolean;
};

export type LancarReceitaOsSubmit = {
  form: LancarReceitaOsForm;
  parcelas: ParcelaLinhaReceita[];
  imprimirRecibo: boolean;
  alterarEntregue: boolean;
  abaterCredito: boolean;
  enviarControleEntrega: boolean;
  anexos?: AnexoDespesa[];
};

const labelClass = "mb-1 block text-[11px] font-normal text-[#6b7280]";
const fieldClass =
  "h-[34px] w-full rounded-sm border border-[#d1d5db] bg-white px-2.5 text-[13px] text-[#374151] outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (dados: LancarReceitaOsSubmit) => void | Promise<void>;
  form: LancarReceitaOsForm;
  setForm: React.Dispatch<React.SetStateAction<LancarReceitaOsForm>>;
  clientes: { id: string; nome: string }[];
  trabalhosParaReceita: TrabalhoReceita[];
  osSelecionadas: string[];
  toggleOsReceita: (id: string) => void;
  toggleSelecionarTodasReceita: () => void;
  todasReceitaSelecionadas: boolean;
  algumasReceitaSelecionadas: boolean;
  valorOsSelecionadas: number;
  totalLiquido: number;
  creditoDisponivel: number;
  mensagemLancamento: string;
  mensagemLancamentoTipo: "erro" | "sucesso" | "info";
  formaSelecionadaEhBoleto: (parcelas: ParcelaLinhaReceita[]) => boolean;
  pixAsaasDisponivel?: boolean;
  valorTrabalho: (trabalho: TrabalhoReceita) => number;
  onLimparOsSelecionadas: () => void;
  money: (value: number) => string;
  currency: (value: number) => string;
  formatDecimalInput: (value: string) => string;
  formatCurrencyInput: (value: string) => string;
  salvando?: boolean;
};

function CampoMoedaOuPercentual({
  tipo,
  valor,
  onTipoChange,
  onValorChange,
  formatDecimalInput,
  formatCurrencyInput,
  className,
}: {
  tipo: "percentual" | "valor";
  valor: string;
  onTipoChange: (tipo: "percentual" | "valor") => void;
  onValorChange: (valor: string) => void;
  formatDecimalInput: (value: string) => string;
  formatCurrencyInput: (value: string) => string;
  className?: string;
}) {
  return (
    <div className={cn("flex overflow-hidden rounded-sm border border-[#d1d5db]", className)}>
      <select
        value={tipo}
        onChange={(e) =>
          onTipoChange(e.target.value === "valor" ? "valor" : "percentual")
        }
        className="h-8 w-11 shrink-0 border-r border-[#d1d5db] bg-white text-center text-[11px] outline-none"
      >
        <option value="percentual">%</option>
        <option value="valor">R$</option>
      </select>
      <input
        type="text"
        value={valor}
        onChange={(e) =>
          onValorChange(
            tipo === "valor"
              ? formatCurrencyInput(e.target.value)
              : formatDecimalInput(e.target.value)
          )
        }
        className="h-8 min-w-0 flex-1 border-0 bg-white px-2 text-right text-[12px] outline-none"
      />
    </div>
  );
}

function ToggleSmart({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-[12px] text-[#374151]">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition",
          checked ? "bg-[#4a90d9]" : "bg-[#cbd5e1]"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition",
            checked ? "left-[18px]" : "left-0.5"
          )}
        />
      </button>
      {label}
    </label>
  );
}

export function LancarReceitaOsModal({
  open,
  onClose,
  onSubmit,
  form,
  setForm,
  clientes,
  trabalhosParaReceita,
  osSelecionadas,
  toggleOsReceita,
  toggleSelecionarTodasReceita,
  todasReceitaSelecionadas,
  algumasReceitaSelecionadas,
  valorOsSelecionadas,
  totalLiquido,
  creditoDisponivel = 0,
  mensagemLancamento,
  mensagemLancamentoTipo,
  formaSelecionadaEhBoleto,
  pixAsaasDisponivel = false,
  valorTrabalho,
  onLimparOsSelecionadas,
  money,
  currency,
  formatDecimalInput,
  formatCurrencyInput,
  salvando = false,
}: Props) {
  const [portalPronto, setPortalPronto] = useState(false);
  const [cadastrando, setCadastrando] = useState(false);
  const submitLockRef = useRef(false);
  const anexosRef = useRef<AnexosReciboCampoRef>(null);
  const ocupado = cadastrando || salvando;
  const [alterarEntregue, setAlterarEntregue] = useState(
    () => carregarConfiguracoesGerais().faturasAlterarSituacaoEntregue
  );
  const [enviarControleEntrega, setEnviarControleEntrega] = useState(
    () => carregarConfiguracoesGerais().faturasAdicionarControleEntregas
  );
  const creditoDisponivelSeguro = Number.isFinite(creditoDisponivel) ? creditoDisponivel : 0;
  const [abaterCredito, setAbaterCredito] = useState(false);
  const creditoAplicado =
    abaterCredito && creditoDisponivelSeguro > 0
      ? Math.min(creditoDisponivelSeguro, totalLiquido)
      : 0;
  const totalAReceberComCredito = Math.max(0, totalLiquido - creditoAplicado);
  const [codigoBarras, setCodigoBarras] = useState("");
  const [feedbackCodigo, setFeedbackCodigo] = useState<{ tipo: "ok" | "erro"; msg: string } | null>(
    null
  );
  const [numParcelas, setNumParcelas] = useState(1);
  const [imprimirRecibo, setImprimirRecibo] = useState(false);
  const [osExpandidaId, setOsExpandidaId] = useState<string | null>(null);
  const [parcelas, setParcelas] = useState<ParcelaLinhaReceita[]>([
    {
      parcela: "1/1",
      formaPagamento: "Forma Pagamento",
      conta: "Caixa Principal",
      vencimento: dateToBrShort(new Date()),
      valor: "0,00",
      valorTipo: "valor",
      juros: "0,00",
      jurosTipo: "percentual",
      recebido: false,
    },
  ]);

  const algumaParcelaRecebida = parcelas.some((p) => p.recebido);

  const aplicarCodigoOs = useCallback(
    (numero: string) => {
      const trabalho = trabalhosParaReceita.find((t) => String(t.numeroOs) === numero);
      if (trabalho) {
        if (!osSelecionadas.includes(trabalho.id)) toggleOsReceita(trabalho.id);
        setFeedbackCodigo({ tipo: "ok", msg: `OS ${numero} selecionada` });
        setCodigoBarras("");
      } else {
        setFeedbackCodigo({
          tipo: "erro",
          msg: `OS ${numero} não encontrada para este cliente e situação`,
        });
      }
    },
    [trabalhosParaReceita, osSelecionadas, toggleOsReceita]
  );

  const { onKeyDown: onKeyDownCodigo, onChange: onChangeCodigo, leitorUsbAtivo } =
    useEntradaLeitorCodigo({
      onLido: (numero) => aplicarCodigoOs(numero),
    });

  useEffect(() => {
    setPortalPronto(true);
  }, []);

  function aplicarConfiguracoesFaturas() {
    const config = carregarConfiguracoesGerais();
    setAlterarEntregue(config.faturasAlterarSituacaoEntregue);
    setEnviarControleEntrega(config.faturasAdicionarControleEntregas);
  }

  useEffect(() => {
    if (!open || pixAsaasDisponivel) return;
    setParcelas((lista) =>
      lista.map((p) => {
        const f = (p.formaPagamento || "").trim().toLowerCase();
        if (f === "pix" || f.includes("boleto")) {
          return { ...p, formaPagamento: "Forma Pagamento" };
        }
        return p;
      })
    );
  }, [open, pixAsaasDisponivel, setParcelas]);

  useEffect(() => {
    if (!open) return;
    aplicarConfiguracoesFaturas();
    setAbaterCredito(false);
    setCodigoBarras("");
    setFeedbackCodigo(null);
    setNumParcelas(1);
    setImprimirRecibo(false);
    setOsExpandidaId(null);
    const plano = carregarPlanoContas();
    const padrao =
      categoriaPadraoLancamento(plano, "receitas") || "Receitas de Serviços";
    setForm((f) => ({ ...f, categoria: padrao }));
  }, [open, setForm]);

  useEffect(() => {
    if (!open) return;
    const onConfigAtualizada = () => aplicarConfiguracoesFaturas();
    window.addEventListener(CONFIG_GERAIS_ATUALIZADA_EVENT, onConfigAtualizada);
    return () => window.removeEventListener(CONFIG_GERAIS_ATUALIZADA_EVENT, onConfigAtualizada);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function sincronizarCategoriaPlano() {
      const plano = carregarPlanoContas();
      const analiticas = contasAnaliticasPlano(plano, "receitas");
      const padrao = categoriaPadraoLancamento(plano, "receitas");
      setForm((f) => {
        const aindaExiste = analiticas.some((item) => item.nome === f.categoria);
        if (aindaExiste) return f;
        return { ...f, categoria: padrao || f.categoria };
      });
    }
    sincronizarCategoriaPlano();
    window.addEventListener(PLANO_CONTAS_ATUALIZADO_EVENT, sincronizarCategoriaPlano);
    return () =>
      window.removeEventListener(PLANO_CONTAS_ATUALIZADO_EVENT, sincronizarCategoriaPlano);
  }, [open, setForm]);

  useEffect(() => {
    const valorParcela =
      numParcelas > 0
        ? (totalAReceberComCredito / numParcelas).toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : "0,00";
    setParcelas((atual) => {
      const vencimentoBase =
        atual[0]?.vencimento || form.vencimento || dateToBrShort(new Date());
      return Array.from({ length: numParcelas }, (_, i) => {
        const existente = atual[i];
        return {
          parcela: `${i + 1}/${numParcelas}`,
          formaPagamento: existente?.formaPagamento || form.formaPagamento || "Forma Pagamento",
          conta: existente?.conta || form.conta || "Caixa Principal",
          vencimento:
            existente?.vencimento || somarMesesDataBr(vencimentoBase, i),
          valor: valorParcela,
          valorTipo: existente?.valorTipo || "valor",
          juros: existente?.juros || form.juros || "0,00",
          jurosTipo: existente?.jurosTipo || (form.jurosTipo as "percentual" | "valor") || "percentual",
          recebido: existente?.recebido ?? form.recebido,
        };
      });
    });
  }, [
    numParcelas,
    totalAReceberComCredito,
    form.formaPagamento,
    form.conta,
    form.vencimento,
    form.juros,
    form.jurosTipo,
    form.recebido,
  ]);

  useEffect(() => {
    if (!algumaParcelaRecebida) setImprimirRecibo(false);
  }, [algumaParcelaRecebida]);

  useEffect(() => {
    const p = parcelas[0];
    if (!p) return;
    setForm((f) => ({
      ...f,
      parcela: p.parcela,
      formaPagamento: p.formaPagamento,
      conta: p.conta,
      vencimento: p.vencimento,
      juros: p.juros,
      jurosTipo: p.jurosTipo,
      recebido: p.recebido,
      status: p.recebido ? "pago" : "pendente",
    }));
  }, [parcelas, setForm]);

  function atualizarParcela(index: number, patch: Partial<ParcelaLinhaReceita>) {
    setParcelas((lista) => lista.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  async function enviarFormulario(e: React.FormEvent) {
    e.preventDefault();
    if (submitLockRef.current || ocupado) return;
    submitLockRef.current = true;
    setCadastrando(true);
    try {
      let anexos: AnexoDespesa[] | undefined;
      const lista = await anexosRef.current?.resolverAnexos();
      if (lista?.length) anexos = lista;
      await onSubmit({
        form,
        parcelas,
        imprimirRecibo,
        alterarEntregue,
        abaterCredito,
        enviarControleEntrega,
        anexos,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Falha ao enviar os arquivos.");
    } finally {
      submitLockRef.current = false;
      setCadastrando(false);
    }
  }

  if (!open || !portalPronto) return null;

  const semOs = form.semOs;
  const valorBrutoExibicao = semOs ? totalLiquido : valorOsSelecionadas;

  return createPortal(
    <I18nPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-2 sm:p-3">
        <div
          className="absolute inset-0"
          onClick={() => {
            if (!ocupado) onClose();
          }}
          aria-hidden
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="lancar-receita-os-titulo"
          className="relative flex h-[94vh] w-[96vw] max-w-[1580px] flex-col overflow-hidden rounded-sm border border-[#d0d5dd] bg-white shadow-2xl"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-[#e5e7eb] px-5 py-2.5">
            <h2
              id="lancar-receita-os-titulo"
              className="text-[16px] font-normal text-[#374151]"
            >
              Lançar Receita
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={ocupado}
              className="rounded p-1 text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151] disabled:opacity-40"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form
            onSubmit={enviarFormulario}
            className="flex min-h-0 flex-1 flex-col text-[12px]"
          >
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          <div className="flex flex-wrap items-end justify-between gap-3 pb-3">
            <ToggleSmart
              checked={semOs}
              onChange={(v) => setForm((f) => ({ ...f, semOs: v }))}
              label="Lançar uma Cobrança ou Outras Receitas sem O.S."
            />
            <div className="w-full min-w-[220px] max-w-[320px]">
              <label className={labelClass}>Categorias</label>
              <PlanoContasCategoriaSelect
                secao="receitas"
                value={form.categoria}
                onChange={(v) => setForm((f) => ({ ...f, categoria: v }))}
                triggerClassName={fieldClass}
                menuEmPortal
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <SelectPesquisavel
                label="Cliente"
                value={form.clienteId}
                onChange={(clienteId) => {
                  setForm((f) => ({ ...f, clienteId }));
                  onLimparOsSelecionadas();
                }}
                placeholder="Selecione"
                inputClassName={fieldClass}
                menuEmPortal
                options={clientes.map((c) => ({ value: c.id, label: c.nome }))}
              />
            </div>
            <div>
              <label className={labelClass}>Conveniado</label>
              <select
                value={form.convenio}
                onChange={(e) => setForm((f) => ({ ...f, convenio: e.target.value }))}
                className={fieldClass}
              >
                <option value="">Selecione</option>
                <option value="Particular">Particular</option>
                <option value="Convênio">Convênio</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Período (data entrega)</label>
              <div className="grid grid-cols-2 gap-2">
                <CampoDataBr
                  value={form.pedidoInicio}
                  onChange={(v) => setForm((f) => ({ ...f, pedidoInicio: v }))}
                  className="space-y-0"
                  inputClassName={fieldClass}
                  placeholder="Data Inicial"
                />
                <CampoDataBr
                  value={form.pedidoFinal}
                  onChange={(v) => setForm((f) => ({ ...f, pedidoFinal: v }))}
                  className="space-y-0"
                  inputClassName={fieldClass}
                  placeholder="Data Final"
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Situação</label>
              <select
                value={form.situacaoOs}
                onChange={(e) => {
                  setForm((f) => ({ ...f, situacaoOs: e.target.value }));
                  onLimparOsSelecionadas();
                }}
                className={fieldClass}
              >
                <option value="">Selecione</option>
                {Object.entries(STATUS_TRABALHO).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label}
                  </option>
                ))}
                <option value="produto">Produto</option>
                <option value="transporte">Transporte</option>
              </select>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="flex min-w-[280px] flex-[2] overflow-hidden rounded-sm border border-[#d1d5db]">
              <input
                type="text"
                placeholder="O.S., serviço ou paciente"
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                className="min-w-0 flex-1 border-0 bg-white px-3 py-2 text-[13px] outline-none"
              />
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, descricao: "" }))}
                className="shrink-0 border-l border-[#d1d5db] bg-[#f9fafb] px-4 text-[13px] text-[#6b7280] hover:bg-[#f3f4f6]"
              >
                Limpar
              </button>
            </div>
            <div className="flex min-w-[260px] flex-1 flex-col gap-1">
              <div className="flex items-center gap-2">
                <Barcode className="h-5 w-5 shrink-0 text-[#6b7280]" />
                <input
                  type="text"
                  value={codigoBarras}
                  onChange={(e) => onChangeCodigo(e, setCodigoBarras)}
                  onKeyDown={(e) => onKeyDownCodigo(e, setCodigoBarras)}
                  placeholder="Leitor de Código de Barras"
                  className={fieldClass}
                  autoComplete="off"
                />
              </div>
              {leitorUsbAtivo && (
                <p className="pl-7 text-[10px] font-medium text-emerald-600">Leitor USB detectado</p>
              )}
              {feedbackCodigo && (
                <p
                  className={cn(
                    "pl-7 text-[10px] font-medium",
                    feedbackCodigo.tipo === "ok" ? "text-emerald-600" : "text-red-600"
                  )}
                >
                  {feedbackCodigo.msg}
                </p>
              )}
            </div>
          </div>

          {!semOs ? (
            <div className="mt-3 overflow-hidden rounded-sm border border-[#d0d5dd]">
              <div className="max-h-[min(38vh,420px)] min-h-[220px] overflow-auto">
                <table className="w-full min-w-[1100px] border-collapse text-[12px]">
                  <thead className="sticky top-0 z-[1]">
                    <tr className="bg-[#f3f4f6] text-[11px] font-semibold uppercase text-[#6b7280]">
                      <th className="w-16 px-2 py-2.5 text-left">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={todasReceitaSelecionadas}
                            disabled={!form.clienteId || !form.situacaoOs || trabalhosParaReceita.length === 0}
                            ref={(el) => {
                              if (el) {
                                el.indeterminate =
                                  algumasReceitaSelecionadas && !todasReceitaSelecionadas;
                              }
                            }}
                            onChange={toggleSelecionarTodasReceita}
                            className="h-4 w-4 accent-[#4a90d9] disabled:opacity-40"
                          />
                          <span>Todos</span>
                        </div>
                      </th>
                      <th className="px-2 py-2.5 text-left">OS</th>
                      <th className="px-2 py-2.5 text-left">Entregue</th>
                      <th className="px-2 py-2.5 text-left">Qtd</th>
                      <th className="px-2 py-2.5 text-left">Serviço/Produto</th>
                      <th className="px-2 py-2.5 text-left">Dentista</th>
                      <th className="px-2 py-2.5 text-left">Paciente</th>
                      <th className="px-2 py-2.5 text-right">Valor</th>
                      <th className="px-2 py-2.5 text-left">Situação</th>
                      <th className="w-12 px-2 py-2.5 text-center">Opções</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!form.clienteId || !form.situacaoOs ? (
                      <tr>
                        <td
                          colSpan={10}
                          className="px-4 py-10 text-center text-[13px] text-[#9ca3af]"
                        >
                          Selecione um cliente e uma situação para listar as OS.
                        </td>
                      </tr>
                    ) : trabalhosParaReceita.length === 0 ? (
                      <tr>
                        <td
                          colSpan={10}
                          className="px-4 py-10 text-center text-[13px] text-[#9ca3af]"
                        >
                          Nenhuma OS encontrada para este cliente e situação.
                        </td>
                      </tr>
                    ) : (
                      trabalhosParaReceita.map((trabalho) => {
                        const selecionada = osSelecionadas.includes(trabalho.id);
                        const expandida = osExpandidaId === trabalho.id;
                        const det = detalhesLinhaReceitaOs(trabalho, money);
                        return (
                          <Fragment key={trabalho.id}>
                            <tr
                              onClick={() => toggleOsReceita(trabalho.id)}
                              className={cn(
                                "cursor-pointer border-t border-[#e5e7eb] transition-colors",
                                selecionada ? "bg-[#d4edda]" : "bg-white hover:bg-[#f9fafb]"
                              )}
                            >
                              <td
                                className="px-2 py-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={selecionada}
                                  onChange={() => toggleOsReceita(trabalho.id)}
                                  className="h-4 w-4 accent-[#28a745]"
                                />
                              </td>
                              <td className="px-2 py-2 font-medium text-[#374151]">
                                {trabalho.numeroOs}
                              </td>
                              <td className="px-2 py-2 text-[#374151]">{det.entregue}</td>
                              <td className="px-2 py-2 text-[#374151]">{det.qtd}</td>
                              <td className="px-2 py-2 text-[#374151]">{det.servico}</td>
                              <td className="px-2 py-2 text-[#374151]">{det.dentista}</td>
                              <td className="px-2 py-2 text-[#374151]">{det.paciente}</td>
                              <td className="px-2 py-2 text-right text-[#374151]">
                                {money(valorTrabalho(trabalho))}
                              </td>
                              <td className="px-2 py-2">
                                <SituacaoOsBadgeReceita trabalho={trabalho} />
                              </td>
                              <td
                                className="px-2 py-2 text-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  title="Modo visualização"
                                  aria-label="Modo visualização"
                                  aria-pressed={expandida}
                                  onClick={() =>
                                    setOsExpandidaId((id) =>
                                      id === trabalho.id ? null : trabalho.id
                                    )
                                  }
                                  className={cn(
                                    "inline-flex h-7 w-7 items-center justify-center rounded text-[#6b7280] hover:bg-white/70 hover:text-[#4a90d9]",
                                    expandida && "bg-white text-[#4a90d9]"
                                  )}
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                            {expandida ? (
                              <tr className="border-t border-[#e5e7eb] bg-[#f3f4f6]">
                                <td colSpan={10} className="px-4 py-3">
                                  <div className="grid gap-x-8 gap-y-1 text-[12px] text-[#374151] md:grid-cols-3">
                                    <div className="space-y-1">
                                      <p>
                                        <span className="font-semibold">O.S. Externa:</span>{" "}
                                        {det.osExterna}
                                      </p>
                                      <p>
                                        <span className="font-semibold">
                                          Data Prazo Laboratório:
                                        </span>{" "}
                                        {det.prazoLab}
                                      </p>
                                      <p>
                                        <span className="font-semibold">Valor Unitário:</span>{" "}
                                        {det.valorUnitario}
                                      </p>
                                      <p>
                                        <span className="font-semibold">
                                          Material enviado pelo Dentista:
                                        </span>{" "}
                                        {det.material}
                                      </p>
                                      <p>
                                        <span className="font-semibold">Observação Interna:</span>{" "}
                                        {det.observacaoInterna}
                                      </p>
                                    </div>
                                    <div className="space-y-1">
                                      <p>
                                        <span className="font-semibold">Número do Dente:</span>{" "}
                                        {det.numDente}
                                      </p>
                                      <p>
                                        <span className="font-semibold">Data Prazo Dentista:</span>{" "}
                                        {det.prazoDentista}
                                      </p>
                                      <p>
                                        <span className="font-semibold">Desconto:</span>{" "}
                                        {det.desconto}
                                      </p>
                                    </div>
                                    <div className="space-y-1">
                                      <p>
                                        <span className="font-semibold">Cor do Dente:</span>{" "}
                                        {det.corDente}
                                      </p>
                                      <p>
                                        <span className="font-semibold">
                                          Data Finalizada/Entregue:
                                        </span>{" "}
                                        {det.finalizado}
                                      </p>
                                      <p>
                                        <span className="font-semibold">Total:</span> {det.total}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div className="mt-3 flex w-full max-w-[420px] flex-col items-start gap-3 self-start">
            {creditoDisponivelSeguro > 0.009 ? (
              <ToggleSmart
                checked={abaterCredito}
                onChange={setAbaterCredito}
                label={`Abater do Crédito de ${currency(creditoDisponivelSeguro)}`}
              />
            ) : null}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <ToggleSmart
                checked={alterarEntregue}
                onChange={setAlterarEntregue}
                label="Alterar Situação para Entregue"
              />
              <ToggleSmart
                checked={enviarControleEntrega}
                onChange={setEnviarControleEntrega}
                label="Enviar Contas Originais"
              />
            </div>

            <div className="w-full max-w-[320px] space-y-0 text-[13px]">
              <div className="flex items-center justify-between border-b border-[#e8eaed] py-2">
                <span className="text-[#6b7280]">Valor Total</span>
                {semOs ? (
                  <input
                    type="text"
                    value={form.valor}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        valor: formatDecimalInput(e.target.value),
                      }))
                    }
                    className={cn(fieldClass, "h-8 max-w-[120px] text-right")}
                  />
                ) : (
                  <span className="font-medium text-[#374151]">{money(valorBrutoExibicao)}</span>
                )}
              </div>
              <div className="flex items-center justify-between border-b border-[#e8eaed] py-2">
                <span className="text-[#6b7280]">Desconto</span>
                <div className="flex overflow-hidden rounded-sm border border-[#d1d5db]">
                  <select
                    value={form.descontoTipo}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        descontoTipo: e.target.value,
                        desconto: e.target.value === "valor" ? "R$ 0,00" : "0,00",
                      }))
                    }
                    className="h-[30px] w-12 border-r border-[#d1d5db] bg-white text-center text-[12px] outline-none"
                  >
                    <option value="percentual">%</option>
                    <option value="valor">R$</option>
                  </select>
                  <input
                    type="text"
                    value={form.desconto}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        desconto:
                          f.descontoTipo === "valor"
                            ? formatCurrencyInput(e.target.value)
                            : formatDecimalInput(e.target.value),
                      }))
                    }
                    className="h-[30px] w-24 border-0 bg-white px-2 text-right text-[12px] outline-none"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-[14px] font-semibold text-[#4a90d9]">Total Líquido</span>
                <span className="text-[18px] font-bold text-[#4a90d9]">{currency(totalLiquido)}</span>
              </div>
              {abaterCredito && creditoAplicado > 0 ? (
                <>
                  <div className="flex items-center justify-between border-t border-[#e8eaed] py-2 text-emerald-700">
                    <span>Desconto com crédito</span>
                    <span>- {currency(creditoAplicado)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 font-semibold text-[#374151]">
                    <span>Total a cobrar</span>
                    <span>{currency(totalAReceberComCredito)}</span>
                  </div>
                </>
              ) : creditoDisponivelSeguro > 0.009 ? (
                <div className="flex items-center justify-between border-t border-[#e8eaed] py-2 font-semibold text-[#374151]">
                  <span>Total a cobrar</span>
                  <span>{currency(totalLiquido)}</span>
                </div>
              ) : null}
            </div>
          </div>

          <p className="mt-5 mb-2 text-center text-[13px] font-medium text-[#4a5568]">
            Escolha a(s) forma(s) de recebimento
          </p>

          {formaSelecionadaEhBoleto(parcelas) ? (
            <p className="mb-3 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-center text-[11px] text-amber-900">
              Com <strong>Boleto</strong>, o sistema emite um boleto no Asaas para cada
              parcela pendente (vencimentos mensais).
            </p>
          ) : null}

          {!pixAsaasDisponivel ? (
            <p className="mb-3 rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-center text-[11px] text-slate-600">
              <strong>Pix</strong> e <strong>Boleto Bancário</strong> ficam disponíveis após
              criar a conta digital Asaas (subconta) em Conta Bancária.
            </p>
          ) : null}

          {pixAsaasDisponivel &&
          parcelas.some((p) => (p.formaPagamento || "").trim().toLowerCase() === "pix") ? (
            <p className="mb-3 rounded-sm border border-sky-200 bg-sky-50 px-3 py-2 text-center text-[11px] text-sky-900">
              Com <strong>Pix</strong>, o sistema gera QR Code no Asaas (conta digital ou
              conta-mãe) ao cadastrar a cobrança pendente.
            </p>
          ) : null}

          {mensagemLancamento ? (
            <p
              role="alert"
              className={cn(
                "mb-3 rounded-sm px-3 py-2 text-center text-[11px]",
                mensagemLancamentoTipo === "erro"
                  ? "bg-red-50 text-red-700"
                  : "bg-emerald-50 text-emerald-800"
              )}
            >
              {mensagemLancamento}
            </p>
          ) : null}

          <div className="rounded-sm border border-[#7eb8da] bg-white p-3">
            <div className="mb-3">
              <span className="mb-1 block text-[11px] text-[#6b7280]">Parcelas</span>
              <div className="inline-flex overflow-hidden rounded-sm border border-[#7eb8da]">
                <button
                  type="button"
                  onClick={() => setNumParcelas((n) => Math.max(1, n - 1))}
                  className="inline-flex h-8 w-9 items-center justify-center border-r border-[#7eb8da] bg-white text-[#374151] hover:bg-[#f0f7fc]"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <input
                  type="text"
                  readOnly
                  value={String(numParcelas)}
                  className="h-8 w-12 border-0 bg-white text-center text-[13px] text-[#374151] outline-none"
                />
                <button
                  type="button"
                  onClick={() => setNumParcelas((n) => Math.min(24, n + 1))}
                  className="inline-flex h-8 w-9 items-center justify-center border-l border-[#7eb8da] bg-white text-[#374151] hover:bg-[#f0f7fc]"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              {algumaParcelaRecebida ? (
                <div className="mt-2">
                  <ToggleSmart
                    checked={imprimirRecibo}
                    onChange={setImprimirRecibo}
                    label="Imprimir Recibo"
                  />
                </div>
              ) : null}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] border-collapse text-[11px]">
                <thead>
                  <tr className="bg-[#f3f4f6] text-[10px] font-semibold uppercase tracking-wide text-[#4a5568]">
                    <th className="border border-[#7eb8da] px-2 py-2 text-left">Parcela</th>
                    <th className="border border-[#7eb8da] px-2 py-2 text-left">
                      Forma Recebimento
                    </th>
                    <th className="border border-[#7eb8da] px-2 py-2 text-left">Conta</th>
                    <th className="border border-[#7eb8da] px-2 py-2 text-left">Vencimento</th>
                    <th className="border border-[#7eb8da] px-2 py-2 text-left">Valor</th>
                    <th className="border border-[#7eb8da] px-2 py-2 text-left">Juros</th>
                    <th className="border border-[#7eb8da] px-2 py-2 text-center">Recebido</th>
                  </tr>
                </thead>
                <tbody>
                  {parcelas.map((p, index) => (
                    <tr key={index}>
                      <td className="border border-[#7eb8da] px-1.5 py-1.5 align-middle">
                        <input
                          type="text"
                          readOnly
                          value={p.parcela.replace("/", " / ")}
                          className="h-8 w-full rounded-sm border border-[#d1d5db] bg-white px-1 text-center text-[12px] outline-none"
                        />
                      </td>
                      <td className="border border-[#7eb8da] px-1.5 py-1.5 align-middle">
                        <SelectFormaRecebimentoAsaas
                          value={p.formaPagamento}
                          asaasDisponivel={pixAsaasDisponivel}
                          className="h-8 w-full rounded-sm border border-[#d1d5db] bg-white px-2 text-[12px] outline-none"
                          onChange={(formaPagamento) =>
                            atualizarParcela(index, { formaPagamento })
                          }
                        />
                      </td>
                      <td className="border border-[#7eb8da] px-1.5 py-1.5 align-middle">
                        <select
                          value={p.conta}
                          onChange={(e) => atualizarParcela(index, { conta: e.target.value })}
                          className="h-8 w-full rounded-sm border border-[#d1d5db] bg-white px-2 text-[12px] outline-none"
                        >
                          <option>Caixa Principal</option>
                          <option>Conta Bancária</option>
                        </select>
                      </td>
                      <td className="border border-[#7eb8da] px-1.5 py-1.5 align-middle">
                        <CampoDataBr
                          value={p.vencimento}
                          onChange={(v) => atualizarParcela(index, { vencimento: v })}
                          className="space-y-0"
                          inputClassName="h-8 w-full rounded-sm border border-[#d1d5db] bg-white px-2 text-[12px] outline-none"
                          calendarPosition="relative"
                        />
                      </td>
                      <td className="border border-[#7eb8da] px-1.5 py-1.5 align-middle">
                        <CampoMoedaOuPercentual
                          tipo={p.valorTipo}
                          valor={p.valor}
                          onTipoChange={(valorTipo) =>
                            atualizarParcela(index, {
                              valorTipo,
                              valor: valorTipo === "valor" ? "R$ 0,00" : "0,00",
                            })
                          }
                          onValorChange={(valor) => atualizarParcela(index, { valor })}
                          formatDecimalInput={formatDecimalInput}
                          formatCurrencyInput={formatCurrencyInput}
                          className="border-[#d1d5db]"
                        />
                      </td>
                      <td className="border border-[#7eb8da] px-1.5 py-1.5 align-middle">
                        <CampoMoedaOuPercentual
                          tipo={p.jurosTipo}
                          valor={p.juros}
                          onTipoChange={(jurosTipo) =>
                            atualizarParcela(index, {
                              jurosTipo,
                              juros: jurosTipo === "valor" ? "R$ 0,00" : "0,00",
                            })
                          }
                          onValorChange={(juros) => atualizarParcela(index, { juros })}
                          formatDecimalInput={formatDecimalInput}
                          formatCurrencyInput={formatCurrencyInput}
                          className="border-[#d1d5db]"
                        />
                      </td>
                      <td className="border border-[#7eb8da] px-1.5 py-1.5 text-center align-middle">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={p.recebido}
                          onClick={() => {
                            const recebido = !p.recebido;
                            atualizarParcela(index, { recebido });
                            if (!recebido) setImprimirRecibo(false);
                          }}
                          className={cn(
                            "relative mx-auto inline-flex h-5 w-9 rounded-full transition",
                            p.recebido ? "bg-[#4a90d9]" : "bg-[#cbd5e1]"
                          )}
                        >
                          <span
                            className={cn(
                              "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition",
                              p.recebido ? "left-[18px]" : "left-0.5"
                            )}
                          />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-3">
            <label className={labelClass}>Observações</label>
            <textarea
              value={form.observacoes}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
              rows={3}
              className="w-full rounded-sm border border-[#7eb8da] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]/60"
            />
          </div>

          <AnexosReciboCampo
            ref={anexosRef}
            pasta="receitas"
            className="mt-3"
          />
            </div>

            <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-[#e5e7eb] bg-white px-5 py-3">
              <button
                type="submit"
                disabled={ocupado}
                className="h-11 rounded-sm bg-[#4a90d9] text-[14px] font-normal text-white hover:bg-[#3d7fc4] disabled:cursor-wait disabled:opacity-60"
              >
                {ocupado ? "Cadastrando…" : "Cadastrar"}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={ocupado}
                className="h-11 rounded-sm border border-[#d1d5db] bg-white text-[14px] font-normal text-[#374151] hover:bg-[#f9fafb] disabled:opacity-50"
              >
                Fechar
              </button>
            </div>
          </form>
        </div>
      </div>
    </I18nPortal>,
    document.body
  );
}
