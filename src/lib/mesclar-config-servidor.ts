/**
 * O JSON do servidor é a configuração salva. O espelho local só cobre o servidor
 * quando mudou durante o GET (o usuário gravou enquanto a resposta antiga vinha).
 * Sem isso, o espelho vazio vira o padrão (Arial) e apaga a fonte gravada.
 */
export function mesclarConfigAposBusca<T extends object>(
  remoto: Partial<T> | null | undefined,
  localAntes: Partial<T> | null,
  localDepois: Partial<T> | null
): Partial<T> | null {
  const antes = localAntes ? JSON.stringify(localAntes) : null;
  const depois = localDepois ? JSON.stringify(localDepois) : null;
  if (localDepois && depois !== antes) {
    return { ...(remoto ?? {}), ...localDepois };
  }
  if (remoto && typeof remoto === "object") return remoto;
  return localDepois;
}
