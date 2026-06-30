export const ROLES_USUARIO = [
  "proprietario",
  "gerente",
  "usuario",
  "financeiro",
  "producao",
] as const;

export type RoleUsuario = (typeof ROLES_USUARIO)[number];

export type PermissaoCrud = {
  ver: boolean;
  criar: boolean;
  editar: boolean;
  excluir: boolean;
};

export type SituacaoUsuario = "ativo" | "inativo";

export type PermissoesUsuario = {
  setores: string[];
  modulos?: Record<string, PermissaoCrud>;
  situacao?: SituacaoUsuario;
  permitirRetiradasCarteira?: boolean;
  permitirAlterarChavePix?: boolean;
  permitirAlterarSenha?: boolean;
  acessoMobile?: boolean;
  avatarDataUrl?: string;
};

export type UsuarioListagem = {
  id: string;
  name: string;
  email: string;
  role: string;
  colaboradorId: string | null;
  colaboradorNome: string | null;
  moduloProducao: boolean;
  permissoes: PermissoesUsuario;
  excluidoEm: string | null;
  createdAt: string;
};

export function usuarioEhProprietario(role: string) {
  return role === "proprietario" || role === "admin" || role === "admin_empresa";
}

export function podeGerenciarUsuarios(role: string) {
  return usuarioEhProprietario(role);
}

export function rotuloTipoUsuario(role: string) {
  switch (role) {
    case "proprietario":
      return "Proprietário";
    case "admin":
    case "admin_empresa":
      return "Proprietário";
    case "gerente":
      return "Gerente";
    case "financeiro":
      return "Financeiro";
    case "producao":
      return "Produção";
    default:
      return "Usuário";
  }
}

export function corTipoUsuario(role: string) {
  if (usuarioEhProprietario(role)) return "text-[#4a90d9]";
  if (role === "gerente") return "text-[#7c3aed]";
  return "text-[#374151]";
}

export function parsePermissoesUsuario(json: string | null | undefined): PermissoesUsuario {
  if (!json?.trim()) return { setores: [], situacao: "ativo" };
  try {
    const parsed = JSON.parse(json) as Partial<PermissoesUsuario> & {
      modulos?: Record<string, Partial<PermissaoCrud>>;
    };
    const setores = Array.isArray(parsed.setores)
      ? parsed.setores.map((s) => String(s).trim()).filter(Boolean)
      : [];
    const modulos: Record<string, PermissaoCrud> = {};
    if (parsed.modulos && typeof parsed.modulos === "object") {
      for (const [chave, valor] of Object.entries(parsed.modulos)) {
        if (!valor || typeof valor !== "object") continue;
        modulos[chave] = {
          ver: Boolean(valor.ver),
          criar: Boolean(valor.criar),
          editar: Boolean(valor.editar),
          excluir: Boolean(valor.excluir),
        };
      }
    }
    return {
      setores,
      modulos: Object.keys(modulos).length ? modulos : undefined,
      situacao: parsed.situacao === "inativo" ? "inativo" : "ativo",
      permitirRetiradasCarteira: Boolean(parsed.permitirRetiradasCarteira),
      permitirAlterarChavePix: Boolean(parsed.permitirAlterarChavePix),
      permitirAlterarSenha: Boolean(parsed.permitirAlterarSenha),
      acessoMobile: Boolean(parsed.acessoMobile),
      avatarDataUrl:
        typeof parsed.avatarDataUrl === "string" && parsed.avatarDataUrl.startsWith("data:image")
          ? parsed.avatarDataUrl
          : undefined,
    };
  } catch {
    return { setores: [], situacao: "ativo" };
  }
}

export function serializarPermissoesUsuario(permissoes: PermissoesUsuario) {
  const modulosLimpos: Record<string, PermissaoCrud> = {};
  if (permissoes.modulos) {
    for (const [id, valor] of Object.entries(permissoes.modulos)) {
      modulosLimpos[id] = {
        ver: Boolean(valor.ver),
        criar: Boolean(valor.criar),
        editar: Boolean(valor.editar),
        excluir: Boolean(valor.excluir),
      };
    }
  }

  const payload: PermissoesUsuario = {
    setores: [...new Set(permissoes.setores.map((s) => s.trim()).filter(Boolean))],
    situacao: permissoes.situacao === "inativo" ? "inativo" : "ativo",
    permitirRetiradasCarteira: Boolean(permissoes.permitirRetiradasCarteira),
    permitirAlterarChavePix: Boolean(permissoes.permitirAlterarChavePix),
    permitirAlterarSenha: Boolean(permissoes.permitirAlterarSenha),
    acessoMobile: Boolean(permissoes.acessoMobile),
  };
  if (Object.keys(modulosLimpos).length) {
    payload.modulos = modulosLimpos;
  }
  if (permissoes.avatarDataUrl?.startsWith("data:image")) {
    payload.avatarDataUrl = permissoes.avatarDataUrl;
  }
  return JSON.stringify(payload);
}

export function gerarSenhaAutomatica() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let senha = "";
  for (let i = 0; i < 10; i += 1) {
    senha += chars[Math.floor(Math.random() * chars.length)];
  }
  return senha;
}

export function mapUsuarioListagem(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  colaboradorId: string | null;
  colaboradorNome: string | null;
  moduloProducao: boolean;
  permissoesJson: string | null;
  excluidoEm: Date | null;
  createdAt: Date;
}): UsuarioListagem {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    colaboradorId: user.colaboradorId,
    colaboradorNome: user.colaboradorNome,
    moduloProducao: user.moduloProducao,
    permissoes: parsePermissoesUsuario(user.permissoesJson),
    excluidoEm: user.excluidoEm?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}
