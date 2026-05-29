import type { DrePontoGrafico } from "@/lib/dre-graficos";
import { formatarTooltip } from "@/lib/dre-graficos";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportarComparativoMensalCsv(
  dados: DrePontoGrafico[],
  ano: number
) {
  const header =
    "Mes;Receita Operacional Bruta;Opex (CF + CV + Despesas);Lucro Liquido";
  const rows = dados.map(
    (d) =>
      `${d.mes};${formatarTooltip(d.receitaBruta)};${formatarTooltip(d.opex)};${formatarTooltip(d.lucroLiquido)}`
  );
  const csv = ["\uFEFF", `Comparativo mensal DRE ${ano}`, header, ...rows].join(
    "\n"
  );
  downloadBlob(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
    `dre-comparativo-mensal-${ano}.csv`
  );
}

function svgDoGrafico(container: HTMLElement | null) {
  if (!container) return null;
  const svg = container.querySelector(".recharts-wrapper svg, svg.recharts-surface");
  return svg ?? container.querySelector("svg");
}

export function exportarGraficoSvg(
  container: HTMLElement | null,
  filename: string
) {
  const svg = svgDoGrafico(container);
  if (!svg) return;

  const rect = container!.getBoundingClientRect();
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  if (!clone.getAttribute("width")) {
    clone.setAttribute("width", String(Math.round(rect.width) || 800));
  }
  if (!clone.getAttribute("height")) {
    clone.setAttribute("height", String(Math.round(rect.height) || 240));
  }

  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("width", "100%");
  bg.setAttribute("height", "100%");
  bg.setAttribute("fill", "#ffffff");
  clone.insertBefore(bg, clone.firstChild);

  const source = new XMLSerializer().serializeToString(clone);
  downloadBlob(
    new Blob([source], { type: "image/svg+xml;charset=utf-8" }),
    filename
  );
}

export function exportarGraficoPng(
  container: HTMLElement | null,
  filename: string
) {
  const svg = svgDoGrafico(container);
  if (!svg || !container) return;

  const rect = container.getBoundingClientRect();
  const w = Math.round(rect.width) || 800;
  const h = Math.round(rect.height) || 240;

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));

  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("width", String(w));
  bg.setAttribute("height", String(h));
  bg.setAttribute("fill", "#ffffff");
  clone.insertBefore(bg, clone.firstChild);

  const source = new XMLSerializer().serializeToString(clone);
  const url =
    "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, filename);
    }, "image/png");
  };
  img.onerror = () => exportarGraficoSvg(container, filename.replace(/\.png$/i, ".svg"));
  img.src = url;
}
