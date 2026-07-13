/** Normaliza e valida telefones brasileiros para WhatsApp. */

/** Placeholder dos campos de telefone nos modais — vazio para não parecer número preenchido. */
export const PLACEHOLDER_TELEFONE_BR = "";

export function apenasDigitos(valor: string) {
  return valor.replace(/\D/g, "");
}

/** Aplica máscara 55DDXXXXX-XXXX (celular) ou 55DDXXXX-XXXX (fixo). */
function aplicarMascaraBrComPais(digits: string) {
  const limpo = digits.slice(0, 13);
  const len = limpo.length;
  if (len <= 4) return limpo;
  const head = limpo.slice(0, 4);
  const tail = limpo.slice(4);
  if (len <= 12) {
    if (tail.length <= 4) return head + tail;
    return `${head}${tail.slice(0, 4)}-${tail.slice(4)}`;
  }
  if (tail.length <= 5) return head + tail;
  return `${head}${tail.slice(0, 5)}-${tail.slice(5, 9)}`;
}

function digitosParaMascaraBr(raw: string) {
  let digits = apenasDigitos(raw);
  if (!digits) return "";
  if (!digits.startsWith("55")) {
    digits = digits.slice(0, 11);
    if (digits.length >= 10) digits = `55${digits}`.slice(0, 13);
  } else {
    digits = digits.slice(0, 13);
  }
  return digits;
}

/** Máscara de entrada com código do país (ex.: 553198270-9866). Aceita com ou sem 55. */
export function formatarTelefoneEntrada(raw: string) {
  const digits = digitosParaMascaraBr(raw);
  if (!digits) return "";
  return aplicarMascaraBrComPais(digits);
}

export function normalizarTelefoneBr(raw: string): string | null {
  let digits = apenasDigitos(raw);
  if (!digits) return null;

  if (digits.startsWith("55") && digits.length >= 12) {
    digits = digits.slice(2);
  }

  if (digits.length === 10 || digits.length === 11) {
    const ddd = digits.slice(0, 2);
    const numero = digits.slice(2);
    if (Number(ddd) < 11 || Number(ddd) > 99) return null;
    if (numero.length < 8) return null;
    return `55${ddd}${numero}`;
  }

  if (digits.length >= 12 && digits.length <= 13 && digits.startsWith("55")) {
    return digits;
  }

  return null;
}

/** Variantes com/sem 9º dígito (comparar celular cadastrado vs WhatsApp). */
export function variantesTelefoneBr(raw: string): string[] {
  const norm = normalizarTelefoneBr(raw);
  if (!norm) return [];
  const set = new Set<string>([norm]);
  if (norm.startsWith("55") && norm.length === 13) {
    const ddd = norm.slice(2, 4);
    const num = norm.slice(4);
    if (num.length === 9 && num[0] === "9") {
      set.add(`55${ddd}${num.slice(1)}`);
    }
  }
  if (norm.startsWith("55") && norm.length === 12) {
    const ddd = norm.slice(2, 4);
    const num = norm.slice(4);
    if (num.length === 8) {
      set.add(`55${ddd}9${num}`);
    }
  }
  return [...set];
}

export function telefonesBrCoincidem(a: string, b: string) {
  const va = variantesTelefoneBr(a);
  const vb = variantesTelefoneBr(b);
  if (!va.length || !vb.length) return false;
  return va.some((item) => vb.includes(item));
}

export function telefoneBrValido(raw: string) {
  return normalizarTelefoneBr(raw) !== null;
}

/** Número pronto para envio (Baileys, API ou wa.me) — aceita 55..., DDD local e hífen. */
export function telefoneParaEnvioWhatsapp(raw: string | null | undefined): string | null {
  const texto = String(raw ?? "").trim();
  if (!texto) return null;
  const norm = normalizarTelefoneBr(texto);
  if (norm) return norm;
  const digits = apenasDigitos(texto);
  if (digits.length >= 10) return digits;
  return null;
}

export function formatarTelefoneExibicao(raw: string) {
  const texto = String(raw ?? "").trim();
  if (!texto) return "";
  const norm = normalizarTelefoneBr(texto);
  if (norm) return aplicarMascaraBrComPais(norm);
  const parcial = digitosParaMascaraBr(texto);
  if (parcial.length >= 10) return aplicarMascaraBrComPais(parcial);
  return texto;
}

export type ContatoImportado = {
  nome: string;
  telefone: string;
  telefoneNormalizado: string;
  cidade?: string;
  empresaNome?: string;
  dentista?: string;
  consulta?: string;
  valor?: string;
  vencimento?: string;
  valido: boolean;
};

export function deduplicarContatos(contatos: ContatoImportado[]) {
  const vistos = new Set<string>();
  const validos: ContatoImportado[] = [];
  let duplicados = 0;
  let invalidos = 0;

  for (const c of contatos) {
    if (!c.valido || !c.telefoneNormalizado) {
      invalidos += 1;
      continue;
    }
    if (vistos.has(c.telefoneNormalizado)) {
      duplicados += 1;
      continue;
    }
    vistos.add(c.telefoneNormalizado);
    validos.push(c);
  }

  return {
    contatos: validos,
    total: contatos.length,
    validos: validos.length,
    invalidos,
    duplicados,
  };
}
