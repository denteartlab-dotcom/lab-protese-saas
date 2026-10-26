type EstiloFonte = "sans" | "serif" | "mono" | "script";

/** id, nome exibido, estilo, 1 = aparece em "Fontes do tema". */
const LINHAS_FONTE = [
  ["calibri-light", "Calibri Light", "sans", 1],
  ["calibri", "Calibri", "sans", 1],
  ["cambria", "Cambria", "serif", 1],
  ["arial", "Arial", "sans", 1],
  ["times", "Times New Roman", "serif", 1],
  ["georgia", "Georgia", "serif", 1],
  ["verdana", "Verdana", "sans", 1],
  ["tahoma", "Tahoma", "sans", 1],
  ["courier", "Courier New", "mono", 1],
  ["segoe-ui", "Segoe UI", "sans", 1],
  ["trebuchet-ms", "Trebuchet MS", "sans", 1],
  ["comic-sans-ms", "Comic Sans MS", "sans", 1],
  ["impact", "Impact", "sans", 1],
  ["garamond", "Garamond", "serif", 1],
  ["palatino-linotype", "Palatino Linotype", "serif", 1],
  ["agency-fb", "Agency FB", "sans", 0],
  ["algerian", "Algerian", "sans", 0],
  ["arial-black", "Arial Black", "sans", 0],
  ["arial-narrow", "Arial Narrow", "sans", 0],
  ["arial-rounded-mt-bold", "Arial Rounded MT Bold", "sans", 0],
  ["bahnschrift", "Bahnschrift", "sans", 0],
  ["bahnschrift-condensed", "Bahnschrift Condensed", "sans", 0],
  ["bahnschrift-light", "Bahnschrift Light", "sans", 0],
  ["bahnschrift-light-condensed", "Bahnschrift Light Condensed", "sans", 0],
  ["bahnschrift-semibold", "Bahnschrift SemiBold", "sans", 0],
  ["bahnschrift-semibold-semicondensed", "Bahnschrift SemiBold SemiCondensed", "sans", 0],
  ["bahnschrift-semicondensed", "Bahnschrift SemiCondensed", "sans", 0],
  ["bahnschrift-semilight", "Bahnschrift SemiLight", "sans", 0],
  ["bahnschrift-semilight-condensed", "Bahnschrift SemiLight Condensed", "sans", 0],
  ["baskerville-old-face", "Baskerville Old Face", "serif", 0],
  ["bauhaus-93", "Bauhaus 93", "sans", 0],
  ["bell-mt", "Bell MT", "serif", 0],
  ["berlin-sans-fb", "Berlin Sans FB", "sans", 0],
  ["bernard-mt-condensed", "Bernard MT Condensed", "serif", 0],
  ["book-antiqua", "Book Antiqua", "serif", 0],
  ["bookman-old-style", "Bookman Old Style", "serif", 0],
  ["bradley-hand-itc", "Bradley Hand ITC", "script", 0],
  ["britannic-bold", "Britannic Bold", "sans", 0],
  ["broadway", "Broadway", "sans", 0],
  ["brush-script-mt", "Brush Script MT", "script", 0],
  ["californian-fb", "Californian FB", "serif", 0],
  ["calisto-mt", "Calisto MT", "serif", 0],
  ["candara", "Candara", "sans", 0],
  ["century", "Century", "serif", 0],
  ["century-gothic", "Century Gothic", "sans", 0],
  ["century-schoolbook", "Century Schoolbook", "serif", 0],
  ["colonna-mt", "Colonna MT", "serif", 0],
  ["consolas", "Consolas", "mono", 0],
  ["constantia", "Constantia", "serif", 0],
  ["cooper-black", "Cooper Black", "serif", 0],
  ["corbel", "Corbel", "sans", 0],
  ["curlz-mt", "Curlz MT", "script", 0],
  ["edwardian-script-itc", "Edwardian Script ITC", "script", 0],
  ["elephant", "Elephant", "serif", 0],
  ["engravers-mt", "Engravers MT", "serif", 0],
  ["eras-bold-itc", "Eras Bold ITC", "sans", 0],
  ["eras-medium-itc", "Eras Medium ITC", "sans", 0],
  ["felix-titling", "Felix Titling", "serif", 0],
  ["footlight-mt-light", "Footlight MT Light", "serif", 0],
  ["forte", "Forte", "script", 0],
  ["franklin-gothic-book", "Franklin Gothic Book", "sans", 0],
  ["franklin-gothic-medium", "Franklin Gothic Medium", "sans", 0],
  ["freestyle-script", "Freestyle Script", "script", 0],
  ["french-script-mt", "French Script MT", "script", 0],
  ["gabriola", "Gabriola", "script", 0],
  ["gigi", "Gigi", "script", 0],
  ["gill-sans-mt", "Gill Sans MT", "sans", 0],
  ["gill-sans-ultra-bold", "Gill Sans Ultra Bold", "sans", 0],
  ["gloucester-mt-extra-condensed", "Gloucester MT Extra Condensed", "serif", 0],
  ["goudy-old-style", "Goudy Old Style", "serif", 0],
  ["goudy-stout", "Goudy Stout", "serif", 0],
  ["haettenschweiler", "Haettenschweiler", "sans", 0],
  ["harlow-solid-italic", "Harlow Solid Italic", "script", 0],
  ["harrington", "Harrington", "script", 0],
  ["helvetica", "Helvetica", "sans", 0],
  ["high-tower-text", "High Tower Text", "serif", 0],
  ["imprint-mt-shadow", "Imprint MT Shadow", "serif", 0],
  ["informal-roman", "Informal Roman", "serif", 0],
  ["jokerman", "Jokerman", "sans", 0],
  ["juice-itc", "Juice ITC", "sans", 0],
  ["kristen-itc", "Kristen ITC", "script", 0],
  ["kunstler-script", "Kunstler Script", "script", 0],
  ["lucida-bright", "Lucida Bright", "serif", 0],
  ["lucida-calligraphy", "Lucida Calligraphy", "script", 0],
  ["lucida-console", "Lucida Console", "mono", 0],
  ["lucida-fax", "Lucida Fax", "serif", 0],
  ["lucida-handwriting", "Lucida Handwriting", "script", 0],
  ["lucida-sans", "Lucida Sans", "sans", 0],
  ["lucida-sans-unicode", "Lucida Sans Unicode", "sans", 0],
  ["magneto", "Magneto", "sans", 0],
  ["maiandra-gd", "Maiandra GD", "sans", 0],
  ["matura-mt-script-capitals", "Matura MT Script Capitals", "script", 0],
  ["mistral", "Mistral", "script", 0],
  ["modern-no-20", "Modern No. 20", "serif", 0],
  ["monotype-corsiva", "Monotype Corsiva", "script", 0],
  ["niagara-engraved", "Niagara Engraved", "sans", 0],
  ["niagara-solid", "Niagara Solid", "sans", 0],
  ["ocr-a-extended", "OCR A Extended", "mono", 0],
  ["old-english-text-mt", "Old English Text MT", "serif", 0],
  ["onyx", "Onyx", "serif", 0],
  ["papyrus", "Papyrus", "sans", 0],
  ["parchment", "Parchment", "script", 0],
  ["perpetua", "Perpetua", "serif", 0],
  ["playbill", "Playbill", "sans", 0],
  ["poor-richard", "Poor Richard", "serif", 0],
  ["pristina", "Pristina", "script", 0],
  ["rage-italic", "Rage Italic", "script", 0],
  ["ravie", "Ravie", "sans", 0],
  ["rockwell", "Rockwell", "serif", 0],
  ["rockwell-condensed", "Rockwell Condensed", "serif", 0],
  ["rockwell-extra-bold", "Rockwell Extra Bold", "serif", 0],
  ["script-mt-bold", "Script MT Bold", "script", 0],
  ["segoe-print", "Segoe Print", "script", 0],
  ["segoe-script", "Segoe Script", "script", 0],
  ["segoe-ui-black", "Segoe UI Black", "sans", 0],
  ["segoe-ui-light", "Segoe UI Light", "sans", 0],
  ["showcard-gothic", "Showcard Gothic", "sans", 0],
  ["snap-itc", "Snap ITC", "sans", 0],
  ["stencil", "Stencil", "sans", 0],
  ["sylfaen", "Sylfaen", "serif", 0],
  ["tempus-sans-itc", "Tempus Sans ITC", "sans", 0],
  ["tw-cen-mt", "Tw Cen MT", "sans", 0],
  ["viner-hand-itc", "Viner Hand ITC", "script", 0],
  ["vivaldi", "Vivaldi", "script", 0],
  ["vladimir-script", "Vladimir Script", "script", 0],
  ["wide-latin", "Wide Latin", "serif", 0],
] as const;

