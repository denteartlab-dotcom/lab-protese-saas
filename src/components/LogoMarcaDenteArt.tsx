import { cn } from "@/lib/utils";

/** Tamanho em impressos / orçamento público. */
export const LOGO_MARCA_LARGURA = 300;
export const LOGO_MARCA_ALTURA = 100;

/**
 * Topo — visível como Smart Prótese (largura dominante, altura cabe na faixa cinza).
 * Caixa 300×50 → imagem 3:1 renderiza ~150×50 px, bem legível.
 */
export const LOGO_TOPO_LARGURA = 320;
export const LOGO_TOPO_ALTURA = 52;

/** Faixa cinza — altura próxima à Smart Prótese. */
export const FAIXA_TOPO_ALTURA = 60;

const LOGO_SRC = "/images/dente-art-logo.png";

type Props = {
  className?: string;
  /** `topo` = header; `full` = 300×100 */
  variant?: "topo" | "full";
};

export function LogoMarcaDenteArt({ className, variant = "topo" }: Props) {
  const largura = variant === "full" ? LOGO_MARCA_LARGURA : LOGO_TOPO_LARGURA;
  const altura = variant === "full" ? LOGO_MARCA_ALTURA : LOGO_TOPO_ALTURA;

  const objectFit = variant === "topo" ? "cover" : "contain";

  return (
    <img
      src={LOGO_SRC}
      alt="Dente Art"
      width={largura}
      height={altura}
      className={cn(
        "block shrink-0 object-center",
        variant === "topo" && "site-topo-marca__logo",
        className
      )}
      style={{
        width: largura,
        height: altura,
        maxHeight: altura,
        objectFit,
        objectPosition: "center",
      }}
      decoding="async"
      fetchPriority="high"
    />
  );
}
