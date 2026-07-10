/** Normaliza e valida telefones brasileiros para WhatsApp. */

export function apenasDigitos(valor: string) {
  return valor.replace(/\D/g, "");
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

export function formatarTelefoneExibicao(raw: string) {
  const norm = normalizarTelefoneBr(raw);
  if (!norm) return raw.trim();
  const local = norm.startsWith("55") ? norm.slice(2) : norm;
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return `+${norm}`;
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
