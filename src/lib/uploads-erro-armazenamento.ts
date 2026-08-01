/** Detecção e aviso de armazenamento cheio (OneDrive / galeria). */

export const ARMAZENAMENTO_CHEIO_EVENT = "labProteseArmazenamentoCheio";
export const CODIGO_ARMAZENAMENTO_CHEIO = "STORAGE_FULL";

export const MENSAGEM_ARMAZENAMENTO_CHEIO =
  "O espaço de armazenamento na nuvem está cheio. Não é possível enviar novos arquivos. Libere espaço excluindo imagens e anexos antigos.";

export function ehErroEspacoArmazenamento(erro: unknown): boolean {
  if (!erro) return false;
  if (typeof erro === "object" && erro !== null && "code" in erro) {
    const code = String((erro as { code?: string }).code || "");
    if (code === CODIGO_ARMAZENAMENTO_CHEIO || code === "quotaLimitReached") return true;
  }
  const msg =
    typeof erro === "string"
      ? erro
      : erro instanceof Error
        ? erro.message
        : typeof erro === "object" &&
            erro !== null &&
            "error" in erro &&
            typeof (erro as { error?: unknown }).error === "string"
          ? String((erro as { error: string }).error)
          : String(erro);
  return /quotaLimitReached|Quota limit reached|STORAGE_FULL|esgotado|espaço insuficiente|Espaco insuficiente|limite da galeria|507|insufficientStorage/i.test(
    msg
  );
}

export function notificarArmazenamentoCheio() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ARMAZENAMENTO_CHEIO_EVENT));
}

/** Se for erro de espaço, dispara o modal e retorna true. */
export function tratarErroUploadArmazenamento(erro: unknown): boolean {
  if (!ehErroEspacoArmazenamento(erro)) return false;
  notificarArmazenamentoCheio();
  return true;
}

export async function lerErroUploadResponse(res: Response): Promise<{
  message: string;
  code?: string;
}> {
  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
  };
  const message =
    typeof body.error === "string" && body.error.trim()
      ? body.error
      : "Não foi possível enviar os arquivos.";
  return { message, code: body.code };
}
