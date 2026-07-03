"use client";

import dynamic from "next/dynamic";

function CarregandoAbaFinanceiro() {
  return <p className="p-4 text-sm text-slate-500">Carregando...</p>;
}

/** Abas do Financeiro — carregadas sob demanda conforme a rota (?aba= / ?tipo=). */
export const ContasPagarConteudoLazy = dynamic(
  () =>
    import("@/components/financeiro/ContasPagarConteudo").then(
      (mod) => mod.ContasPagarConteudo
    ),
  { loading: CarregandoAbaFinanceiro }
);

export const ControleBoletosConteudoLazy = dynamic(
  () =>
    import("@/components/financeiro/ControleBoletosConteudo").then(
      (mod) => mod.ControleBoletosConteudo
    ),
  { loading: CarregandoAbaFinanceiro }
);

export const ContaBancariaConteudoLazy = dynamic(
  () =>
    import("@/components/financeiro/ContaBancariaConteudo").then(
      (mod) => mod.ContaBancariaConteudo
    ),
  { loading: CarregandoAbaFinanceiro }
);

export const ContaDigitalConteudoLazy = dynamic(
  () =>
    import("@/components/financeiro/ContaDigitalConteudo").then(
      (mod) => mod.ContaDigitalConteudo
    ),
  { loading: CarregandoAbaFinanceiro }
);

export const PlanoContasConteudoLazy = dynamic(
  () =>
    import("@/components/financeiro/PlanoContasConteudo").then(
      (mod) => mod.PlanoContasConteudo
    ),
  { loading: CarregandoAbaFinanceiro }
);

/** Modais da aba Contas a Receber — chunk separado; montar só quando `open`. */
export const RelatorioContasReceberModalLazy = dynamic(
  () =>
    import("@/components/financeiro/RelatorioContasReceberModal").then(
      (mod) => mod.RelatorioContasReceberModal
    ),
  { ssr: false }
);

export const ServicosNaoFaturadosModalLazy = dynamic(
  () =>
    import("@/components/financeiro/ServicosNaoFaturadosModal").then(
      (mod) => mod.ServicosNaoFaturadosModal
    ),
  { ssr: false }
);

export const LancarReceitaOsModalLazy = dynamic(
  () =>
    import("@/components/financeiro/LancarReceitaOsModal").then(
      (mod) => mod.LancarReceitaOsModal
    ),
  { ssr: false }
);

export const ImprimirReciboModalLazy = dynamic(
  () =>
    import("@/components/financeiro/ImprimirReciboModal").then(
      (mod) => mod.ImprimirReciboModal
    ),
  { ssr: false }
);

export const LancarRecebimentoModalLazy = dynamic(
  () =>
    import("@/components/financeiro/LancarRecebimentoModal").then(
      (mod) => mod.LancarRecebimentoModal
    ),
  { ssr: false }
);

export const ImprimirFaturaModalLazy = dynamic(
  () =>
    import("@/components/financeiro/ImprimirFaturaModal").then(
      (mod) => mod.ImprimirFaturaModal
    ),
  { ssr: false }
);

export const ItensFaturaModalLazy = dynamic(
  () =>
    import("@/components/financeiro/ItensFaturaModal").then((mod) => mod.ItensFaturaModal),
  { ssr: false }
);

export const VisualizacaoClienteReceberModalLazy = dynamic(
  () =>
    import("@/components/financeiro/VisualizacaoClienteReceberModal").then(
      (mod) => mod.VisualizacaoClienteReceberModal
    ),
  { ssr: false }
);

export const ConfirmacaoExclusaoModalLazy = dynamic(
  () =>
    import("@/components/ConfirmacaoExclusaoModal").then(
      (mod) => mod.ConfirmacaoExclusaoModal
    ),
  { ssr: false }
);