export type FonteImpressao = (typeof LINHAS_FONTE)[number][0];
export type FamiliaPdfFonte = "helvetica" | "times" | "courier";

export type DefinicaoFonteImpressao = {
  id: FonteImpressao;
  nome: string;
  css: string;
  pdf: FamiliaPdfFonte;
  tema: boolean;
};

function cssDaFonte(nome: string, estilo: EstiloFonte): string {
  const familia = `"${nome}"`;
  if (estilo === "serif") return `${familia}, "Times New Roman", Times, serif`;
  if (estilo === "mono") return `${familia}, "Courier New", Courier, monospace`;
  if (estilo === "script") return `${familia}, "Segoe Script", cursive`;
  return `${familia}, Arial, Helvetica, sans-serif`;
}

function pdfDaFonte(estilo: EstiloFonte): FamiliaPdfFonte {
  if (estilo === "mono") return "courier";
  if (estilo === "serif" || estilo === "script") return "times";
  return "helvetica";
}

export const CATALOGO_FONTES_IMPRESSAO: DefinicaoFonteImpressao[] = LINHAS_FONTE.map(
  ([id, nome, estilo, tema]) => ({
    id,
    nome,
    css: cssDaFonte(nome, estilo),
    pdf: pdfDaFonte(estilo),
    tema: tema === 1,
  })
);

