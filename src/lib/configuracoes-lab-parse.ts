import { normalizarCabecalhoRequisicao } from "@/lib/cabecalho-requisicao";
import {
  CONFIG_LAB_PADRAO,
  type ConfigLaboratorio,
} from "@/lib/configuracoes-lab";
import { normalizarIdioma } from "@/lib/i18n";
import { normalizarTipoPessoa } from "@/lib/configuracoes-lab";
import { NOME_LAB_PADRAO } from "@/lib/document-title";
import { formatarTelefone } from "@/lib/validar-documento";

function formatarTelefoneSalvo(valor?: string | null): string {
  const texto = String(valor ?? "").trim();
  if (!texto) return "";
  const digitos = texto.replace(/\D/g, "");
  if (digitos.length < 10) return texto;
  return formatarTelefone(texto);
}

function aplicarFormatoTelefones(config: ConfigLaboratorio): ConfigLaboratorio {
  return {
    ...config,
    telefoneComercial: formatarTelefoneSalvo(config.telefoneComercial),
    celular: formatarTelefoneSalvo(config.celular),
    whatsapp: formatarTelefoneSalvo(config.whatsapp),
  };
}

function migrarLegado(parsed: Partial<ConfigLaboratorio>): ConfigLaboratorio {
  const base = { ...CONFIG_LAB_PADRAO, ...parsed };
  if (!base.nomeLaboratorio?.trim()) {
    const tipo = normalizarTipoPessoa(base.tipoPessoa);
    const legado =
      tipo === "Jurídica"
        ? base.nomeFantasia?.trim() || base.razaoSocial?.trim() || ""
        : base.nome?.trim() || base.razaoSocial?.trim() || "";
    const responsavel =
      base.responsavel?.trim() && base.responsavel.trim() !== NOME_LAB_PADRAO
        ? base.responsavel.trim()
        : "";
    if (legado) base.nomeLaboratorio = legado;
    else if (responsavel) base.nomeLaboratorio = responsavel;
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

function emailLaboratorioSalvo(parsed: Partial<ConfigLaboratorio> | null | undefined): string {
  if (!parsed || typeof parsed !== "object" || !("email" in parsed)) return "";
  return String(parsed.email ?? "").trim();
}

export function normalizarConfigLaboratorio(
  parsed: Partial<ConfigLaboratorio> | null | undefined
): ConfigLaboratorio {
  if (!parsed || typeof parsed !== "object") {
    return { ...CONFIG_LAB_PADRAO, tipoPessoa: "Jurídica", email: "" };
  }
  const config = migrarLegado(parsed);
  const email = emailLaboratorioSalvo(parsed);
  const cabecalhoRequisicao = normalizarCabecalhoRequisicao(config.cabecalhoRequisicao);
  const tipo = normalizarTipoPessoa(config.tipoPessoa);
  if (tipo === "Física") {
    return aplicarFormatoTelefones({
      ...config,
      email,
      cabecalhoRequisicao,
      tipoPessoa: tipo,
      razaoSocial: "",
      idioma: normalizarIdioma(config.idioma),
      pais: config.pais || CONFIG_LAB_PADRAO.pais,
      moeda: config.moeda || CONFIG_LAB_PADRAO.moeda,
      codigoPaisTelefone:
        config.codigoPaisTelefone || CONFIG_LAB_PADRAO.codigoPaisTelefone,
    });
  }
  return aplicarFormatoTelefones({
    ...config,
    email,
    cabecalhoRequisicao,
    tipoPessoa: tipo,
    idioma: normalizarIdioma(config.idioma),
    pais: config.pais || CONFIG_LAB_PADRAO.pais,
    moeda: config.moeda || CONFIG_LAB_PADRAO.moeda,
    codigoPaisTelefone:
      config.codigoPaisTelefone || CONFIG_LAB_PADRAO.codigoPaisTelefone,
  });
}
