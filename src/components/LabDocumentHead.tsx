"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  FAVICON_PADRAO,
  montarTituloDocumento,
} from "@/lib/document-title";
import { gerarFaviconDeLogo } from "@/lib/favicon-lab";
import { useLabConfigServidor } from "@/components/LabConfigProvider";
import { useLabConfigClient } from "@/lib/use-lab-config-client";

const FAVICON_LINK_ID = "lab-favicon";
const FAVICON_APPLE_ID = "lab-favicon-apple";

function tipoMimeFavicon(href: string): string {
  if (href.endsWith(".svg")) return "image/svg+xml";
  if (href.startsWith("data:image/jpeg")) return "image/jpeg";
  if (href.startsWith("data:image/webp")) return "image/webp";
  return "image/png";
}

function upsertLink(
  id: string,
  rel: string,
  href: string,
  sizes?: string
) {
  let link = document.getElementById(id) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = id;
    document.head.appendChild(link);
  }
  link.rel = rel;
  link.type = tipoMimeFavicon(href);
  link.href = href;
  if (sizes) link.sizes = sizes;
  else link.removeAttribute("sizes");
}

function definirFavicon(href: string, tipo?: string) {
  upsertLink(FAVICON_LINK_ID, "icon", href, "any");
  const link = document.getElementById(FAVICON_LINK_ID) as HTMLLinkElement | null;
  if (link && tipo) link.type = tipo;
  upsertLink(FAVICON_APPLE_ID, "apple-touch-icon", href, "180x180");
}

/** Título da aba e ícone conforme dados do laboratório (banco de dados). */
export function LabDocumentHead() {
  const pathname = usePathname() ?? "";
  const servidor = useLabConfigServidor();
  const { lab, nomeLaboratorio } = useLabConfigClient({
    initialLab: servidor?.lab,
    initialNomeLaboratorio: servidor?.nomeLaboratorio,
  });
  const seq = useRef(0);

  const paginaPublicaBranding =
    pathname === "/login" ||
    pathname === "/cadastro" ||
    pathname.startsWith("/assinatura-vencida") ||
    pathname.startsWith("/pagamento");

  useEffect(() => {
    if (paginaPublicaBranding) return;

    document.title = montarTituloDocumento(nomeLaboratorio);

    const logo = lab.logoDataUrl?.trim();
    const atual = ++seq.current;

    if (logo?.startsWith("data:image")) {
      void gerarFaviconDeLogo(logo, 128)
        .then((href) => {
          if (seq.current !== atual) return;
          definirFavicon(href, "image/png");
        })
        .catch(() => {
          if (seq.current !== atual) return;
          definirFavicon(FAVICON_PADRAO);
        });
    } else {
      definirFavicon(FAVICON_PADRAO);
    }
  }, [nomeLaboratorio, lab.logoDataUrl, paginaPublicaBranding]);

  return null;
}
