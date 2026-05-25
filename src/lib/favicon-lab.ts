const faviconCache = new Map<string, string>();

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const ra = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + ra, y);
  ctx.arcTo(x + w, y, x + w, y + h, ra);
  ctx.arcTo(x + w, y + h, x, y + h, ra);
  ctx.arcTo(x, y + h, x, y, ra);
  ctx.arcTo(x, y, x + w, y, ra);
  ctx.closePath();
}

function pintarFundoGradiente(ctx: CanvasRenderingContext2D, tamanho: number) {
  const g = ctx.createLinearGradient(0, 0, 0, tamanho);
  g.addColorStop(0, "#22d3ee");
  g.addColorStop(0.55, "#3b82f6");
  g.addColorStop(1, "#7c3aed");
  ctx.fillStyle = g;
  roundRect(ctx, 0, 0, tamanho, tamanho, tamanho * 0.2);
  ctx.fill();
}

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível carregar a imagem do favicon."));
    img.src = src;
  });
}

/** Logo em tamanho máximo (estilo aba Smart Prótese) — preenche o quadrado inteiro. */
export async function gerarFaviconDeLogo(
  logoDataUrl: string,
  tamanho = 128
): Promise<string> {
  const chave = `v2-${tamanho}:${logoDataUrl.slice(0, 80)}`;
  const emCache = faviconCache.get(chave);
  if (emCache) return emCache;

  const img = await carregarImagem(logoDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = tamanho;
  canvas.height = tamanho;
  const ctx = canvas.getContext("2d");
  if (!ctx) return logoDataUrl;

  const raio = tamanho * 0.2;

  pintarFundoGradiente(ctx, tamanho);

  ctx.save();
  roundRect(ctx, 0, 0, tamanho, tamanho, raio);
  ctx.clip();

  const escala = Math.max(tamanho / img.width, tamanho / img.height);
  const w = img.width * escala;
  const h = img.height * escala;
  const x = (tamanho - w) / 2;
  const y = (tamanho - h) / 2;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();

  const dataUrl = canvas.toDataURL("image/png");
  faviconCache.set(chave, dataUrl);
  return dataUrl;
}
