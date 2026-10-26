import { hrefAppNaSessao } from "@/lib/rotas-app";

/** Troca a página inteira. Evita o roteador do Next preso no redirect do slug. */
export function sairParaRotaApp(destino: string) {
  if (typeof window === "undefined") return;
  window.location.assign(hrefAppNaSessao(window.location.pathname, destino));
}
