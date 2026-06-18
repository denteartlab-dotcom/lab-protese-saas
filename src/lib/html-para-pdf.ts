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
  doc.write(html);
  doc.close();

  return { iframe, doc };
}

/** Converte HTML de fatura (ou documento similar) em PDF para o visualizador do navegador. */
export async function gerarPdfDeHtmlDocumento(
  html: string,
  formato: FormatoHtmlPdf = "a4"
): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new Error("Geração de PDF disponível apenas no navegador.");
  }

  const { iframe, doc } = montarIframeHtml(html, formato);

  await new Promise<void>((resolve) => {
    if (doc.readyState === "complete") resolve();
    else iframe.onload = () => resolve();
  });
  await aguardarImagens(doc);

  doc.querySelectorAll(".actions").forEach((node) => {
    (node as HTMLElement).style.display = "none";
  });

  const alvo = (doc.querySelector(".page") ?? doc.body) as HTMLElement;
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");

  const escala = 2;
  const canvas = await html2canvas(alvo, {
    scale: escala,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    width: alvo.scrollWidth,
    windowWidth: alvo.scrollWidth,
  });

  iframe.remove();

  const termica = formato === "termica";
  const pdf = new jsPDF({
    unit: "mm",
    format: termica ? [80, 297] : "a4",
    orientation: "portrait",
  });

  const larguraPdf = pdf.internal.pageSize.getWidth();
  const alturaPdf = pdf.internal.pageSize.getHeight();
  const alturaImagem = (canvas.height * larguraPdf) / canvas.width;
  const imgData = canvas.toDataURL("image/jpeg", 0.92);

  let posicaoY = 0;
  let restante = alturaImagem;

  pdf.addImage(imgData, "JPEG", 0, posicaoY, larguraPdf, alturaImagem);
  restante -= alturaPdf;

  while (restante > 0) {
    posicaoY -= alturaPdf;
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, posicaoY, larguraPdf, alturaImagem);
    restante -= alturaPdf;
  }

  return pdf.output("blob");
}
