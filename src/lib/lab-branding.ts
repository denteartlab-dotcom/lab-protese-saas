import { nomeExibicaoLaboratorio } from "@/lib/configuracoes-lab";
import { NOME_LAB_PADRAO } from "@/lib/document-title";
import { carregarConfigLaboratorioServidor } from "@/lib/lab-config-servidor";
import { configParaLabImpressao } from "@/lib/lab-logo";

export type LabBrandingPublico = {
  nomeLaboratorio: string;
  marcaSubtitulo: string;
  logoDataUrl: string;
  logoTamanho: number;
};

export async function carregarBrandingLaboratorio(): Promise<LabBrandingPublico> {
  const config = await carregarConfigLaboratorioServidor();
  const lab = configParaLabImpressao(config);
  const nome =
    nomeExibicaoLaboratorio(config).trim() ||
    lab.marca?.trim() ||
    NOME_LAB_PADRAO;

  return {
    nomeLaboratorio: nome,
    marcaSubtitulo: lab.marcaSubtitulo?.trim() || "",
    logoDataUrl: lab.logoDataUrl?.trim() || "",
    logoTamanho: lab.logoTamanho ?? 0,
  };
}
