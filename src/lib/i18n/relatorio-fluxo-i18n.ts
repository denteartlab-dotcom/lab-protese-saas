import type { MessageKey } from "@/lib/i18n";
import {
  FORMA_PAGAMENTO_PLACEHOLDER,
  FORMA_PAGAMENTO_TODOS,
} from "@/lib/formas-pagamento";
import type { LinhaMatrizFluxoMensal } from "@/lib/fluxo-de-caixa";
import { trUi, type TradutorUi } from "@/lib/i18n/tr-ui";

const CHAVES_LINHA_FLUXO: Record<LinhaMatrizFluxoMensal["id"], MessageKey> = {
  saldo_inicial: "relatorio.fluxo.linha.saldoInicial",
  entradas: "relatorio.fluxo.linha.entradas",
  saidas: "relatorio.fluxo.linha.saidas",
  saldo_final: "relatorio.fluxo.linha.saldoFinal",
};

/** Normaliza texto para lookup (sem acentos, minúsculas). */
function chaveFormaPagamento(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const CHAVES_FORMA_PAGAMENTO: Record<string, MessageKey> = {
  [chaveFormaPagamento("Boleto Bancário")]: "relatorio.fluxo.forma.boletoBancario",
  [chaveFormaPagamento("Cartão de Crédito")]: "relatorio.fluxo.forma.cartaoCredito",
  [chaveFormaPagamento("Cartão de Débito")]: "relatorio.fluxo.forma.cartaoDebito",
  [chaveFormaPagamento("Cheque")]: "relatorio.fluxo.forma.cheque",
  [chaveFormaPagamento("Depósito Bancário")]: "relatorio.fluxo.forma.depositoBancario",
  [chaveFormaPagamento("Dinheiro")]: "relatorio.fluxo.forma.dinheiro",
  [chaveFormaPagamento("Pix")]: "relatorio.fluxo.forma.pix",
  [chaveFormaPagamento("Pix externo")]: "relatorio.fluxo.forma.pixExterno",
  [chaveFormaPagamento("Transferência Bancária")]:
    "relatorio.fluxo.forma.transferenciaBancaria",
  [chaveFormaPagamento("Outros")]: "relatorio.fluxo.forma.outros",
  [chaveFormaPagamento("Abatimento de Crédito")]:
    "relatorio.fluxo.forma.abatimentoCredito",
  [chaveFormaPagamento("Movimentação")]: "relatorio.fluxo.forma.movimentacao",
};

const CHAVES_CONTA_PADRAO: Record<string, MessageKey> = {
  [chaveFormaPagamento("Caixa Principal")]: "relatorio.fluxo.conta.caixaPrincipal",
};

export function labelLinhaFluxoMensal(t: TradutorUi, id: LinhaMatrizFluxoMensal["id"]) {
  return t(CHAVES_LINHA_FLUXO[id]);
}

/** Rótulo exibido nas opções do select de forma de pagamento (value permanece em PT). */
export function labelOpcaoFormaPagamentoFluxo(t: TradutorUi, value: string) {
  const v = (value || "").trim();
  if (!v || v === FORMA_PAGAMENTO_PLACEHOLDER) {
    return t("relatorio.fluxo.opcao.todasFormasPagamento");
  }
  if (v === FORMA_PAGAMENTO_TODOS) {
    return t("relatorio.opcao.todos");
  }
  return traduzirFormaPagamentoFluxo(t, v);
}

export function traduzirContaFluxo(t: TradutorUi, conta: string) {
  const c = (conta || "").trim();
  if (!c) return c;
  const chave = CHAVES_CONTA_PADRAO[chaveFormaPagamento(c)];
  if (chave) return t(chave);
  return trUi(c, t);
}

export function traduzirDescricaoFluxo(t: TradutorUi, descricao: string): string {
  const d = (descricao || "").trim();
  if (!d) return d;

  if (d === "Saldo Inicial") return t("relatorio.fluxo.linha.saldoInicial");

  const cobrancaLista = /^cobrança os\s+([\d]+(?:\s*,\s*[\d]+)*)/i.exec(d);
  if (cobrancaLista) {
    const numeros = cobrancaLista[1].replace(/\s/g, "");
    return t("relatorio.fluxo.descricao.cobrancaOsLista", { os: numeros });
  }

  const cobranca = /^cobrança os\s+(\d+)/i.exec(d);
  if (cobranca) {
    return t("relatorio.fluxo.descricao.cobrancaOs", { os: cobranca[1] });
  }

  const osHash = /^os\s*#\s*(\d+)/i.exec(d);
  if (osHash) {
    return t("relatorio.fluxo.descricao.osHash", { os: osHash[1] });
  }

  const prefixo = d.split(" - ")[0]?.trim() || d;
  const norm = chaveFormaPagamento(prefixo);

  if (norm.startsWith("pag parcel")) {
    const detalhe = d.includes(" - ") ? d.split(" - ").slice(1).join(" - ").trim() : "";
    if (detalhe) {
      return t("relatorio.fluxo.descricao.pagParcelDetalhe", {
        detalhe: traduzirDescricaoFluxo(t, detalhe),
      });
    }
    return t("relatorio.fluxo.descricao.pagParcel");
  }

  if (norm.startsWith("adiantamento")) {
    if (/crédito cliente|credito cliente/i.test(d)) {
      return t("relatorio.fluxo.descricao.adiantamentoCreditoCliente");
    }
    return t("relatorio.fluxo.descricao.adiantamento");
  }

  if (norm.startsWith("desconto com credito")) {
    return t("relatorio.fluxo.descricao.descontoCredito");
  }

  if (norm.startsWith("credito utilizado")) {
    return t("relatorio.fluxo.descricao.creditoUtilizado");
  }

  return trUi(d, t);
}

export function traduzirFormaPagamentoFluxo(t: TradutorUi, forma: string) {
  const f = (forma || "").trim();
  if (!f || f === "—") return f;

  const chave = CHAVES_FORMA_PAGAMENTO[chaveFormaPagamento(f)];
  if (chave) return t(chave);

  return trUi(f, t);
}
