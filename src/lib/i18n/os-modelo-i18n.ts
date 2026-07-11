import type { ModeloOsId } from "@/lib/configuracoes-os";
import type { MessageKey } from "@/lib/i18n";

const CHAVES_MODELO: Record<ModeloOsId, MessageKey> = {
  modelo1: "os.modelo.modelo1",
  modelo2: "os.modelo.modelo2",
  modelo3: "os.modelo.modelo3",
  modelo4: "os.modelo.modelo4",
  modelo5: "os.modelo.modelo5",
};

type Tradutor = (key: MessageKey, params?: Record<string, string | number>) => string;

export function nomeModeloOsI18n(t: Tradutor, id: ModeloOsId): string {
  return t(CHAVES_MODELO[id]);
}
