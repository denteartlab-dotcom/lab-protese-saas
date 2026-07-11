import type { ConfigLaboratorio } from "@/lib/configuracoes-lab";
import type { LabImpressaoConfig } from "@/lib/lab-impressao";

function dataPorExtenso(value: Date) {
  return value.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function cidadeReciboLaboratorio(
  labCfg: ConfigLaboratorio,
  lab: LabImpressaoConfig
): string {
  return (
    labCfg.cidade?.trim() ||
    lab.enderecoLinha2?.trim() ||
    lab.endereco?.split(",")[0]?.trim() ||
    "Governador Valadares"
  );
}

export function formatoImagemDataUrl(dataUrl: string): "PNG" | "JPEG" | "WEBP" {
  if (dataUrl.includes("image/jpeg") || dataUrl.includes("image/jpg")) return "JPEG";
  if (dataUrl.includes("image/webp")) return "WEBP";
  return "PNG";
}

export type RodapeAssinaturaRecibo = {
  cidade: string;
  dataExtenso: string;
  responsavel: string;
  cnpj: string;
  assinaturaDataUrl: string;
};

export function dadosRodapeAssinaturaRecibo(
  labCfg: ConfigLaboratorio,
  lab: LabImpressaoConfig
): RodapeAssinaturaRecibo {
  return {
    cidade: cidadeReciboLaboratorio(labCfg, lab),
    dataExtenso: dataPorExtenso(new Date()),
    responsavel: lab.responsavel?.trim() || labCfg.responsavel?.trim() || "",
    cnpj: labCfg.cnpj?.trim() ? `CNPJ: ${labCfg.cnpj.trim()}` : "",
    assinaturaDataUrl: labCfg.assinaturaReciboDataUrl?.trim() || "",
  };
}
