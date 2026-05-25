/** Remove `null`/`undefined` de campos opcionais antes do POST (evita erro Zod). */
export function bodyTrabalhoSemNull<T extends Record<string, unknown>>(body: T): T {
  const out = { ...body };
  for (const key of Object.keys(out)) {
    if (out[key] == null) {
      delete out[key];
    }
  }
  return out;
}
