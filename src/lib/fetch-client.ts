export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    ...init,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("Não autorizado");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err as { error?: string }).error;
    throw new Error(
      msg ||
        (res.status >= 500
          ? "Erro no servidor. Tente recarregar a página."
          : "Erro na requisição")
    );
  }

  return res.json() as Promise<T>;
}
