"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import type { TipoMensagemForm } from "@/components/DadosLaboratorioForm";
import {
  carregarConfiguracoesGerais,
  persistirConfiguracoesGeraisServidor,
  salvarConfiguracoesGerais,
  sincronizarConfiguracoesGeraisDoServidor,
  type ConfiguracoesGerais,
} from "@/lib/configuracoes-gerais";
import { cn } from "@/lib/utils";

type Props = {
  onMensagem?: (texto: string, tipo?: TipoMensagemForm) => void;
};

function CardSecao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-200 bg-[#f5f6f8] px-4 py-2.5">
        <h3 className="text-[13px] font-semibold text-slate-700">{titulo}</h3>
      </header>
      <div className="divide-y divide-slate-100">{children}</div>
    </section>
  );
}

function LinhaOpcao({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 px-4 py-3.5 text-[12px] leading-snug text-slate-700 hover:bg-slate-50/80">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-[#4a90d9]"
      />
      <span className="flex flex-wrap items-center gap-1.5">{children}</span>
    </label>
  );
}

function BadgeStatus({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant: "entregue" | "prova";
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded px-2 py-0.5 text-[11px] font-semibold leading-none text-white",
        variant === "entregue" ? "bg-[#5cb85c]" : "bg-[#f0ad4e]"
      )}
    >
      {children}
    </span>
  );
}

export function ConfiguracoesGeraisTab({ onMensagem }: Props) {
  const [config, setConfig] = useState<ConfiguracoesGerais>(() =>
    carregarConfiguracoesGerais()
  );
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    void sincronizarConfiguracoesGeraisDoServidor().then((cfg) => {
      if (ativo) {
        setConfig(cfg);
        setCarregando(false);
      }
    });
    return () => {
      ativo = false;
    };
  }, []);

  function patch(partial: Partial<ConfiguracoesGerais>) {
    setConfig((atual) => ({ ...atual, ...partial }));
  }

  async function salvar() {
    setSalvando(true);
    salvarConfiguracoesGerais(config);
    try {
      await persistirConfiguracoesGeraisServidor(config);
      onMensagem?.("Alterações salvas com sucesso.", "sucesso");
    } catch {
      onMensagem?.(
        "Salvo neste navegador, mas não foi possível gravar no servidor. Tente novamente.",
        "erro"
      );
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return <p className="py-8 text-center text-sm text-slate-500">Carregando…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <CardSecao titulo="Faturas">
            <LinhaOpcao
              checked={config.faturasAlterarSituacaoEntregue}
              onChange={(v) => patch({ faturasAlterarSituacaoEntregue: v })}
            >
              <span>Alterar Situação para</span>
              <BadgeStatus variant="entregue">Entregue</BadgeStatus>
            </LinhaOpcao>
            <LinhaOpcao
              checked={config.faturasAdicionarControleEntregas}
              onChange={(v) => patch({ faturasAdicionarControleEntregas: v })}
            >
              Adicionar automaticamente ao Controle de Entregas
            </LinhaOpcao>
          </CardSecao>

          <CardSecao titulo="Financeiro">
            <LinhaOpcao
              checked={config.financeiroEmitirNfseAoReceber}
              onChange={(v) => patch({ financeiroEmitirNfseAoReceber: v })}
            >
              Emitir Nota Fiscal ao Lançar Recebimento
            </LinhaOpcao>
          </CardSecao>
        </div>

        <CardSecao titulo="Produção">
          <LinhaOpcao
            checked={config.producaoExcluirCaixaAoProva}
            onChange={(v) => patch({ producaoExcluirCaixaAoProva: v })}
          >
            <span>Excluir caixa organizadora ao mudar para</span>
            <BadgeStatus variant="prova">Prova</BadgeStatus>
          </LinhaOpcao>
          <LinhaOpcao
            checked={config.producaoExcluirCaixaAoEntregue}
            onChange={(v) => patch({ producaoExcluirCaixaAoEntregue: v })}
          >
            <span>Excluir caixa organizadora ao mudar para</span>
            <BadgeStatus variant="entregue">Entregue</BadgeStatus>
          </LinhaOpcao>
          <LinhaOpcao
            checked={config.producaoPermitirAlterarDataEntrega}
            onChange={(v) => patch({ producaoPermitirAlterarDataEntrega: v })}
          >
            Permitir alteração &apos;Data Entrega / Finalizado&apos;
          </LinhaOpcao>
          <LinhaOpcao
            checked={config.producaoEtapaExigeAnteriorFinalizada}
            onChange={(v) => patch({ producaoEtapaExigeAnteriorFinalizada: v })}
          >
            Permitir início de uma Etapa, somente se a anterior estiver Finalizada
          </LinhaOpcao>
        </CardSecao>
      </div>

      <Button
        type="button"
        disabled={salvando}
        onClick={() => void salvar()}
        className="h-11 w-full rounded bg-[#4a90d9] text-[14px] font-normal text-white hover:bg-[#3d7fc4] disabled:opacity-60"
      >
        {salvando ? "Salvando…" : "Salvar Alterações"}
      </Button>
    </div>
  );
}
