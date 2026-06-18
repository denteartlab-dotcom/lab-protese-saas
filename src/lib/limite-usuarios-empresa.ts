import { prisma } from "@/lib/db";
import { rotuloPlanoEmpresa } from "@/lib/master-planos";

export const LIMITE_USUARIOS_ILIMITADO = 9999;

export type CotasUsuariosEmpresa = {
  total: number;
  limite: number;
  restantes: number | null;
  ilimitado: boolean;
  podeAdicionar: boolean;
  plano: string;
  planoLabel: string;
};

export function limiteUsuariosEhIlimitado(limite: number) {
  return limite >= LIMITE_USUARIOS_ILIMITADO;
}

export async function contarUsuariosAtivosEmpresa(empresaId: string) {
  return prisma.user.count({
    where: { empresaId, excluidoEm: null },
  });
}

export async function carregarCotasUsuariosEmpresa(
  empresaId: string
): Promise<CotasUsuariosEmpresa | null> {
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { limiteUsuarios: true, plano: true },
  });
  if (!empresa) return null;

  const limite = empresa.limiteUsuarios;
  const total = await contarUsuariosAtivosEmpresa(empresaId);
  const ilimitado = limiteUsuariosEhIlimitado(limite);
  const restantes = ilimitado ? null : Math.max(0, limite - total);

  return {
    total,
    limite,
    restantes,
    ilimitado,
    podeAdicionar: ilimitado || total < limite,
    plano: empresa.plano,
    planoLabel: rotuloPlanoEmpresa(empresa.plano),
  };
}

export function mensagemLimiteUsuariosAtingido(limite: number, planoLabel?: string) {
  const plano = planoLabel ? ` do plano ${planoLabel}` : " do seu plano";
  if (limiteUsuariosEhIlimitado(limite)) {
    return "Não foi possível adicionar o usuário.";
  }
  const plural = limite === 1 ? "" : "s";
  return `Limite${plano} atingido (${limite} usuário${plural}). Faça upgrade do plano para adicionar mais usuários.`;
}

export type ResultadoCotaUsuario =
  | { erro: "EMPRESA_NAO_ENCONTRADA"; cotas: null; mensagem: string }
  | { erro: "LIMITE_USUARIOS"; cotas: CotasUsuariosEmpresa; mensagem: string }
  | { erro: null; cotas: CotasUsuariosEmpresa; mensagem: string };

export async function exigirCotaUsuarioDisponivel(
  empresaId: string
): Promise<ResultadoCotaUsuario> {
  const cotas = await carregarCotasUsuariosEmpresa(empresaId);
  if (!cotas) {
    return {
      erro: "EMPRESA_NAO_ENCONTRADA",
      cotas: null,
      mensagem: "Laboratório não encontrado.",
    };
  }
  if (!cotas.podeAdicionar) {
    return {
      erro: "LIMITE_USUARIOS",
      cotas,
      mensagem: mensagemLimiteUsuariosAtingido(cotas.limite, cotas.planoLabel),
    };
  }
  return { erro: null, cotas, mensagem: "" };
}
