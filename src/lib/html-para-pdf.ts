import type { jsPDF } from "jspdf";

export type FormatoHtmlPdf = "a4" | "termica";

/** Largura A4 em px (96dpi) — igual ao preview em Configurações. */
const A4_LARGURA_PX = Math.round((210 / 25.4) * 96);

function aguardarImagens(doc: Document) {
  const imagens = Array.from(doc.images);
  if (!imagens.length) return Promise.resolve();
  return Promise.all(
    imagens.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) resolve();
          else {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }
        })
    )
  ).then(() => undefined);
}

function aguardarLayout() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/** Remove botões do visualizador — não devem ir para o PDF. */
function htmlLimpoParaPdf(html: string) {
  return html.replace(/<div class="actions">[\s\S]*?<\/div>\s*/g, "");
}

function montarIframeHtml(html: string, formato: FormatoHtmlPdf) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "Gerar PDF");
  iframe.style.cssText =
    "position:fixed;left:-12000px;top:0;border:0;visibility:hidden;pointer-events:none;";
  iframe.style.width = formato === "termica" ? "80mm" : `${A4_LARGURA_PX}px`;
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    throw new Error("Não foi possível preparar o documento para PDF.");
  }

  doc.open();
  doc.write(htmlLimpoParaPdf(html));
  doc.close();

  return { iframe, doc };
}

function prepararElementoParaCaptura(el: HTMLElement, doc: Document) {
  el.style.minHeight = "auto";
  el.style.height = "auto";
  el.style.maxHeight = "none";
  el.style.boxShadow = "none";
  el.style.margin = "0 auto";
  doc.documentElement.style.background = "#ffffff";
  doc.body.style.background = "#ffffff";
  doc.body.style.margin = "0";
  doc.body.style.padding = "0";
}

/** Mantém largura total da página; quebra em várias páginas quando necessário. */
function adicionarCanvasNoPdf(pdf: jsPDF, canvas: HTMLCanvasElement) {
  const larguraPdf = pdf.internal.pageSize.getWidth();
  const alturaPdf = pdf.internal.pageSize.getHeight();
  const alturaImagem = (canvas.height * larguraPdf) / canvas.width;
  const imgData = canvas.toDataURL("image/jpeg", 0.95);
  const limiarMm = 4;

  if (alturaImagem <= alturaPdf + 0.5) {
    pdf.addImage(imgData, "JPEG", 0, 0, larguraPdf, alturaImagem);
    return;
  }

  let posicaoY = 0;
  pdf.addImage(imgData, "JPEG", 0, posicaoY, larguraPdf, alturaImagem);
  let restante = alturaImagem - alturaPdf;

  while (restante > limiarMm) {
    posicaoY -= alturaPdf;
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, posicaoY, larguraPdf, alturaImagem);
    restante -= alturaPdf;
  }
}

function alturaPdfTermicaMm(alturaImagemMm: number) {
  return Math.min(Math.max(Math.ceil(alturaImagemMm + 4), 58), 400);
}

/** Converte HTML de fatura (ou documento similar) em PDF — usado apenas no download. */
export async function gerarPdfDeHtmlDocumento(
  html: string,
  formato: FormatoHtmlPdf = "a4"
): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new Error("Geração de PDF disponível apenas no navegador.");
  }

  const gerar = async () => {
    const { iframe, doc } = montarIframeHtml(html, formato);

    await new Promise<void>((resolve) => {
      if (doc.readyState === "complete") resolve();
      else iframe.onload = () => resolve();
    });
    await aguardarImagens(doc);
    await aguardarLayout();

    doc.querySelectorAll(".actions").forEach((node) => {
      (node as HTMLElement).style.display = "none";
    });

    const paginas = Array.from(doc.querySelectorAll(".page")) as HTMLElement[];
    const alvos = paginas.length ? paginas : [(doc.body as HTMLElement)];
    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");

    const termica = formato === "termica";

    if (termica && alvos.length === 1) {
      const alvo = alvos[0];
      prepararElementoParaCaptura(alvo, doc);
      const canvas = await html2canvas(alvo, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: "#ffffff",
        width: alvo.scrollWidth,
        height: alvo.scrollHeight,
        windowWidth: alvo.scrollWidth,
        windowHeight: alvo.scrollHeight,
      });
      const larguraPdf = 80;
      const alturaImagem = (canvas.height * larguraPdf) / canvas.width;
      const pdf = new jsPDF({
        unit: "mm",
        format: [larguraPdf, alturaPdfTermicaMm(alturaImagem)],
      });
      adicionarCanvasNoPdf(pdf, canvas);
      iframe.remove();
      return pdf.output("blob");
    }

    const pdf = new jsPDF({
      unit: "mm",
      format: termica ? [80, 297] : "a4",
      orientation: "portrait",
    });

    for (let i = 0; i < alvos.length; i++) {
      if (i > 0) pdf.addPage();
      const alvo = alvos[i];
      prepararElementoParaCaptura(alvo, doc);

      const canvas = await html2canvas(alvo, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: "#ffffff",
        width: alvo.scrollWidth,
        height: alvo.scrollHeight,
        windowWidth: alvo.scrollWidth,
        windowHeight: alvo.scrollHeight,
      });

      adicionarCanvasNoPdf(pdf, canvas);
    }

    iframe.remove();
    return pdf.output("blob");
  };

  return Promise.race([
    gerar(),
    new Promise<Blob>((_, reject) => {
      window.setTimeout(
        () => reject(new Error("Tempo esgotado ao gerar o PDF da fatura.")),
        90_000
      );
    }),
  ]);
}
