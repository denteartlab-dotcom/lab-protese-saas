export const FONTES_IMPRESSAO = [
  "arial",
  "times",
  "courier",
  "georgia",
  "verdana",
  "tahoma",
] as const;

export type FonteImpressao = (typeof FONTES_IMPRESSAO)[number];

export function fonteImpressaoValida(valor: unknown): valor is FonteImpressao {
  return FONTES_IMPRESSAO.includes(valor as FonteImpressao);
}

export function normalizarFonteImpressao(valor: unknown): FonteImpressao {
  return fonteImpressaoValida(valor) ? valor : "arial";
}

export function cssFonteImpressao(valor: unknown): string {
  switch (normalizarFonteImpressao(valor)) {
    case "times":
      return '"Times New Roman", Times, serif';
    case "courier":
      return '"Courier New", Courier, monospace';
    case "georgia":
      return 'Georgia, "Times New Roman", serif';
    case "verdana":
      return "Verdana, Geneva, sans-serif";
    case "tahoma":
      return "Tahoma, Geneva, sans-serif";
    default:
      return "Arial, Helvetica, sans-serif";
  }
}

/** jsPDF só traz Helvetica, Times e Courier. As outras fontes de tela usam a mais próxima. */
export function fontePdfImpressao(valor: unknown): "helvetica" | "times" | "courier" {
  const fonte = normalizarFonteImpressao(valor);
  if (fonte === "times" || fonte === "georgia") return "times";
  if (fonte === "courier") return "courier";
  return "helvetica";
}

export function usarFonteNoPdf(
  pdf: { setFont: (nome: string, estilo?: string) => void },
  fonte: unknown
) {
  const destino = fontePdfImpressao(fonte);
  const original = pdf.setFont.bind(pdf);
  pdf.setFont = (nome: string, estilo?: string) => {
    const padrao = nome === "helvetica" || nome === "times" || nome === "courier";
    original(padrao ? destino : nome, estilo);
  };
}

function adicionarCampo(lista: string[], vistos: Set<string>, valor: string | null) {
  if (!valor || vistos.has(valor)) return;
  vistos.add(valor);
  lista.push(valor);
}

/** Lê os trechos marcados com data-campo. Sem essa marca, devolve "pagina" se houver seleção. */
export function camposDaSelecao(documento: Document, evento?: Event): string[] {
  const selecao = documento.getSelection?.() ?? null;
  const campos: string[] = [];
  const vistos = new Set<string>();
  if (selecao && selecao.rangeCount > 0 && !selecao.isCollapsed) {
    const faixa = selecao.getRangeAt(0);
    documento.querySelectorAll("[data-campo]").forEach((node) => {
      if (typeof faixa.intersectsNode === "function" && faixa.intersectsNode(node)) {
        adicionarCampo(campos, vistos, node.getAttribute("data-campo"));
      }
    });
    if (campos.length === 0 && String(selecao).trim()) adicionarCampo(campos, vistos, "pagina");
  }
  if (campos.length === 0 && evento) {
    const alvo = evento.target as { closest?: (seletor: string) => { getAttribute(nome: string): string | null } | null } | null;
    const marcado = alvo?.closest?.("[data-campo]");
    if (marcado) adicionarCampo(campos, vistos, marcado.getAttribute("data-campo"));
  }
  return campos;
}

export function ligarSelecaoTexto(
  documento: Document,
  aoEscolher: (campos: string[]) => void
) {
  const aoSoltar = (evento: Event) => {
    const campos = camposDaSelecao(documento, evento);
    if (campos.length) aoEscolher(campos);
  };
  const aoMudarSelecao = () => {
    const campos = camposDaSelecao(documento);
    if (campos.length) aoEscolher(campos);
  };
  documento.addEventListener("mouseup", aoSoltar);
  documento.addEventListener("selectionchange", aoMudarSelecao);
  return () => {
    documento.removeEventListener("mouseup", aoSoltar);
    documento.removeEventListener("selectionchange", aoMudarSelecao);
  };
}
