/** Abre a requisição/PDF da OS em nova aba (com fallback se pop-up for bloqueado). */

export function abrirJanelaRequisicao(): Window | null {
  if (typeof window === "undefined") return null;
  try {
    const w = window.open("about:blank", "_blank");
    if (w) {
      w.document.title = "Gerando requisição...";
      w.document.body.innerHTML =
        "<p style='font-family:Arial,sans-serif;padding:24px;color:#334155'>Gerando requisição...</p>";
    }
    return w;
  } catch {
    return null;
  }
}

export function navegarParaRequisicao(
  printWindow: Window | null,
  printUrl: string
): "nova_aba" | "popup" | "mesma_aba" {
  const urlAbsoluta =
    printUrl.startsWith("http") || printUrl.startsWith("//")
      ? printUrl
      : `${window.location.origin}${printUrl.startsWith("/") ? "" : "/"}${printUrl}`;

  if (printWindow && !printWindow.closed) {
    try {
      printWindow.location.replace(urlAbsoluta);
      return "nova_aba";
    } catch {
      /* continua para fallback */
    }
  }

  const segunda = window.open(urlAbsoluta, "_blank", "noopener,noreferrer");
  if (segunda) return "popup";

  window.location.assign(urlAbsoluta);
  return "mesma_aba";
}
