/** Detecção e aviso de armazenamento cheio (OneDrive / galeria). */

export const ARMAZENAMENTO_CHEIO_EVENT = "labProteseArmazenamentoCheio";
export const CODIGO_ARMAZENAMENTO_CHEIO = "STORAGE_FULL";
export const CODIGO_NUVEM_POOL_CHEIO = "CLOUD_POOL_FULL";

export type TipoAvisoArmazenamento = "limite_empresa" | "nuvem_pool";

export const MENSAGEM_ARMAZENAMENTO_CHEIO =
  "O espaço de armazenamento do laboratório está cheio. Não é possível enviar novos arquivos. Libere espaço excluindo imagens e anexos antigos.";

export const MENSAGEM_NUVEM_POOL_CHEIO =
  "O armazenamento na nuvem do sistema está esgotado. Entre em contato com o administrador para ampliar a capacidade da nuvem.";

export function ehErroEspacoArmazenamento(erro: unknown): boolean {
  if (!erro) return false;
  if (typeof erro === "object" && erro !== null && "code" in erro) {
    const code = String((erro as { code?: string }).code || "");
    if (
      code === CODIGO_ARMAZENAMENTO_CHEIO ||
      code === CODIGO_NUVEM_POOL_CHEIO ||
      code === "quotaLimitReached"
    ) {
      return true;
    }
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
  return /quotaLimitReached|Quota limit reached|STORAGE_FULL|CLOUD_POOL_FULL|esgotado|espaço insuficiente|Espaco insuficiente|limite da galeria|507|insufficientStorage|administrador/i.test(
    msg
  );
}

export function tipoAvisoArmazenamento(erro: unknown): TipoAvisoArmazenamento {
  if (typeof erro === "object" && erro !== null && "code" in erro) {
    const code = String((erro as { code?: string }).code || "");
    if (code === CODIGO_NUVEM_POOL_CHEIO) return "nuvem_pool";
  }
  const msg =
    typeof erro === "string"
      ? erro
      : erro instanceof Error
        ? erro.message
        : String(erro ?? "");
  if (/CLOUD_POOL_FULL|administrador|ampliar a capacidade/i.test(msg)) {
    return "nuvem_pool";
  }
  return "limite_empresa";
}

let ultimoMotivoAviso: TipoAvisoArmazenamento = "limite_empresa";

export function registrarMotivoBloqueioArmazenamento(tipo: TipoAvisoArmazenamento) {
  ultimoMotivoAviso = tipo;
}

export function notificarArmazenamentoCheio(
  tipo?: TipoAvisoArmazenamento
) {
  if (typeof window === "undefined") return;
  const efetivo = tipo ?? ultimoMotivoAviso;
  window.dispatchEvent(
    new CustomEvent(ARMAZENAMENTO_CHEIO_EVENT, { detail: { tipo: efetivo } })
  );
}

/** Se for erro de espaço, dispara o modal e retorna true. */
export function tratarErroUploadArmazenamento(erro: unknown): boolean {
  if (!ehErroEspacoArmazenamento(erro)) return false;
  notificarArmazenamentoCheio(tipoAvisoArmazenamento(erro));
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
