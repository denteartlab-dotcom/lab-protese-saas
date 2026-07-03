export const LIMITE_URGENCIAS_ATIVAS_CLIENTE = 5;
export const LIMITE_URGENCIAS_DIA_CLIENTE = 2;
export const JSON_STORE_URGENCIAS_CLIENTE = "labProteseUrgenciasCliente";

/** Linha de auditoria gravada em instruções (legado — não exibir na observação da OS). */
export function isLinhaAuditoriaUrgenciaCliente(linha: string) {
  return linha.includes("Urgência solicitada pelo cliente");
}

export type UrgenteClienteDashboardItem = {
  id: string;
  trabalhoId: string;
  clienteId: string;
  numeroOs: number;
  clienteNome: string;
  pacienteNome: string;
  tipoProtese: string;
  criadoEm: string;
  linkAcompanhamento?: string;
};

/** Remove marcação de urgência nas instruções (ao finalizar/entregar). */
export function removerMarcacaoUrgenteInstrucoes(
  instrucoes: string | null | undefined
): string {
  const linhas = (instrucoes || "")
    .split("\n")
    .filter((l) => !isLinhaAuditoriaUrgenciaCliente(l))
    .map((line) =>
      line
        .replace(/ - urgente - obs /gi, " - obs ")
        .replace(/ - urgente(?= -|$)/gi, "")
    );
  return linhas.join("\n").trimEnd();
}

export function inicioDiaBr(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function fimDiaBr(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function eventoNoDia(criadoEm: string, ref = new Date()) {
  const d = new Date(criadoEm);
  if (Number.isNaN(d.getTime())) return false;
  return d >= inicioDiaBr(ref) && d <= fimDiaBr(ref);
}
