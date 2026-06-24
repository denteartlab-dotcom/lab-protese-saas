import {
  ASAAS_SELO_ALT,
  ASAAS_SELO_ALTURA,
  ASAAS_SELO_LARGURA,
  ASAAS_SITE_URL,
  ASAAS_TERMOS_URL,
  textoInstitucionalAsaasCurto,
  textoServicosFinanceirosAsaas,
  urlSeloAsaasPublico,
  type VarianteSeloAsaas,
} from "@/lib/asaas-marca-baas";
import { APP_BUILD_ID } from "@/lib/app-build-id";
import { cn } from "@/lib/utils";

type Props = {
  variante?: VarianteSeloAsaas;
  /** Texto completo sobre serviços financeiros (telas de conta digital). */
  detalhado?: boolean;
  className?: string;
  /** Versão para cache-bust (passe obterAppBuildIdServidor() em páginas do servidor). */
  versaoCache?: string;
};

export function AsaasSeloInstitucional({
  variante = "claro",
  detalhado = false,
  className,
  versaoCache,
}: Props) {
  const escuro = variante === "escuro";
  const textoCor = escuro ? "text-slate-400" : "text-slate-600";
  const linkCor = escuro ? "text-slate-300 hover:text-white" : "text-[#0038E5] hover:underline";
  const src = urlSeloAsaasPublico(variante, versaoCache?.trim() || APP_BUILD_ID);

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 text-center text-[11px] leading-relaxed",
        textoCor,
        className
      )}
    >
      <a
        href={ASAAS_SITE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex shrink-0"
        aria-label="Asaas — Instituição de Pagamento"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={ASAAS_SELO_ALT}
          width={ASAAS_SELO_LARGURA}
          height={ASAAS_SELO_ALTURA}
          style={{ display: "inline-block" }}
          className="h-12 w-auto max-w-[min(100%,200px)]"
          decoding="async"
        />
      </a>
      <p>
        {detalhado ? textoServicosFinanceirosAsaas() : textoInstitucionalAsaasCurto()}
      </p>
      <p className={cn("text-[10px]", escuro ? "text-slate-500" : "text-slate-500")}>
        <a href={ASAAS_SITE_URL} target="_blank" rel="noopener noreferrer" className={linkCor}>
          www.asaas.com
        </a>
        {" · "}
        <a href={ASAAS_TERMOS_URL} target="_blank" rel="noopener noreferrer" className={linkCor}>
          Termos Asaas
        </a>
      </p>
    </div>
  );
}
