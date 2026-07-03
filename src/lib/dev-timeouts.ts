/** Timeouts mais longos no desenvolvimento (primeira compilação Next pode levar 30–60s). */
export const EH_AMBIENTE_DEV = process.env.NODE_ENV === "development";

export const TIMEOUT_BOOTSTRAP_CLIENTE_MS = EH_AMBIENTE_DEV ? 90_000 : 12_000;
export const TENTATIVAS_BOOTSTRAP_CLIENTE = EH_AMBIENTE_DEV ? 4 : 2;
export const TIMEOUT_MIGRAR_LOCAL_MS = EH_AMBIENTE_DEV ? 30_000 : 8_000;
export const TIMEOUT_CARREGAMENTO_APP_MS = EH_AMBIENTE_DEV ? 120_000 : 20_000;
export const TIMEOUT_BOOTSTRAP_SERVIDOR_MS = EH_AMBIENTE_DEV ? 90_000 : 25_000;
