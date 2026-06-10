import { z } from "zod";
import { readStorage, writeStorage } from "@/lib/persisted-storage";

export const TABELA_PRECOS_IMPRESSAO_KEY = "labProteseTabelaPrecosImpressao";

export const OPCOES_FONTE_IMPRESSAO = [
  "Montserrat",
  "Arial",
  "Helvetica",
  "Verdana",
  "Times New Roman",
  "Georgia",
] as const;

export type AlinhamentoCategoriaImpressao = "esquerda" | "centro" | "direita";

export const schemaConfigImpressaoTabelaPrecos = z.object({
  mostrarCabecalho: z.boolean(),
  titulo: z.string().max(200),
  corCategorias: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  corServicos: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  corBordas: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  tipoFonte: z.enum(OPCOES_FONTE_IMPRESSAO),
  tamanhoFonte: z.number().min(8).max(32),
  alinhamentoCategoria: z.enum(["esquerda", "centro", "direita"]),
  espacamentoCategorias: z.number().min(0).max(80),
  espacamentoServicos: z.number().min(0).max(80),
  observacao1: z.string().max(500),
  observacao2: z.string().max(500),
  observacao3: z.string().max(500),
  observacao4: z.string().max(500),
});

export type ConfigImpressaoTabelaPrecos = z.infer<
  typeof schemaConfigImpressaoTabelaPrecos
>;

export type ArmazenamentoImpressaoTabelaPrecos = {
  configs: Record<string, ConfigImpressaoTabelaPrecos>;
};

export function configPadraoImpressaoTabelaPrecos(
  titulo = ""
): ConfigImpressaoTabelaPrecos {
  return {
    mostrarCabecalho: false,
    titulo,
    corCategorias: "#000000",
    corServicos: "#000000",
    corBordas: "#d1d5db",
    tipoFonte: "Montserrat",
    tamanhoFonte: 14,
    alinhamentoCategoria: "centro",
    espacamentoCategorias: 10,
    espacamentoServicos: 17,
    observacao1: "",
    observacao2: "",
    observacao3: "",
    observacao4: "",
  };
}

function armazenamentoVazio(): ArmazenamentoImpressaoTabelaPrecos {
  return { configs: {} };
}

export function lerArmazenamentoImpressaoLocal(): ArmazenamentoImpressaoTabelaPrecos {
  return readStorage<ArmazenamentoImpressaoTabelaPrecos>(
    TABELA_PRECOS_IMPRESSAO_KEY,
    armazenamentoVazio()
  );
}

export function configImpressaoDaTabela(
  armazenado: ArmazenamentoImpressaoTabelaPrecos,
  nomeTabela: string
): ConfigImpressaoTabelaPrecos {
  const salva = armazenado.configs[nomeTabela];
  if (!salva) return configPadraoImpressaoTabelaPrecos(nomeTabela);
  const parsed = schemaConfigImpressaoTabelaPrecos.safeParse(salva);
  return parsed.success ? parsed.data : configPadraoImpressaoTabelaPrecos(nomeTabela);
}

export async function carregarConfigImpressaoTabelaPrecos(
  nomeTabela: string
): Promise<ConfigImpressaoTabelaPrecos> {
  if (typeof window === "undefined") {
    return configPadraoImpressaoTabelaPrecos(nomeTabela);
  }

  const local = lerArmazenamentoImpressaoLocal();

  try {
    const res = await fetch(
      `/api/json-store/${encodeURIComponent(TABELA_PRECOS_IMPRESSAO_KEY)}`
    );
    if (res.ok) {
      const remoto = (await res.json()) as ArmazenamentoImpressaoTabelaPrecos | null;
      if (remoto && typeof remoto === "object" && remoto.configs) {
        writeStorage(TABELA_PRECOS_IMPRESSAO_KEY, remoto, { forcar: true });
        return configImpressaoDaTabela(remoto, nomeTabela);
      }
      if (Object.keys(local.configs).length > 0) {
        void sincronizarConfigImpressaoServidor(local);
      }
    }
  } catch {
    /* usa local */
  }

  return configImpressaoDaTabela(local, nomeTabela);
}

export async function salvarConfigImpressaoTabelaPrecos(
  nomeTabela: string,
  config: ConfigImpressaoTabelaPrecos
) {
  const validado = schemaConfigImpressaoTabelaPrecos.parse(config);
  const atual = lerArmazenamentoImpressaoLocal();
  const payload: ArmazenamentoImpressaoTabelaPrecos = {
    configs: { ...atual.configs, [nomeTabela]: validado },
  };
  writeStorage(TABELA_PRECOS_IMPRESSAO_KEY, payload, { forcar: true });
  await sincronizarConfigImpressaoServidor(payload);
}

export async function sincronizarConfigImpressaoServidor(
  dados: ArmazenamentoImpressaoTabelaPrecos
) {
  if (typeof window === "undefined") return;
  try {
    await fetch(
      `/api/json-store/${encodeURIComponent(TABELA_PRECOS_IMPRESSAO_KEY)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      }
    );
  } catch {
    /* mantém só localStorage */
  }
}

export function hexParaRgb(hex: string): [number, number, number] {
  const limpo = hex.replace("#", "");
  if (limpo.length !== 6) return [0, 0, 0];
  return [
    parseInt(limpo.slice(0, 2), 16),
    parseInt(limpo.slice(2, 4), 16),
    parseInt(limpo.slice(4, 6), 16),
  ];
}

export function fonteCssImpressao(tipo: string): string {
  const mapa: Record<string, string> = {
    Montserrat: "Montserrat, Arial, sans-serif",
    Arial: "Arial, Helvetica, sans-serif",
    Helvetica: "Helvetica, Arial, sans-serif",
    Verdana: "Verdana, Geneva, sans-serif",
    "Times New Roman": '"Times New Roman", Times, serif',
    Georgia: "Georgia, serif",
  };
  return mapa[tipo] || "Arial, sans-serif";
}

export function fontePdfImpressao(tipo: string): string {
  const mapa: Record<string, string> = {
    "Times New Roman": "times",
    Georgia: "times",
    Montserrat: "helvetica",
    Arial: "helvetica",
    Helvetica: "helvetica",
    Verdana: "helvetica",
  };
  return mapa[tipo] || "helvetica";
}

export function alinhamentoCssImpressao(
  alinhamento: AlinhamentoCategoriaImpressao
): "left" | "center" | "right" {
  if (alinhamento === "esquerda") return "left";
  if (alinhamento === "direita") return "right";
  return "center";
}

export function alinhamentoPdfImpressao(
  alinhamento: AlinhamentoCategoriaImpressao
): "left" | "center" | "right" {
  return alinhamentoCssImpressao(alinhamento);
}

export function pxParaMm(px: number) {
  return px * 0.264583;
}
