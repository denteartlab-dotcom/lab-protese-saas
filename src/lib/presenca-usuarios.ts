export type UsuarioOnlinePresenca = {
  userId: string;
  name: string;
  colaboradorId: string | null;
  colaboradorNome: string | null;
};

type EntradaPresenca = UsuarioOnlinePresenca & {
  sockets: Set<string>;
  ultimoPing: number;
};

const globalForPresenca = globalThis as typeof globalThis & {
  __presencaUsuariosPorEmpresa?: Map<string, Map<string, EntradaPresenca>>;
};

function mapaEmpresa(empresaId: string) {
  if (!globalForPresenca.__presencaUsuariosPorEmpresa) {
    globalForPresenca.__presencaUsuariosPorEmpresa = new Map();
  }
  let mapa = globalForPresenca.__presencaUsuariosPorEmpresa.get(empresaId);
  if (!mapa) {
    mapa = new Map();
    globalForPresenca.__presencaUsuariosPorEmpresa.set(empresaId, mapa);
  }
  return mapa;
}

export function conectarPresencaUsuario(
  empresaId: string,
  socketId: string,
  usuario: UsuarioOnlinePresenca
) {
  const mapa = mapaEmpresa(empresaId);
  let entrada = mapa.get(usuario.userId);
  if (!entrada) {
    entrada = {
      ...usuario,
      sockets: new Set(),
      ultimoPing: Date.now(),
    };
    mapa.set(usuario.userId, entrada);
  } else {
    entrada.name = usuario.name;
    entrada.colaboradorId = usuario.colaboradorId;
    entrada.colaboradorNome = usuario.colaboradorNome;
    entrada.ultimoPing = Date.now();
  }
  entrada.sockets.add(socketId);
}

export function desconectarPresencaUsuario(
  empresaId: string,
  userId: string,
  socketId: string
) {
  const mapa = mapaEmpresa(empresaId);
  const entrada = mapa.get(userId);
  if (!entrada) return false;

  entrada.sockets.delete(socketId);
  if (entrada.sockets.size === 0) {
    mapa.delete(userId);
    return true;
  }
  return false;
}

export function listarUsuariosOnlineEmpresa(empresaId: string): UsuarioOnlinePresenca[] {
  return [...mapaEmpresa(empresaId).values()]
    .map(({ userId, name, colaboradorId, colaboradorNome }) => ({
      userId,
      name,
      colaboradorId,
      colaboradorNome,
    }))
    .sort((a, b) => {
      const nomeA = (a.colaboradorNome || a.name).toLowerCase();
      const nomeB = (b.colaboradorNome || b.name).toLowerCase();
      return nomeA.localeCompare(nomeB, "pt-BR");
    });
}

export function contarUsuariosOnlineEmpresa(empresaId: string) {
  return mapaEmpresa(empresaId).size;
}
