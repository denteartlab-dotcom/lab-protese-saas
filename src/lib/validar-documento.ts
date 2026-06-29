export function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

export function validarCpf(cpf: string): boolean {
  const n = apenasDigitos(cpf);
  if (n.length !== 11 || /^(\d)\1+$/.test(n)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i += 1) soma += Number(n[i]) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== Number(n[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i += 1) soma += Number(n[i]) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  return resto === Number(n[10]);
}

export function validarCnpj(cnpj: string): boolean {
  const n = apenasDigitos(cnpj);
  if (n.length !== 14 || /^(\d)\1+$/.test(n)) return false;
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let soma = 0;
  for (let i = 0; i < 12; i += 1) soma += Number(n[i]) * pesos1[i];
  let resto = soma % 11;
  const dig1 = resto < 2 ? 0 : 11 - resto;
  if (dig1 !== Number(n[12])) return false;
  soma = 0;
  for (let i = 0; i < 13; i += 1) soma += Number(n[i]) * pesos2[i];
  resto = soma % 11;
  const dig2 = resto < 2 ? 0 : 11 - resto;
  return dig2 === Number(n[13]);
}

export function validarCpfOuCnpj(valor: string): boolean {
  const n = apenasDigitos(valor);
  if (n.length === 11) return validarCpf(n);
  if (n.length === 14) return validarCnpj(n);
  return false;
}

export function formatarCpfCnpj(valor: string): string {
  const n = apenasDigitos(valor).slice(0, 14);
  if (n.length <= 11) {
    return n
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return n
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function formatarTelefone(valor: string): string {
  const n = apenasDigitos(valor).slice(0, 11);
  if (n.length <= 10) {
    return n.replace(/(\d{2})(\d)/, "($1)$2").replace(/(\d{4})(\d)/, "$1-$2");
  }
  return n.replace(/(\d{2})(\d)/, "($1)$2").replace(/(\d{5})(\d)/, "$1-$2");
}

/** Exibe telefone/WhatsApp formatado em listagens — (DD)XXXX-XXXX ou (DD)XXXXX-XXXX. */
export function exibirTelefone(valor?: string | null): string {
  const texto = String(valor ?? "").trim();
  if (!texto) return "";
  const digitos = apenasDigitos(texto);
  if (digitos.length < 10) return texto;
  return formatarTelefone(texto);
}
