export type ResultadoSenha = {
  valida: boolean;
  erros: string[];
  forca: "fraca" | "media" | "forte";
};

export function validarForcaSenha(senha: string): ResultadoSenha {
  const erros: string[] = [];
  if (senha.length < 8) erros.push("Mínimo de 8 caracteres.");
  if (!/[a-z]/.test(senha)) erros.push("Inclua uma letra minúscula.");
  if (!/[A-Z]/.test(senha)) erros.push("Inclua uma letra maiúscula.");
  if (!/\d/.test(senha)) erros.push("Inclua um número.");

  let pontos = 0;
  if (senha.length >= 8) pontos += 1;
  if (senha.length >= 12) pontos += 1;
  if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) pontos += 1;
  if (/\d/.test(senha)) pontos += 1;
  if (/[^A-Za-z0-9]/.test(senha)) pontos += 1;

  const forca: ResultadoSenha["forca"] =
    pontos >= 4 ? "forte" : pontos >= 2 ? "media" : "fraca";

  return { valida: erros.length === 0, erros, forca };
}
