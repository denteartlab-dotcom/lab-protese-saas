import {
  abrirWhatsAppFaturaConferencia,
  buildFaturaConferenciaWhatsAppUrl,
  formatWhatsAppPhone,
} from "@/lib/whatsapp";

export type ResultadoDisparoWhatsappCliente =
  | { modo: "auto" }
  | { modo: "manual" }
  | { modo: "erro"; error?: string };

type StatusWhatsappApi = {
  habilitado?: boolean;
  conectado?: boolean;
};

export async function buscarStatusWhatsappAutomacao(): Promise<StatusWhatsappApi> {
  try {
    const res = await fetch("/api/whatsapp/status", { cache: "no-store" });
    if (!res.ok) return { habilitado: false, conectado: false };
    return (await res.json()) as StatusWhatsappApi;
  } catch {
    return { habilitado: false, conectado: false };
  }
}

export async function dispararWhatsappSistema(
  telefone: string,
  mensagem: string
): Promise<ResultadoDisparoWhatsappCliente> {
  try {
    const res = await fetch("/api/whatsapp/enviar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telefone, mensagem }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (res.ok && data.ok) return { modo: "auto" };
    return {
      modo: "erro",
      error: typeof data.error === "string" ? data.error : "Falha no envio automático",
    };
  } catch {
    return { modo: "erro", error: "Falha de rede ao enviar WhatsApp" };
  }
}

/**
 * Tenta envio automático (Baileys) quando conectado; senão abre wa.me no navegador.
 * Use `forcarWhatsAppWeb: true` para sempre abrir o WhatsApp Web (ex.: link de acompanhamento).
 */
export async function dispararOuAbrirWhatsapp(
  telefone: string | null | undefined,
  mensagem: string,
  opts?: { forcarWhatsAppWeb?: boolean; janelaWhatsapp?: Window | null }
): Promise<ResultadoDisparoWhatsappCliente> {
  const telefoneNorm = formatWhatsAppPhone(String(telefone ?? "").trim());
  if (!telefoneNorm) {
    return { modo: "erro", error: "Telefone inválido" };
  }

  if (!opts?.forcarWhatsAppWeb) {
    const status = await buscarStatusWhatsappAutomacao();
    if (status.habilitado && status.conectado) {
      const auto = await dispararWhatsappSistema(telefoneNorm, mensagem);
      if (auto.modo === "auto") return auto;
      if (auto.modo === "erro" && auto.error) {
        console.warn("[whatsapp]", auto.error);
      }
    }
  }

  const url = buildFaturaConferenciaWhatsAppUrl(telefoneNorm, mensagem, {
    preferirWhatsAppWeb: Boolean(opts?.forcarWhatsAppWeb),
  });
  const abriu = abrirWhatsAppFaturaConferencia(
    telefoneNorm,
    mensagem,
    opts?.janelaWhatsapp,
    { preferirWhatsAppWeb: Boolean(opts?.forcarWhatsAppWeb) }
  );
  if (abriu) return { modo: "manual" };
  if (!url) return { modo: "erro", error: "Telefone inválido" };
  return { modo: "erro", error: "Não foi possível abrir o WhatsApp" };
}
