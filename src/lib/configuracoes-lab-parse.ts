import {
  CONFIG_LAB_PADRAO,
  type ConfigLaboratorio,
} from "@/lib/configuracoes-lab";
import { normalizarIdioma } from "@/lib/i18n";
import { normalizarTipoPessoa } from "@/lib/configuracoes-lab";

function migrarLegado(parsed: Partial<ConfigLaboratorio>): ConfigLaboratorio {
  const base = { ...CONFIG_LAB_PADRAO, ...parsed };
  if (!base.nomeLaboratorio?.trim()) {
    const legado =
      base.nomeFantasia?.trim() ||
      base.nome?.trim() ||
      base.responsavel?.trim() ||
      "";
    if (legado) base.nomeLaboratorio = legado;
  }
  if (parsed.rua) return base;
  const texto = (parsed.endereco || "").trim();
  if (!texto) return base;
  const matchNumero = texto.match(/,\s*(\d+)/);
  return {
    ...base,
    rua: texto.split(",")[0]?.trim() || texto,
    numero: matchNumero?.[1] || base.numero,
  };
}

export function normalizarConfigLaboratorio(
  parsed: Partial<ConfigLaboratorio> | null | undefined
): ConfigLaboratorio {
  if (!parsed || typeof parsed !== "object") {
    return { ...CONFIG_LAB_PADRAO, tipoPessoa: "Jurídica" };
  }
  const config = migrarLegado(parsed);
  const tipo = normalizarTipoPessoa(config.tipoPessoa);
  if (tipo === "Física") {
    return {
      ...config,
      tipoPessoa: tipo,
      razaoSocial: "",
      idioma: normalizarIdioma(config.idioma),
      pais: config.pais || CONFIG_LAB_PADRAO.pais,
      moeda: config.moeda || CONFIG_LAB_PADRAO.moeda,
      codigoPaisTelefone:
        config.codigoPaisTelefone || CONFIG_LAB_PADRAO.codigoPaisTelefone,
    };
  }
  return {
    ...config,
    tipoPessoa: tipo,
    idioma: normalizarIdioma(config.idioma),
    pais: config.pais || CONFIG_LAB_PADRAO.pais,
    moeda: config.moeda || CONFIG_LAB_PADRAO.moeda,
    codigoPaisTelefone:
      config.codigoPaisTelefone || CONFIG_LAB_PADRAO.codigoPaisTelefone,
  };
}
