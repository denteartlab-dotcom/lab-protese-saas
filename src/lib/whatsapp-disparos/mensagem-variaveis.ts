export const VARIAVEIS_MENSAGEM = [
  { chave: "nome", label: "Nome" },
  { chave: "telefone", label: "Telefone" },
  { chave: "cidade", label: "Cidade" },
  { chave: "empresa", label: "Empresa" },
  { chave: "dentista", label: "Dentista" },
  { chave: "consulta", label: "Consulta" },
  { chave: "valor", label: "Valor" },
  { chave: "vencimento", label: "Vencimento" },
] as const;

export type VariaveisContato = {
  nome?: string;
  telefone?: string;
  cidade?: string;
  empresa?: string;
  dentista?: string;
  consulta?: string;
  valor?: string;
  vencimento?: string;
};

export function aplicarVariaveisMensagem(
  template: string,
  vars: VariaveisContato
): string {
  let texto = template;
  const mapa: Record<string, string | undefined> = {
    nome: vars.nome,
    telefone: vars.telefone,
    cidade: vars.cidade,
    empresa: vars.empresa,
    dentista: vars.dentista,
    consulta: vars.consulta,
    valor: vars.valor,
    vencimento: vars.vencimento,
  };

  for (const [chave, valor] of Object.entries(mapa)) {
    const regex = new RegExp(`\\{${chave}\\}`, "gi");
    texto = texto.replace(regex, valor?.trim() || "");
  }

  return texto.trim();
}

export function estimarDuracaoDisparo(
  totalContatos: number,
  intervaloSegundos: number,
  atrasoAleatorio: boolean
) {
  if (totalContatos <= 0) return 0;
  const base = intervaloSegundos * totalContatos;
  const extra = atrasoAleatorio ? Math.floor(totalContatos * intervaloSegundos * 0.5) : 0;
  return base + extra;
}

export function formatarTempoRestante(segundos: number) {
  if (!Number.isFinite(segundos) || segundos <= 0) return "00:00:00";
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = Math.floor(segundos % 60);
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}