const POR_ID = new Map(CATALOGO_FONTES_IMPRESSAO.map((fonte) => [fonte.id, fonte]));

export const FONTES_IMPRESSAO: readonly FonteImpressao[] = CATALOGO_FONTES_IMPRESSAO.map(
  (fonte) => fonte.id
);

const FONTE_PADRAO = POR_ID.get("arial")!;

export function fonteImpressaoValida(valor: unknown): valor is FonteImpressao {
  return typeof valor === "string" && POR_ID.has(valor as FonteImpressao);
}

export function normalizarFonteImpressao(valor: unknown): FonteImpressao {
  return fonteImpressaoValida(valor) ? valor : "arial";
}

export function definicaoFonteImpressao(valor: unknown): DefinicaoFonteImpressao {
  if (fonteImpressaoValida(valor)) return POR_ID.get(valor)!;
  return FONTE_PADRAO;
}

export function nomeFonteImpressao(valor: unknown): string {
  return definicaoFonteImpressao(valor).nome;
}

export function cssFonteImpressao(valor: unknown): string {
  return definicaoFonteImpressao(valor).css;
}

export function fontesDoTema(): DefinicaoFonteImpressao[] {
  return CATALOGO_FONTES_IMPRESSAO.filter((fonte) => fonte.tema);
}

export function fontesOrdenadas(): DefinicaoFonteImpressao[] {
  return [...CATALOGO_FONTES_IMPRESSAO].sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
}

export function cssRegrasFonteImpressao(): string {
  return CATALOGO_FONTES_IMPRESSAO.map((fonte) => {
    return `.fonte-${fonte.id}, .fonte-${fonte.id} p { font-family: ${fonte.css}; }`;
  }).join("\n");
}

/** jsPDF só traz Helvetica, Times e Courier. As outras fontes de tela usam a mais próxima. */
export function fontePdfImpressao(valor: unknown): FamiliaPdfFonte {
  return definicaoFonteImpressao(valor).pdf;
}

type PdfComFonte = {
  setFont: (nome?: string, estilo?: string, peso?: string | number) => unknown;
};

const fontesPadraoPdf = new Set(["helvetica", "times", "courier"]);

const origemSetFont = new WeakMap<object, PdfComFonte["setFont"]>();
const escolhaFontePdf = new WeakMap<object, { destino: FamiliaPdfFonte; script: boolean }>();

function estiloFontePdf(script: boolean, estilo?: string) {
  if (!script) return estilo;
  if (!estilo || estilo === "normal") return "italic";
  if (estilo === "bold") return "bolditalic";
  return estilo;
}

/**
 * Troca a família do PDF pela fonte escolhida na configuração.
 * Helvetica/Times/Courier escritos no desenho passam a usar essa família,
 * inclusive negrito. Fontes manuscritas saem em Times itálico.
 */
export function usarFonteNoPdf(pdf: PdfComFonte, fonte: unknown) {
  const definicao = definicaoFonteImpressao(fonte);
  const chave = pdf as object;
  escolhaFontePdf.set(chave, {
    destino: definicao.pdf,
    script: definicao.css.includes("cursive"),
  });
  if (!origemSetFont.has(chave)) {
    const original = pdf.setFont.bind(pdf);
    origemSetFont.set(chave, original);
    pdf.setFont = (nome?: string, estilo?: string, peso?: string | number) => {
      const escolha = escolhaFontePdf.get(chave);
      const destino = escolha?.destino ?? "helvetica";
      const pedido = (nome || "").toLowerCase();
      const familia =
        !nome || fontesPadraoPdf.has(pedido) ? destino : nome;
      const estiloFinal = estiloFontePdf(Boolean(escolha?.script), estilo);
      if (peso != null && peso !== "") return original(familia, estiloFinal, peso);
      return original(familia, estiloFinal);
    };
  }
  pdf.setFont(definicao.pdf, "normal");
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
